"""
TriCV — interface Streamlit.

Une page unique, quatre étapes visibles simultanément (§3 du cadrage).

CE FICHIER NE CONTIENT AUCUNE LOGIQUE MÉTIER. Il assemble des composants
Streamlit autour des fonctions de `core/`, qui sont pures et testables sans
navigateur. Si une règle de calcul doit changer, elle change dans `core/`.

LES CINQ RÈGLES DE CONFIDENTIALITÉ DU §5 S'APPLIQUENT ICI INTÉGRALEMENT :

1. Aucune écriture disque. `st.file_uploader` rend un objet mémoire, passé
   tel quel au parser. Aucun `.save()`, aucun `open(..., 'w')`.
2. AUCUN `@st.cache_data` NI `@st.cache_resource` dans ce fichier. Le cache
   Streamlit est partagé entre toutes les sessions et leur survit : en poser
   un sur du contenu de CV recréerait exactement la base de données qu'on
   veut éviter. C'est la règle la plus facile à enfreindre par réflexe
   d'optimisation — si un jour l'analyse paraît lente, la réponse est de
   réduire le nombre de fichiers, pas de mettre un cache.
3. Le texte brut est libéré dès le score calculé. Il n'entre JAMAIS dans
   `st.session_state`. Voir `analyser_les_cv`.
4. Aucun appel réseau sortant. Aucune police distante, aucune analytique.
5. Aucun `print()` ni message d'erreur contenant du texte extrait ou un nom
   de candidat.
"""

import pandas as pd
import streamlit as st

from core.criteres import (
    analyser_mots_cles,
    construire_critere,
    criteres_incomplets,
    total_des_poids,
)
from core.export import (
    AVERTISSEMENT,
    SEUIL_AMBRE,
    SEUIL_VERT,
    TYPE_MIME_XLSX,
    generer_classeur,
    nom_du_fichier_export,
)
from core.modeles import LIBELLE_AUCUN_MODELE, charger_modele, noms_des_modeles
from core.parser import parser_cv
from core.scorer import scorer_candidat

# ----------------------------------------------------------------------
# Constantes d'interface
# ----------------------------------------------------------------------

MAX_FICHIERS = 40  # §3 du cadrage
MAX_MO_PAR_FICHIER = 5  # aligné sur server.maxUploadSize dans config.toml
FORMATS_ACCEPTES = ["pdf", "docx"]

NOTICE_COURTE = (
    "**Aucune donnée conservée.** Les CV sont analysés en mémoire vive "
    "pendant la session, puis effacés. Aucun fichier, aucun nom et aucun "
    "score n'est enregistré sur un serveur."
)

# Texte fixé au §5 du cadrage. Les deux derniers paragraphes sont ceux qu'on
# est tenté de retirer : la transparence sur l'hébergement couvre
# l'obligation d'information, et le dernier cadre l'usage. Ils restent.
NOTICE_COMPLETE = """
Les CV déposés sont analysés en mémoire vive. Ils ne sont jamais enregistrés
sur un disque, ni transmis à un tiers, ni utilisés pour entraîner un modèle.
Aucun compte, aucune base de données, aucun historique.

Vos données disparaissent à la fin de votre session, ou immédiatement si vous
cliquez sur « Effacer la session ».

L'application est hébergée sur Streamlit Community Cloud, dont les serveurs
sont situés aux États-Unis : les fichiers y transitent le temps de l'analyse.

Le score est une aide à la lecture, pas une décision : il classe, il n'élimine
pas.
"""

st.set_page_config(page_title="TriCV", page_icon="📄", layout="centered")


# ----------------------------------------------------------------------
# État de session
# ----------------------------------------------------------------------
#
# `st.session_state` est un dictionnaire propre à l'onglet du navigateur. Il
# survit aux réexécutions du script — Streamlit rejoue le fichier entier à
# chaque clic — mais pas à la fermeture de l'onglet. C'est exactement le
# comportement qu'on veut : de l'état qui dure le temps d'un usage, et rien
# de plus.
#
# Ce qu'on y met : les critères saisis et les RÉSULTATS. Jamais le texte des
# CV, jamais les fichiers eux-mêmes.


def initialiser_etat():
    valeurs_par_defaut = {
        "criteres": [],
        "prochain_id": 0,
        "resultats": None,
        "modele_actif": None,
        "erreurs_depot": [],
        "session_effacee": False,
        "generation_depot": 0,
    }
    for cle, valeur in valeurs_par_defaut.items():
        if cle not in st.session_state:
            st.session_state[cle] = valeur


def nouveau_critere(nom="", mots_cles="", poids=0, type_critere="requis"):
    critere = {
        "id": st.session_state.prochain_id,
        "nom": nom,
        "mots_cles": mots_cles,
        "poids": poids,
        "type": type_critere,
    }
    st.session_state.prochain_id += 1
    return critere


def oublier_widgets_des_criteres():
    """
    Supprime les clés de widgets associées aux critères.

    Sans cela, charger un nouveau modèle laisserait Streamlit réafficher les
    anciennes valeurs : les widgets sont mémorisés par leur clé, et une clé
    réutilisée ressort avec son contenu précédent. C'est la cause classique
    du « j'ai changé de modèle mais l'ancien texte est resté ».
    """
    for cle in list(st.session_state.keys()):
        if cle.startswith(("nom_", "mc_", "poids_", "suppr_")):
            del st.session_state[cle]


def effacer_la_session():
    """
    Vide l'état et revient à l'écran initial (§3, étape 4).

    On efface tout, y compris les critères : le bouton promet « supprime les
    CV, leurs scores et vos critères ». Une promesse à moitié tenue vaut
    moins que pas de promesse.
    """
    # La zone de dépôt garde ses fichiers côté navigateur tant que sa CLÉ ne
    # change pas — vider `session_state` ne suffit pas, le composant est
    # recréé à l'identique et réaffiche la même liste. On incrémente donc un
    # compteur qui entre dans la clé du widget : la zone suivante est un
    # widget neuf, forcément vide.
    #
    # Sans cela, « Effacer la session » laisse les noms de fichiers à
    # l'écran : la promesse est visiblement démentie au moment même où on la
    # fait.
    generation_suivante = st.session_state.get("generation_depot", 0) + 1

    oublier_widgets_des_criteres()
    for cle in list(st.session_state.keys()):
        del st.session_state[cle]
    initialiser_etat()
    st.session_state.generation_depot = generation_suivante
    st.session_state.session_effacee = True


initialiser_etat()


# ----------------------------------------------------------------------
# En-tête et notice
# ----------------------------------------------------------------------


def afficher_entete():
    st.caption("OUTIL INTERNE RH")
    st.title("TriCV")
    st.write(
        "Déposez un lot de CV, définissez vos critères pondérés, obtenez un "
        "classement expliqué que vous pouvez exporter en Excel."
    )

    # La notice courte est en haut de page, sans avoir à faire défiler
    # (critère de recette §12). La version intégrale du §5 est juste en
    # dessous, dépliable.
    st.info(NOTICE_COURTE)
    with st.expander("Traitement éphémère — aucune conservation"):
        st.write(NOTICE_COMPLETE)

    st.caption("1. CRITÈRES → 2. DÉPÔT → 3. ANALYSE → 4. CLASSEMENT")

    if st.session_state.session_effacee:
        st.success(
            "Session effacée. Les CV et leurs scores ont été supprimés de la "
            "mémoire vive. Aucune copie n'a été conservée."
        )
        st.session_state.session_effacee = False


# ----------------------------------------------------------------------
# Étape 1 — Critères de sélection
# ----------------------------------------------------------------------


def afficher_choix_du_modele():
    choix = st.selectbox(
        "Modèle de poste",
        [LIBELLE_AUCUN_MODELE] + noms_des_modeles(),
        help=(
            "Le modèle propose des critères et des mots-clés que vous pouvez "
            "ensuite modifier librement."
        ),
        key="choix_modele",
    )

    colonne_charger, colonne_vierge = st.columns(2)

    with colonne_charger:
        charger = st.button(
            "Charger le modèle",
            type="primary",
            use_container_width=True,
            disabled=choix == LIBELLE_AUCUN_MODELE,
        )
    with colonne_vierge:
        vierge = st.button("Partir d'une page blanche", use_container_width=True)

    if charger:
        oublier_widgets_des_criteres()
        st.session_state.criteres = [
            nouveau_critere(c["nom"], c["mots_cles"], c["poids"])
            for c in charger_modele(choix)
        ]
        st.session_state.modele_actif = choix
        st.session_state.resultats = None
        st.rerun()

    if vierge:
        oublier_widgets_des_criteres()
        st.session_state.criteres = [nouveau_critere(poids=50)]
        st.session_state.modele_actif = None
        st.session_state.resultats = None
        st.rerun()


def afficher_un_critere(critere, indice):
    """
    Affiche la carte d'un critère et récupère les valeurs saisies.

    Les widgets sont identifiés par une clé stable dérivée de l'identifiant
    du critère, et leur valeur initiale est déposée dans `session_state`
    AVANT création. C'est le motif recommandé : passer `value=` à un widget
    dont la clé existe déjà provoque un avertissement et, surtout, rend le
    comportement difficile à prévoir quand la liste change de taille.
    """
    identifiant = critere["id"]
    cle_nom = f"nom_{identifiant}"
    cle_mots = f"mc_{identifiant}"
    cle_poids = f"poids_{identifiant}"

    for cle, valeur in (
        (cle_nom, critere["nom"]),
        (cle_mots, critere["mots_cles"]),
        (cle_poids, critere["poids"]),
    ):
        if cle not in st.session_state:
            st.session_state[cle] = valeur

    with st.container(border=True):
        colonne_nom, colonne_poids, colonne_suppr = st.columns([6, 2, 1])

        with colonne_nom:
            critere["nom"] = st.text_input(
                "Nom du critère",
                key=cle_nom,
                placeholder="Langages & frameworks",
            )
        with colonne_poids:
            critere["poids"] = st.number_input(
                "Poids", min_value=0, max_value=100, step=5, key=cle_poids
            )
        with colonne_suppr:
            st.write("")
            st.write("")
            supprimer = st.button(
                "✕",
                key=f"suppr_{identifiant}",
                help="Supprimer ce critère",
                use_container_width=True,
            )

        critere["mots_cles"] = st.text_area(
            "Mots-clés recherchés",
            key=cle_mots,
            height=110,
            placeholder="python\nreact = vue, angular",
            help=(
                "Un mot-clé par ligne ou séparé par une virgule. "
                "Le signe « = » crée un groupe de synonymes : « react = vue, "
                "angular » est trouvé si l'un des trois apparaît. "
                "Recherche insensible à la casse et aux accents."
            ),
        )

        groupes = analyser_mots_cles(critere["mots_cles"])
        if groupes:
            st.caption(
                accorder(len(groupes), "groupe de recherche", "groupes de recherche")
                + " : "
                + " · ".join(
                    g[0] if len(g) == 1 else f"{g[0]} (+{len(g) - 1})" for g in groupes
                )
            )

    return supprimer


def afficher_etape_criteres():
    st.subheader("Étape 1 — Critères de sélection")
    afficher_choix_du_modele()

    if not st.session_state.criteres:
        st.caption(
            "Choisissez un modèle ci-dessus, ou partez d'une page blanche "
            "pour définir vos propres critères."
        )
        return

    total = total_des_poids(
        [{"poids": c["poids"], "type": c["type"]} for c in st.session_state.criteres]
    )
    reste = 100 - total

    colonne_metrique, colonne_note = st.columns([1, 3])
    with colonne_metrique:
        st.metric("Poids attribués", f"{total} / 100")
    with colonne_note:
        st.write("")
        if reste > 0:
            st.caption(f"Il reste {reste} points à attribuer.")
        elif reste < 0:
            st.caption(
                f"Vous avez attribué {-reste} points de trop. Le score reste "
                "calculé sur 100 : les poids sont ramenés à leur proportion."
            )
        else:
            st.caption("Tous les points sont attribués.")

    a_supprimer = None
    for indice, critere in enumerate(st.session_state.criteres):
        if afficher_un_critere(critere, indice):
            a_supprimer = critere["id"]

    if a_supprimer is not None:
        st.session_state.criteres = [
            c for c in st.session_state.criteres if c["id"] != a_supprimer
        ]
        for prefixe in ("nom_", "mc_", "poids_", "suppr_"):
            st.session_state.pop(f"{prefixe}{a_supprimer}", None)
        st.session_state.resultats = None
        st.rerun()

    if st.button("＋ Ajouter un critère"):
        st.session_state.criteres.append(nouveau_critere())
        st.session_state.resultats = None
        st.rerun()

    afficher_criteres_exclusion()


def afficher_criteres_exclusion():
    """
    Les critères d'exclusion, dans un volet replié.

    Repliés parce qu'ils sont facultatifs et que les déplier par défaut
    suggérerait qu'on attend un filtre. Un critère d'exclusion ne filtre
    rien : il pose un signalement visible (garde-fou n°4 du §4).
    """
    exclusions = [c for c in st.session_state.criteres if c["type"] == "exclusion"]
    intitule = (
        "Critères d'exclusion — "
        + accorder(len(exclusions), "règle", "règles")
        + " · signalement seulement"
        if exclusions
        else "Critères d'exclusion — signalement seulement"
    )

    with st.expander(intitule):
        st.caption(
            "Un critère d'exclusion n'élimine jamais un candidat et ne modifie "
            "jamais son score. Il pose un signalement visible dans le "
            "classement ; c'est à vous de trancher."
        )
        if st.button("＋ Ajouter une règle d'exclusion"):
            st.session_state.criteres.append(
                nouveau_critere(type_critere="exclusion")
            )
            st.session_state.resultats = None
            st.rerun()


# ----------------------------------------------------------------------
# Étape 2 — Dépôt des CV
# ----------------------------------------------------------------------


def afficher_etape_depot():
    st.subheader("Étape 2 — Dépôt des CV")

    fichiers = st.file_uploader(
        "Glissez vos CV ici, ou parcourez vos fichiers",
        type=FORMATS_ACCEPTES,
        accept_multiple_files=True,
        help=(
            f"{MAX_FICHIERS} fichiers maximum · {MAX_MO_PAR_FICHIER} Mo par "
            "fichier · PDF, DOCX"
        ),
        key=f"depot_{st.session_state.generation_depot}",
    )
    st.caption(
        f"{MAX_FICHIERS} fichiers maximum · {MAX_MO_PAR_FICHIER} Mo par "
        "fichier · PDF, DOCX"
    )

    criteres_prets = construire_les_criteres()
    manquants = criteres_incomplets(criteres_prets)
    poids_total = total_des_poids(criteres_prets)

    if fichiers:
        octets = sum(f.size for f in fichiers)
        st.caption(
            accorder(len(fichiers), "fichier déposé", "fichiers déposés")
            + f" · {nombre_francais(octets / 1_048_576)} Mo au total"
        )

    trop_de_fichiers = fichiers is not None and len(fichiers) > MAX_FICHIERS
    if trop_de_fichiers:
        st.error(
            f"{len(fichiers)} fichiers déposés. Le maximum est de "
            f"{MAX_FICHIERS} par session, pour que l'application reste "
            "disponible pour les autres utilisateurs. Retirez-en "
            f"{len(fichiers) - MAX_FICHIERS} et relancez."
        )

    if manquants:
        st.warning(
            ("Ce critère a un poids mais aucun mot-clé, et abaisse donc tous "
             "les scores sans rien pouvoir rapporter : "
             if len(manquants) == 1 else
             "Ces critères ont un poids mais aucun mot-clé, et abaissent donc "
             "tous les scores sans rien pouvoir rapporter : ")
            + ", ".join(f"« {nom or 'critère sans nom'} »" for nom in manquants)
        )

    pret = bool(fichiers) and poids_total > 0 and not trop_de_fichiers

    if not st.session_state.criteres or poids_total <= 0:
        st.caption(
            "Définissez au moins un critère avec un poids à l'étape 1 pour "
            "activer l'analyse."
        )

    lancer = st.button(
        f"Lancer l'analyse des {len(fichiers)} CV" if fichiers else "Lancer l'analyse",
        type="primary",
        disabled=not pret,
        use_container_width=True,
    )

    if lancer:
        analyser_les_cv(fichiers, criteres_prets)
        st.rerun()


def construire_les_criteres():
    """Transforme les critères saisis en structures consommables par le moteur."""
    return [
        construire_critere(c["nom"], c["poids"], c["mots_cles"], c["type"])
        for c in st.session_state.criteres
    ]


# ----------------------------------------------------------------------
# Étape 3 — Analyse
# ----------------------------------------------------------------------


def analyser_les_cv(fichiers, criteres):
    """
    Analyse le lot et ne conserve que les résultats.

    LE POINT CRITIQUE DE TOUT LE FICHIER est la ligne `del resultat["texte"]`.

    Le parser rend le texte intégral du CV. On le passe au scorer, puis on le
    SUPPRIME du dictionnaire avant que celui-ci n'entre dans
    `st.session_state`. Sans cette ligne, le texte complet de quarante CV
    resterait en mémoire pour toute la durée de la session : c'est la règle
    n°3 du §5, et c'est aussi ce qui tient dans le gigaoctet de RAM partagé
    du §9.

    Aucun décorateur de cache sur cette fonction. Voir l'en-tête du fichier.
    """
    st.subheader("Étape 3 — Analyse")
    st.warning(
        "L'analyse dure quelques secondes. Ne fermez pas cet onglet : les "
        "fichiers sont en mémoire vive et seraient perdus."
    )

    barre = st.progress(0.0, text="Préparation…")
    resultats = []
    total = len(fichiers)

    for index, fichier in enumerate(fichiers, start=1):
        barre.progress(
            (index - 1) / total,
            text=f"Extraction du texte · {fichier.name}  ({index} sur {total})",
        )

        try:
            # `fichier` est un objet mémoire rendu par st.file_uploader.
            # Il n'est jamais écrit sur le disque.
            resultat = parser_cv(fichier, fichier.name)
        except Exception:
            # On ne journalise NI l'exception NI son message : il peut
            # contenir des fragments du document (règle n°5 du §5).
            resultats.append({
                "fichier": fichier.name,
                "lisible": False,
                "nom": None,
                "email": None,
                "telephone": None,
                "score": None,
                "signalements": [],
                "detail": [],
                "taille": _formater_taille(fichier.size),
                "raison": "Fichier illisible ou endommagé",
            })
            continue

        if resultat["lisible"]:
            resultat.update(scorer_candidat(resultat["texte"], criteres))
        else:
            resultat["score"] = None
            resultat["signalements"] = []
            resultat["detail"] = []
            resultat["raison"] = "Document scanné, aucun texte lisible"

        resultat["taille"] = _formater_taille(fichier.size)

        # ↓↓↓ Libération du texte brut. Ne jamais retirer cette ligne. ↓↓↓
        del resultat["texte"]

        resultats.append(resultat)

    barre.progress(1.0, text=f"Analyse terminée — {total} CV traités")

    st.session_state.resultats = resultats
    st.session_state.criteres_analyse = criteres


def accorder(nombre, singulier, pluriel=None):
    """
    Accorde un mot avec un nombre : « 1 CV », « 2 CV analysés ».

    Écrire « 1 candidat(s) classé(s) » est le réflexe qui économise cinq
    minutes et coûte la crédibilité de l'interface. Le français s'accorde,
    et un outil destiné à des professionnels RH est jugé aussi sur sa langue.
    """
    if pluriel is None:
        pluriel = singulier + "s"
    return f"{nombre} {singulier if abs(nombre) <= 1 else pluriel}"


def nombre_francais(valeur, decimales=1):
    """
    Formate un nombre décimal à la française : 0,3 et non 0.3.

    Python écrit le séparateur décimal en point. En français c'est une
    virgule. Passer par `locale` serait plus général mais dépendrait de la
    configuration du serveur, qui n'est pas la nôtre sur Streamlit Cloud.
    """
    return f"{valeur:.{decimales}f}".replace(".", ",")


def _formater_taille(octets):
    if octets is None:
        return "—"
    if octets >= 1_048_576:
        return f"{nombre_francais(octets / 1_048_576)} Mo"
    return f"{octets / 1024:.0f} Ko"


# ----------------------------------------------------------------------
# Étape 4 — Classement
# ----------------------------------------------------------------------


def _couleur_du_score(score):
    """Bande de couleur du score, identique à celle de l'export Excel."""
    if score >= SEUIL_VERT:
        return "background-color: #F0FDF4; color: #15803D; font-weight: 600"
    if score >= SEUIL_AMBRE:
        return "background-color: #FFFBEB; color: #B45309; font-weight: 600"
    return "background-color: #FEF2F2; color: #B91C1C; font-weight: 600"


def afficher_etape_classement():
    resultats = st.session_state.resultats
    if resultats is None:
        return

    criteres = st.session_state.get("criteres_analyse", [])
    classes = sorted(
        (r for r in resultats if r["lisible"]), key=lambda r: r["score"], reverse=True
    )
    illisibles = [r for r in resultats if not r["lisible"]]

    st.subheader("Étape 4 — Classement")

    # Garde-fou n°3 du §4 : avertissement permanent au-dessus du classement.
    # Il n'est ni replié ni masquable.
    st.warning(AVERTISSEMENT)
    st.caption(
        "Le score mesure la correspondance aux mots-clés que vous avez "
        "définis. Il ne mesure ni la qualité d'un candidat ni son adéquation "
        "au poste. Ouvrez le détail par critère et lisez les CV avant toute "
        "décision."
    )

    colonnes = st.columns(4)
    colonnes[0].metric("CV reçus", len(resultats))
    colonnes[1].metric("Analysés et classés", len(classes))
    colonnes[2].metric("À examiner manuellement", len(illisibles))
    colonnes[3].metric(
        "Signalements", sum(1 for r in classes if r["signalements"])
    )

    if classes:
        afficher_tableau(classes)
        afficher_details(classes)
    else:
        st.info("Aucun CV n'a pu être analysé. Voir la section ci-dessous.")

    if illisibles:
        afficher_illisibles(illisibles)

    afficher_actions_finales(resultats, criteres)


def afficher_tableau(classes):
    """
    Le classement, en tableau triable.

    GARDE-FOU N°2 DU §4 : aucun candidat n'est masqué. Les scores faibles
    apparaissent en bas du tableau, jamais repliés ni filtrés par défaut.
    C'est pourquoi la hauteur laisse voir toutes les lignes plutôt que de
    couper à dix.
    """
    tableau = pd.DataFrame([
        {
            "Rang": rang,
            "Candidat": r["nom"] or "— (non extrait)",
            "Email": r["email"] or "—",
            "Téléphone": r["telephone"] or "—",
            "Score / 100": r["score"],
            "Signalements": (
                ", ".join(s["critere"] for s in r["signalements"]) or "—"
            ),
            "Fichier": r["fichier"],
        }
        for rang, r in enumerate(classes, start=1)
    ])

    st.dataframe(
        tableau.style.map(_couleur_du_score, subset=["Score / 100"]),
        hide_index=True,
        use_container_width=True,
        height=(len(classes) + 1) * 35 + 3,
    )
    st.caption(
        accorder(len(classes), "candidat classé", "candidats classés")
        + f" · vert au-dessus de "
        f"{SEUIL_VERT}, ambre de {SEUIL_AMBRE} à {SEUIL_VERT}, rouge en "
        f"dessous de {SEUIL_AMBRE} — ces teintes qualifient la correspondance "
        "aux mots-clés, pas le candidat."
    )


def afficher_details(classes):
    """Le détail par critère, un volet dépliable par candidat."""
    st.write("")
    st.write("**Détail du score par candidat**")

    for rang, resultat in enumerate(classes, start=1):
        nom = resultat["nom"] or resultat["fichier"]
        intitule = f"{rang}. {nom} — {resultat['score']} / 100"

        with st.expander(intitule):
            st.caption(f"{resultat['fichier']} · {resultat['taille']}")

            for ligne in resultat["detail"]:
                poids = ligne["poids"] or 1
                st.write(
                    f"**{ligne['critere']}** — {ligne['points']} / "
                    f"{ligne['poids']} pts"
                )
                st.progress(min(1.0, ligne["points"] / poids))
                st.caption(
                    "TROUVÉS  " + (", ".join(ligne["trouves"]) or "aucun")
                )
                st.caption(
                    "ABSENTS  " + (", ".join(ligne["absents"]) or "aucun")
                )
                st.write("")

            if resultat["signalements"]:
                for signalement in resultat["signalements"]:
                    termes = ", ".join(
                        f"« {t} »" for t in signalement["declencheurs"]
                    )
                    st.warning(
                        f"Règle d'exclusion déclenchée — "
                        f"**{signalement['critere']}** : {termes}\n\n"
                        "Le signalement n'écarte pas la candidature et ne "
                        "modifie pas le score. Le candidat garde son rang ; "
                        "c'est à vous de trancher."
                    )

            st.caption(
                "Un mot-clé absent signifie seulement qu'il n'apparaît pas "
                "dans le document. Le candidat peut maîtriser la compétence "
                "sans l'avoir écrite."
            )


def afficher_illisibles(illisibles):
    """
    Les CV dont le texte n'a pas pu être extrait.

    Section DISTINCTE du classement, jamais en fin de tableau avec un score
    de 0 (§7.5). Un CV illisible n'a pas démérité : on n'a simplement pas pu
    le lire.
    """
    st.subheader("À examiner manuellement")
    if len(illisibles) == 1:
        st.info(
            "1 CV n'a pas pu être analysé. Il est scanné en image : aucun "
            "texte n'en est extractible. Il ne reçoit pas de score et n'est "
            "pas classé. Ouvrez-le directement."
        )
    else:
        st.info(
            f"{len(illisibles)} CV n'ont pas pu être analysés. Ils sont "
            "scannés en image : aucun texte n'en est extractible. Ils ne "
            "reçoivent pas de score et ne sont pas classés. Ouvrez-les "
            "directement."
        )
    st.dataframe(
        [
            {
                "Fichier": r["fichier"],
                "Taille": r["taille"],
                "Raison": r.get("raison", "Document scanné, aucun texte lisible"),
                "Score / 100": "—",
            }
            for r in illisibles
        ],
        hide_index=True,
        use_container_width=True,
    )


def afficher_actions_finales(resultats, criteres):
    st.write("")
    colonne_export, colonne_effacer = st.columns(2)

    with colonne_export:
        # Le classeur est construit en mémoire à l'affichage du bouton. Rien
        # n'est écrit sur le disque, ni ici ni dans core/export.py.
        classeur = generer_classeur(
            resultats, criteres, st.session_state.modele_actif
        )
        st.download_button(
            "Télécharger le récapitulatif (.xlsx)",
            data=classeur,
            file_name=nom_du_fichier_export(),
            mime=TYPE_MIME_XLSX,
            type="primary",
            use_container_width=True,
        )

    with colonne_effacer:
        if st.button("Effacer la session", use_container_width=True):
            demander_confirmation_effacement()

    st.caption(
        "Le fichier Excel contient le classement, le détail par critère et "
        "les mots-clés trouvés pour chaque candidat."
    )


@st.dialog("Effacer la session")
def demander_confirmation_effacement():
    nombre = len(st.session_state.resultats or [])
    if nombre == 1:
        objet = "le CV déposé, son score"
    else:
        objet = f"les {nombre} CV, leurs scores"
    st.write(
        f"Effacer la session supprime {objet} et vos critères. Téléchargez le "
        "récapitulatif Excel avant de continuer : rien ne pourra être "
        "récupéré."
    )
    colonne_oui, colonne_non = st.columns(2)
    with colonne_oui:
        if st.button("Oui, effacer la session", type="primary", use_container_width=True):
            effacer_la_session()
            st.rerun()
    with colonne_non:
        if st.button("Annuler", use_container_width=True):
            st.rerun()


# ----------------------------------------------------------------------
# Assemblage de la page
# ----------------------------------------------------------------------


def principal():
    afficher_entete()
    st.divider()
    afficher_etape_criteres()
    st.divider()
    afficher_etape_depot()

    if st.session_state.resultats is not None:
        st.divider()
        afficher_etape_classement()


principal()
