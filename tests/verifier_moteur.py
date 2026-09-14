"""
Contrôle de la porte P1 — vérification du moteur en ligne de commande.

Ce script fait tourner le parser et le scorer sur le corpus de test fictif et
affiche, pour chaque fichier : le nom extrait, l'email, le téléphone, le
statut lisible/illisible, le score et le détail par critère.

Il se lit en deux parties :

  PARTIE A — les trois corrections du lot 1, démontrées sur du texte écrit à
             la main. C'est le critère de sortie du lot 1 dans PROCESS §4.
  PARTIE B — le moteur complet sur le corpus, avec le modèle « Développeur
             web » du §8 du cadrage. C'est le critère de sortie du lot 2.

Chaque partie se termine par des vérifications automatiques. Le script sort
avec le code 0 si tout passe, 1 sinon — de quoi le brancher plus tard sur une
intégration continue.

    ./venv/bin/python tests/verifier_moteur.py

CONFIDENTIALITÉ. Ce script affiche des noms, des emails et des numéros de
téléphone, ce que la règle n°5 du §5 du cadrage interdit par ailleurs. C'est
la seule exception admise, et elle tient à une condition : il ne lit QUE
tests/corpus/, dont le contenu est entièrement fabriqué. Ne jamais le faire
pointer vers des CV réels.
"""

import io
import sys
from pathlib import Path

# Permet de lancer le script directement, sans installer le projet.
RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE))

from core.normalisation import normaliser
from core.parser import SEUIL_TEXTE_MINIMUM, parser_cv
from core.scorer import scorer_candidat, terme_present

DOSSIER_CORPUS = RACINE / "tests" / "corpus"


# ----------------------------------------------------------------------
# Le modèle de critères utilisé pour la vérification
# ----------------------------------------------------------------------

# Modèle « Développeur web » du §8 du cadrage, transcrit dans la structure du
# §7.2. La syntaxe du cadrage « react = vue, angular » signifie : un groupe
# dont le terme principal est « react » et les synonymes « vue » et
# « angular ».
#
# PROVISOIRE. Ce modèle vivra dans core/modeles.py au lot 3, avec les quatre
# autres. Il est écrit ici parce que la porte P1 se franchit AVANT le lot 3 :
# le moteur doit être validé avant qu'on écrive les modèles qui s'en servent.
MODELE_DEVELOPPEUR_WEB = [
    {
        "nom": "Langages & frameworks",
        "poids": 35,
        "type": "requis",
        "groupes": [
            ["python"],
            ["javascript", "js"],
            ["django", "flask"],
            ["react", "vue", "angular"],
        ],
    },
    {
        "nom": "Bases de données",
        "poids": 20,
        "type": "requis",
        "groupes": [
            ["sql"],
            ["postgresql", "postgres"],
            ["mysql"],
            ["mongodb", "nosql"],
        ],
    },
    {
        "nom": "Outils & versioning",
        "poids": 15,
        "type": "requis",
        "groupes": [
            ["git", "github", "gitlab"],
            ["docker"],
            ["linux"],
        ],
    },
    {
        "nom": "Expérience terrain",
        "poids": 20,
        "type": "requis",
        "groupes": [
            ["developpeur", "developer", "ingenieur logiciel"],
            ["freelance"],
            ["stage"],
        ],
    },
    {
        "nom": "Formation",
        "poids": 10,
        "type": "requis",
        "groupes": [
            ["licence", "bachelor"],
            ["master"],
            ["informatique"],
        ],
    },
]


# ----------------------------------------------------------------------
# Affichage
# ----------------------------------------------------------------------

LARGEUR = 78
_echecs = []


def titre(texte):
    print()
    print("=" * LARGEUR)
    print(texte)
    print("=" * LARGEUR)


def sous_titre(texte):
    print()
    print(texte)
    print("-" * LARGEUR)


def verifier(intitule, condition, observe=""):
    """Enregistre une vérification et l'affiche. Retourne la condition."""
    marque = "OK  " if condition else "ECHEC"
    suffixe = f"   (observé : {observe})" if observe and not condition else ""
    print(f"  [{marque}] {intitule}{suffixe}")
    if not condition:
        _echecs.append(intitule)
    return condition


# ----------------------------------------------------------------------
# PARTIE A — les trois corrections du lot 1
# ----------------------------------------------------------------------


def partie_a_frontieres_de_mots():
    sous_titre("A1. Frontières de mots — le bug principal de RecrutPro")

    texte = "Algorithme de recrutement. Mission au Congo et en Angola."
    texte_normalise = normaliser(texte)

    print(f'  Texte     : "{texte}"')
    print(f"  Normalisé : \"{texte_normalise}\"")
    print()
    print("  mot-clé   TriCV (\\bmot\\b)   RecrutPro (mot in texte)")
    for terme in ["r", "go", "c", "python"]:
        tricv = terme_present(terme, texte_normalise)
        recrutpro = terme in texte_normalise
        print(f"  {terme:<9} {str(tricv):<17} {recrutpro}")
    print()

    verifier(
        "« r » n'est pas trouvé dans « recrutement »",
        not terme_present("r", texte_normalise),
    )
    verifier(
        "« go » n'est pas trouvé dans « algorithme », « Congo », « Angola »",
        not terme_present("go", texte_normalise),
    )
    verifier(
        "un mot-clé d'une lettre reste trouvable quand il est un mot entier",
        terme_present("r", normaliser("Je programme en R et en Python.")),
    )


def partie_a_accents():
    sous_titre("A2. Suppression des accents des DEUX côtés de la comparaison")

    cv_accentue = normaliser("Développeur back-end, spécialisé en modélisation.")
    cv_sans_accent = normaliser("Developpeur back-end, specialise en modelisation.")

    print(f'  CV accentué     : "{cv_accentue}"')
    print(f'  CV sans accent  : "{cv_sans_accent}"')
    print()

    verifier(
        "mot-clé « developpeur » trouve « Développeur »",
        terme_present("developpeur", cv_accentue),
    )
    verifier(
        "mot-clé « développeur » trouve « Developpeur »",
        terme_present("développeur", cv_sans_accent),
    )
    verifier(
        "mot-clé accentué trouve un CV accentué",
        terme_present("modélisation", cv_accentue),
    )


def partie_a_normalisation_des_poids():
    sous_titre("A3. Score normalisé par le total des poids, sans plafond")

    # Deux critères, poids 100 et 50 : la somme dépasse 100, ce qui déclenchait
    # l'écrasement dans RecrutPro.
    criteres = [
        {"nom": "A", "poids": 100, "type": "requis", "groupes": [["python"], ["sql"]]},
        {"nom": "B", "poids": 50, "type": "requis", "groupes": [["git"]]},
    ]

    complet = scorer_candidat("python sql git", criteres)["score"]
    partiel = scorer_candidat("python sql", criteres)["score"]
    faible = scorer_candidat("python", criteres)["score"]

    print("  Somme des poids saisis : 150 (au-delà de 100, volontairement)")
    print(f"  CV complet  (3 groupes sur 3) : {complet:>3} / 100")
    print(f"  CV partiel  (2 groupes sur 3) : {partiel:>3} / 100")
    print(f"  CV faible   (1 groupe  sur 3) : {faible:>3} / 100")
    print("  Avec le min(score, 100) de RecrutPro : 100, 100 et 50 —")
    print("  les deux premiers devenaient indistinguables.")
    print()

    verifier("un CV complet atteint 100", complet == 100, complet)
    verifier(
        "les scores restent distincts malgré des poids totalisant 150",
        complet > partiel > faible,
        f"{complet} / {partiel} / {faible}",
    )

    # Même profil relatif, poids exprimés sur une autre base : même score.
    criteres_sur_10 = [
        {"nom": "A", "poids": 10, "type": "requis", "groupes": [["python"], ["sql"]]},
        {"nom": "B", "poids": 5, "type": "requis", "groupes": [["git"]]},
    ]
    identique = scorer_candidat("python sql", criteres_sur_10)["score"]
    verifier(
        "le score ne dépend pas de l'échelle des poids (150 ou 15)",
        identique == partiel,
        f"{identique} vs {partiel}",
    )


def partie_a_exclusions():
    sous_titre("A4. Critère d'exclusion — signalement sans effet sur le score")

    criteres = MODELE_DEVELOPPEUR_WEB + [
        {
            "nom": "Recherche un stage",
            "poids": 0,
            "type": "exclusion",
            "groupes": [["recherche un stage"], ["interim"]],
        }
    ]

    texte = (
        "Developpeur Python, Django, React, JavaScript. "
        "SQL, PostgreSQL, MySQL, MongoDB. Git, Docker, Linux. "
        "Freelance. Licence en informatique. "
        "Je recherche un stage de fin de cycle."
    )

    avec_exclusion = scorer_candidat(texte, criteres)
    sans_exclusion = scorer_candidat(texte, MODELE_DEVELOPPEUR_WEB)

    print(f"  Score avec le critère d'exclusion : {avec_exclusion['score']}")
    print(f"  Score sans le critère d'exclusion : {sans_exclusion['score']}")
    print(f"  Signalements : {avec_exclusion['signalements']}")
    print()

    verifier(
        "le critère d'exclusion produit un signalement",
        avec_exclusion["signalements"] == ["Recherche un stage"],
        avec_exclusion["signalements"],
    )
    verifier(
        "le signalement ne modifie pas le score",
        avec_exclusion["score"] == sans_exclusion["score"],
    )
    verifier(
        "le candidat reste dans le classement (il a un score)",
        avec_exclusion["score"] > 0,
    )


# ----------------------------------------------------------------------
# PARTIE B — le moteur complet sur le corpus
# ----------------------------------------------------------------------


def analyser_fichier(chemin):
    """
    Lit le fichier en mémoire, le passe au parser, puis au scorer s'il est
    lisible.

    La lecture depuis le disque n'existe QUE dans ce script de vérification :
    elle remplace le dépôt de fichier que fera `st.file_uploader`. Le parser,
    lui, ne reçoit qu'un objet mémoire — jamais un chemin.
    """
    with open(chemin, "rb") as fichier:
        memoire = io.BytesIO(fichier.read())

    resultat = parser_cv(memoire, chemin.name)

    if resultat["lisible"]:
        resultat.update(scorer_candidat(resultat["texte"], MODELE_DEVELOPPEUR_WEB))
    else:
        # Un document illisible n'est PAS scoré. « Illisible » et « score de
        # 0 » sont deux états distincts (§7.5 du cadrage).
        resultat["score"] = None
        resultat["signalements"] = []
        resultat["detail"] = []

    # Règle n°3 du §5 : le texte brut est libéré dès le score calculé. On
    # garde seulement sa longueur, pour le diagnostic.
    resultat["longueur_texte_normalise"] = len(normaliser(resultat["texte"]))
    del resultat["texte"]

    return resultat


def afficher_resultat(resultat):
    print()
    print(f"  ┌─ {resultat['fichier']}")

    nom = resultat["nom"] if resultat["nom"] else "— (non extrait)"
    print(f"  │  Nom        : {nom}")
    print(f"  │  Email      : {resultat['email'] or '—'}")
    print(f"  │  Téléphone  : {resultat['telephone'] or '—'}")

    if resultat["lisible"]:
        statut = f"lisible ({resultat['longueur_texte_normalise']} caractères normalisés)"
    else:
        statut = (
            f"ILLISIBLE ({resultat['longueur_texte_normalise']} caractères, "
            f"seuil {SEUIL_TEXTE_MINIMUM}) → à examiner manuellement"
        )
    print(f"  │  Statut     : {statut}")

    if resultat["score"] is None:
        print("  │  Score      : aucun — un document illisible n'est pas classé")
        print("  └─")
        return

    print(f"  │  Score      : {resultat['score']} / 100")
    if resultat["signalements"]:
        print(f"  │  Signalements : {', '.join(resultat['signalements'])}")

    print("  │")
    for ligne in resultat["detail"]:
        print(f"  │  {ligne['critere']} — {ligne['points']} / {ligne['poids']} pts")
        print(f"  │      Trouvés : {', '.join(ligne['trouves']) or '—'}")
        print(f"  │      Absents : {', '.join(ligne['absents']) or '—'}")
    print("  └─")


def partie_b_corpus():
    titre("PARTIE B — Le moteur sur le corpus, modèle « Développeur web »")

    fichiers = sorted(
        c for c in DOSSIER_CORPUS.iterdir() if c.suffix.lower() in (".pdf", ".docx")
    )

    if not fichiers:
        print("  Corpus vide. Lancer d'abord : ./venv/bin/python tests/generer_corpus.py")
        _echecs.append("corpus absent")
        return

    resultats = [analyser_fichier(chemin) for chemin in fichiers]

    for resultat in resultats:
        afficher_resultat(resultat)

    # ------------------------------------------------------------------
    # Classement
    # ------------------------------------------------------------------
    sous_titre("Classement (les illisibles sont à part, pas en dernier)")

    classes = sorted(
        (r for r in resultats if r["lisible"]),
        key=lambda r: r["score"],
        reverse=True,
    )
    illisibles = [r for r in resultats if not r["lisible"]]

    print(f"  {'Rang':<5} {'Score':<7} {'Candidat':<24} Fichier")
    for rang, resultat in enumerate(classes, start=1):
        nom = resultat["nom"] or "— (non extrait)"
        print(f"  {rang:<5} {resultat['score']:<7} {nom:<24} {resultat['fichier']}")

    print()
    print("  À examiner manuellement :")
    for resultat in illisibles:
        print(f"         —       {'':<24} {resultat['fichier']}")

    # ------------------------------------------------------------------
    # Vérifications
    # ------------------------------------------------------------------
    sous_titre("Vérifications du corpus")

    par_fichier = {r["fichier"]: r for r in resultats}

    def attendu(nom_fichier):
        resultat = par_fichier.get(nom_fichier)
        if resultat is None:
            _echecs.append(f"fichier absent : {nom_fichier}")
        return resultat

    # Cas 1 — chemin nominal
    cas = attendu("01_CV_Konan_Bernard.pdf")
    if cas:
        verifier("cas 1 — PDF texte lisible", cas["lisible"])
        verifier("cas 1 — nom extrait du document", cas["nom"] == "Konan Bernard", cas["nom"])
        verifier("cas 1 — email extrait", cas["email"] == "konan.bernard@example.ci", cas["email"])
        verifier("cas 1 — téléphone ivoirien extrait", cas["telephone"] is not None)
        verifier("cas 1 — score élevé (profil très proche)", cas["score"] >= 75, cas["score"])

    # Cas 2 — accents, prénom composé, tiret cadratin, accentuation décomposée
    cas = attendu("02_CV_Kouassi_Guy_Desire.pdf")
    if cas:
        verifier(
            "cas 2 — nom recomposé en NFC, tiret cadratin retiré, trait d'union gardé",
            cas["nom"] == "Kouassi Guy-Désiré",
            repr(cas["nom"]),
        )
        verifier(
            "cas 2 — « Développeur » trouvé par le mot-clé « developpeur »",
            "developpeur" in _trouves(cas, "Expérience terrain"),
            _trouves(cas, "Expérience terrain"),
        )

    # Cas 3 — scanné
    cas = attendu("03_CV_Traore_Aminata.pdf")
    if cas:
        verifier("cas 3 — PDF scanné détecté comme illisible", not cas["lisible"])
        verifier("cas 3 — aucun score attribué", cas["score"] is None, cas["score"])
        verifier("cas 3 — hors classement", cas not in classes)

    # Cas 4 — DOCX en tableaux
    cas = attendu("04_CV_Diabate_Fatoumata.docx")
    if cas:
        verifier(
            "cas 4 — DOCX en tableaux : le contenu des cellules est extrait",
            cas["lisible"],
        )
        verifier(
            "cas 4 — assez de texte pour un score réel",
            cas["score"] is not None and cas["score"] > 30,
            cas["score"],
        )

    # Cas 5 — DOCX en paragraphes
    cas = attendu("05_CV_Yao_Emmanuel.docx")
    if cas:
        verifier("cas 5 — DOCX en paragraphes lisible", cas["lisible"])
        verifier("cas 5 — nom extrait", cas["nom"] == "Yao Kouadio Emmanuel", cas["nom"])

    # Cas 6 — anglais
    cas = attendu("06_CV_Mensah_Kwame.pdf")
    if cas:
        verifier("cas 6 — CV anglais lisible", cas["lisible"])
        verifier(
            "cas 6 — les synonymes anglais fonctionnent (developer, bachelor)",
            "developpeur" in _trouves(cas, "Expérience terrain")
            and "licence" in _trouves(cas, "Formation"),
            f"{_trouves(cas, 'Expérience terrain')} / {_trouves(cas, 'Formation')}",
        )

    # Cas 7 — nom de fichier inexploitable
    cas = attendu("CVBR.pdf")
    if cas:
        verifier(
            "cas 7 — CVBR.pdf : le repli échoue proprement, nom = None",
            cas["nom"] is None,
            repr(cas["nom"]),
        )
        verifier("cas 7 — le document reste lisible et classé", cas["lisible"])

    # Cas 8 — nom de fichier exploitable
    cas = attendu("CV_Adjoua_Kouadio_2026.pdf")
    if cas:
        verifier(
            "cas 8 — repli sur le nom du fichier, année et préfixe CV écartés",
            cas["nom"] == "Adjoua Kouadio",
            repr(cas["nom"]),
        )

    # Cas 9 — sans coordonnées
    cas = attendu("09_CV_Ouattara_Salimata.pdf")
    if cas:
        verifier("cas 9 — email absent rendu comme None", cas["email"] is None, cas["email"])
        verifier("cas 9 — téléphone absent rendu comme None", cas["telephone"] is None)
        verifier(
            "cas 9 — LISIBLE malgré un score bas : deux états distincts",
            cas["lisible"] and cas["score"] is not None,
        )
        verifier("cas 9 — score bas (profil éloigné du poste)", cas["score"] < 30, cas["score"])

    # Vérifications d'ensemble
    verifier(
        "un seul document illisible dans le corpus",
        len(illisibles) == 1,
        len(illisibles),
    )
    verifier(
        "aucun illisible ne figure dans le classement",
        all(r["lisible"] for r in classes),
    )
    verifier(
        "tous les scores sont dans l'intervalle 0-100",
        all(0 <= r["score"] <= 100 for r in classes),
    )


def _trouves(resultat, nom_critere):
    """Retourne la liste des termes trouvés pour un critère donné."""
    for ligne in resultat.get("detail", []):
        if ligne["critere"] == nom_critere:
            return ligne["trouves"]
    return []


# ----------------------------------------------------------------------


def principal():
    titre("PARTIE A — Les trois corrections du moteur (lot 1)")
    partie_a_frontieres_de_mots()
    partie_a_accents()
    partie_a_normalisation_des_poids()
    partie_a_exclusions()

    partie_b_corpus()

    titre("RÉSULTAT DE LA PORTE P1")
    if _echecs:
        print(f"  {len(_echecs)} vérification(s) en échec :")
        for echec in _echecs:
            print(f"    - {echec}")
        print()
        print("  PORTE P1 NON FRANCHIE.")
        return 1

    print("  Toutes les vérifications passent.")
    print()
    print("  PORTE P1 FRANCHIE côté corpus synthétique.")
    print()
    print("  Il reste le second volet de la porte P1 (PROCESS §5.2) : vérifier")
    print("  que le classement reste crédible sur l'échantillon réel d'une")
    print("  dizaine de CV, conservé HORS du dépôt. Ce script ne peut pas le")
    print("  faire à ta place.")
    return 0


if __name__ == "__main__":
    sys.exit(principal())
