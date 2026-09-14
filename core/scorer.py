"""
Moteur de scoring.

Conforme au §7.2 à §7.6 du cadrage. Fonctions pures : les critères arrivent en
argument, rien n'est lu en base, rien n'est écrit, aucun import de streamlit.

C'est la différence de fond avec le scorer de RecrutPro, qui cachait une
requête SQL au milieu d'un calcul — ce qui le rendait intestable et non
réutilisable. Ici, mêmes entrées, mêmes sorties, toujours.

Structure d'un critère attendue en entrée (§7.2) :

    {
        "nom": "Langages & frameworks",
        "poids": 35,
        "type": "requis",          # ou "exclusion"
        "groupes": [
            ["python"],
            ["sql", "postgresql", "mysql", "base de donnees"],
            ["git", "github"],
        ],
    }

Un GROUPE correspond à une ligne saisie par l'utilisateur. Son premier terme
est le terme principal, les suivants sont ses synonymes. Le groupe compte pour
trouvé si AU MOINS UN de ses termes apparaît dans le CV.
"""

import re

from core.normalisation import normaliser

TYPE_REQUIS = "requis"
TYPE_EXCLUSION = "exclusion"


def terme_present(terme, texte_normalise):
    """
    Cherche un terme dans un texte déjà normalisé, en respectant les
    frontières de mots.

    C'EST LA CORRECTION DU BUG PRINCIPAL DE RECRUTPRO (§7.3 du cadrage).

    RecrutPro écrivait `terme in texte`. Cette écriture cherche une
    sous-chaîne n'importe où, y compris au milieu d'un autre mot :

        "r"  in "recrutement"   -> True   (le langage R dans tous les CV)
        "go" in "algorithme"    -> True
        "go" in "congo"         -> True

    Le motif `\\bterme\\b` corrige cela. `\\b` est une « frontière de mot » :
    une position où l'on passe d'un caractère de mot (lettre, chiffre,
    souligné) à autre chose, ou l'inverse. En l'encadrant des deux côtés, on
    exige que le terme soit un mot entier.

    Deux précautions :

    - `re.escape` neutralise les caractères que l'expression régulière
      interpréterait comme des symboles. Sans lui, un mot-clé « C++ »
      provoquerait une erreur de syntaxe, car « + » a un sens particulier.
      (En pratique la normalisation a déjà retiré la ponctuation, mais on ne
      dépend pas de ce détail.)

    - le terme est normalisé ici aussi. C'est la symétrie du §7.1 : les deux
      côtés de la comparaison subissent exactement le même traitement, donc
      « developpeur » trouve « Développeur » et réciproquement.

    Retourne True ou False. Un terme vide après normalisation retourne False.
    """
    terme_normalise = normaliser(terme)
    if not terme_normalise:
        return False

    motif = r"\b" + re.escape(terme_normalise) + r"\b"
    return re.search(motif, texte_normalise) is not None


def groupe_trouve(groupe, texte_normalise):
    """
    Un groupe est trouvé si au moins un de ses termes est présent.

    C'est ce qui règle le problème des candidats qui formulent autrement :
    « développeur », « developer » et « ingénieur logiciel » comptent pour la
    même chose.
    """
    return any(terme_present(terme, texte_normalise) for terme in groupe)


def evaluer_critere(critere, texte_normalise):
    """
    Évalue un seul critère et retourne son détail.

    Retourne un dictionnaire :

        {
            "critere": "Langages & frameworks",
            "poids": 35,
            "points": 21,            # arrondi, pour l'affichage
            "points_exacts": 21.25,  # non arrondi, pour le calcul du score
            "trouves": ["python", "git"],
            "absents": ["sql"],
        }

    Les listes `trouves` et `absents` contiennent le TERME PRINCIPAL de chaque
    groupe (son premier terme), tel que l'utilisateur l'a saisi, accents
    compris. C'est ce qu'il reconnaîtra dans le volet dépliable du §3.
    """
    groupes = [g for g in critere.get("groupes", []) if g]
    poids = critere.get("poids", 0)

    trouves = []
    absents = []

    for groupe in groupes:
        terme_principal = groupe[0]
        if groupe_trouve(groupe, texte_normalise):
            trouves.append(terme_principal)
        else:
            absents.append(terme_principal)

    # Un critère sans aucun groupe ne peut rien rapporter. On le traite
    # explicitement plutôt que de laisser une division par zéro se produire.
    if not groupes:
        ratio = 0.0
    else:
        ratio = len(trouves) / len(groupes)

    points_exacts = ratio * poids

    return {
        "critere": critere.get("nom", ""),
        "poids": poids,
        "points": round(points_exacts),
        "points_exacts": points_exacts,
        "trouves": trouves,
        "absents": absents,
    }


def scorer_candidat(texte_brut, criteres):
    """
    Calcule le score d'un candidat sur 100 et le détail par critère.

    `texte_brut` est le texte extrait du CV, tel que rendu par le parser.
    `criteres` est la liste des critères, structurés comme au §7.2.

    Retourne :

        {
            "score": 72,
            "signalements": ["Intérim"],
            "detail": [ ... un dictionnaire par critère requis ... ],
        }

    LA NORMALISATION PAR LE TOTAL DES POIDS (§7.4).

    C'est la troisième correction par rapport à RecrutPro, qui terminait par
    `return min(score_total, 100)`. Ce plafond a deux défauts.

    D'abord il écrase l'information : si l'utilisateur saisit des poids
    totalisant 150, tous les bons candidats sont ramenés à 100 et deviennent
    indistinguables. Le classement, qui est la seule raison d'être de l'outil,
    perd sa finesse exactement là où elle compte le plus — en haut du tableau.

    Ensuite il rend le score dépendant d'un détail de saisie : le même CV,
    avec les mêmes critères dans les mêmes proportions, obtient un score
    différent selon que les poids ont été écrits sur 50, sur 100 ou sur 200.

    Diviser par le total des poids règle les deux : le score est un
    POURCENTAGE DU MAXIMUM ATTEIGNABLE, donc toujours sur 100, quelle que soit
    la somme saisie.

    Détail d'implémentation : la somme se fait sur les points NON arrondis,
    puis on arrondit une seule fois à la fin. Arrondir chaque critère avant de
    sommer accumulerait les erreurs. En contrepartie, les points affichés dans
    le détail peuvent ne pas totaliser exactement le score — un écart d'un
    point au plus, sans conséquence sur le classement.

    LES CRITÈRES D'EXCLUSION n'ont aucun effet sur le score et ne retirent
    jamais un candidat du classement (garde-fou n°4 du §4). Ils produisent un
    signalement visible portant le nom du critère, et rien d'autre.
    """
    texte_normalise = normaliser(texte_brut)

    detail = []
    signalements = []
    total_poids = 0
    total_points = 0.0

    for critere in criteres:
        type_critere = critere.get("type", TYPE_REQUIS)

        if type_critere == TYPE_EXCLUSION:
            groupes = [g for g in critere.get("groupes", []) if g]
            if any(groupe_trouve(g, texte_normalise) for g in groupes):
                signalements.append(critere.get("nom", ""))
            continue

        evaluation = evaluer_critere(critere, texte_normalise)
        detail.append(evaluation)
        total_poids += evaluation["poids"]
        total_points += evaluation["points_exacts"]

    # Aucun critère requis, ou tous de poids nul : il n'y a pas de maximum
    # atteignable, donc pas de pourcentage calculable. On retourne 0 plutôt
    # que de laisser une division par zéro remonter jusqu'à l'interface.
    if total_poids <= 0:
        score = 0
    else:
        score = round(total_points / total_poids * 100)

    return {
        "score": score,
        "signalements": signalements,
        "detail": detail,
    }
