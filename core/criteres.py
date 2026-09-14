"""
Conversion entre la saisie de l'utilisateur et la structure du moteur.

Le scorer du lot 1 attend des critères déjà structurés (§7.2 du cadrage) :

    {"nom": "...", "poids": 35, "type": "requis",
     "groupes": [["react", "vue", "angular"]]}

L'interface, elle, ne peut proposer qu'une zone de texte. Ce module fait le
pont entre les deux, dans les deux sens. C'est sa seule responsabilité : il ne
calcule aucun score et ne lit aucun fichier.

POURQUOI UN MODULE À PART.

Ce pont aurait pu vivre dans `app.py`. Ce serait du code métier logé dans
l'interface : intestable sans navigateur, et perdu le jour où l'interface
change. Ici il est vérifiable en trois lignes de Python, et réutilisable.

LA RÈGLE DE SYNTAXE (décision du 14/09/2026).

Le cadrage §3 prévoyait un groupe par ligne, la maquette une liste plate
séparée par des virgules. Les deux sont conciliés par une règle unique :

    LE SIGNE « = » EST LA SEULE CHOSE QUI CRÉE UN GROUPE DE SYNONYMES.

Sans « = », chaque terme est un mot-clé indépendant, qu'il soit séparé par une
virgule ou par un retour à la ligne. Avec « = », le terme de gauche est le
terme principal et ceux de droite ses synonymes.

    python, javascript          ->  [python]  [javascript]
    react = vue, angular        ->  [react, vue, angular]

L'intérêt : celui qui tape une liste plate, comme le suggère la maquette,
obtient un comportement correct sans rien avoir à apprendre. Celui qui veut
des synonymes ajoute un « = ». Rien n'est perdu des deux côtés.
"""

SEPARATEUR_SYNONYMES = "="
SEPARATEUR_TERMES = ","


def analyser_mots_cles(texte):
    """
    Convertit la saisie de l'utilisateur en liste de groupes.

    Retourne une liste de listes de termes. Chaque groupe est trouvé dans un
    CV si au moins un de ses termes y figure (§7.3 du cadrage).

    La lecture est VOLONTAIREMENT TOLÉRANTE : espaces superflus, lignes
    vides, virgules en trop et doublons sont absorbés sans message d'erreur.
    Une zone de texte est un endroit où l'on tape vite ; refuser une saisie
    pour une virgule de trop serait hostile, et il n'y a ici aucun risque
    d'ambiguïté à corriger silencieusement.

        >>> analyser_mots_cles("python, javascript\\nreact = vue, angular")
        [['python'], ['javascript'], ['react', 'vue', 'angular']]
    """
    if not texte:
        return []

    groupes = []
    deja_vus = set()

    for ligne in texte.split("\n"):
        ligne = ligne.strip()
        if not ligne:
            continue

        if SEPARATEUR_SYNONYMES in ligne:
            # Un groupe de synonymes. On coupe sur le PREMIER « = »
            # seulement : un second signe sur la même ligne est une faute de
            # frappe, pas une intention, et le traiter comme un séparateur
            # produirait un groupe surprenant.
            principal, _, synonymes = ligne.partition(SEPARATEUR_SYNONYMES)
            termes = [principal] + synonymes.split(SEPARATEUR_TERMES)
            groupe = _nettoyer_termes(termes)
            if groupe:
                groupes.append(groupe)
        else:
            # Pas de « = » : chaque terme séparé par une virgule est un
            # mot-clé indépendant, donc son propre groupe.
            for terme in ligne.split(SEPARATEUR_TERMES):
                groupe = _nettoyer_termes([terme])
                if groupe:
                    groupes.append(groupe)

    # Retrait des groupes en double, en conservant l'ordre de saisie.
    # `dict.fromkeys` ne convient pas ici : une liste n'est pas hachable.
    uniques = []
    for groupe in groupes:
        empreinte = tuple(groupe)
        if empreinte not in deja_vus:
            deja_vus.add(empreinte)
            uniques.append(groupe)

    return uniques


def _nettoyer_termes(termes):
    """Retire les espaces autour de chaque terme et écarte les vides."""
    return [terme.strip() for terme in termes if terme.strip()]


def formater_mots_cles(groupes):
    """
    Opération inverse : reconstruit le texte à afficher dans la zone de
    saisie.

    Sert à pré-remplir le champ quand l'utilisateur choisit un modèle. Un
    groupe d'un seul terme donne une ligne nue, un groupe de plusieurs donne
    une ligne avec « = ».

        >>> formater_mots_cles([["python"], ["react", "vue"]])
        'python\\nreact = vue'

    Le texte produit n'est pas forcément identique au texte d'origine — une
    liste séparée par des virgules ressort sur plusieurs lignes — mais il a
    exactement le même SENS. C'est cette propriété-là qui est vérifiée dans
    tests/verifier_moteur.py, et c'est la seule qui compte.
    """
    lignes = []
    for groupe in groupes:
        if not groupe:
            continue
        if len(groupe) == 1:
            lignes.append(groupe[0])
        else:
            principal = groupe[0]
            synonymes = ", ".join(groupe[1:])
            lignes.append(f"{principal} {SEPARATEUR_SYNONYMES} {synonymes}")
    return "\n".join(lignes)


def construire_critere(nom, poids, mots_cles, type_critere="requis"):
    """
    Assemble un critère complet à partir de ce que l'interface a collecté.

    `mots_cles` est le contenu brut de la zone de texte. Le critère rendu est
    directement consommable par `core.scorer.scorer_candidat`.
    """
    return {
        "nom": (nom or "").strip(),
        "poids": poids,
        "type": type_critere,
        "groupes": analyser_mots_cles(mots_cles),
    }


def total_des_poids(criteres):
    """
    Somme des poids des critères REQUIS.

    Les critères d'exclusion en sont exclus : ils ne rapportent aucun point
    (§7.4 du cadrage), les compter fausserait l'indicateur « Poids attribués :
    85 / 100 » de l'étape 1.
    """
    return sum(
        critere.get("poids", 0)
        for critere in criteres
        if critere.get("type", "requis") == "requis"
    )


def criteres_incomplets(criteres):
    """
    Retourne le nom des critères requis qui ont un poids mais aucun mot-clé.

    Un tel critère consomme des points du total sans pouvoir jamais en
    rapporter : il abaisse mécaniquement tous les scores, sans que rien ne
    l'explique à l'écran. C'est une faute de saisie silencieuse, et l'endroit
    pour la signaler est l'interface — d'où cette fonction, qui se contente
    de la détecter sans rien afficher.
    """
    return [
        critere.get("nom", "")
        for critere in criteres
        if critere.get("type", "requis") == "requis"
        and critere.get("poids", 0) > 0
        and not critere.get("groupes")
    ]
