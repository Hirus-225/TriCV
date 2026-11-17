"""Résultats de référence pour la version JavaScript (dossier web/).

Fait tourner le moteur de `core/` — celui qui est en production — sur une série
de cas, et écrit en JSON tout ce que la version JavaScript doit reproduire à
l'identique. La page `web/tests/tests.html` relit ces fichiers, rejoue les mêmes
calculs en JavaScript, et affiche une ligne par comparaison.

C'est ce qui distingue une migration vérifiée d'un « ça a l'air de marcher » :
la référence n'est pas une opinion sur ce que le code devrait faire, c'est ce
que le code FAIT aujourd'hui, enregistré avant d'y toucher.

    ./venv/bin/python tests/generer_reference_js.py
    ./venv/bin/python tests/generer_reference_js.py --sortie web/tests/reference

Les fichiers produits sont versionnés, contrairement à ceux du projet
Rapprochement Bancaire : ici, aucun cas ne contient de donnée réelle. Ce sont
des phrases écrites à la main et les cinq modèles du §8 du cadrage.

ÉTAT D'AVANCEMENT. Étape E3 : le moteur pur — arrondi, normalisation, syntaxe
des mots-clés, modèles, scoring, outils d'affichage. La lecture des fichiers (PDF, DOCX, extraction
du nom, de l'email et du téléphone) s'ajoutera à l'étape E4.
"""

import argparse
import json
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE))

from core.criteres import (  # noqa: E402
    analyser_mots_cles,
    construire_critere,
    criteres_incomplets,
    formater_mots_cles,
    total_des_poids,
)
from core.modeles import MODELES, charger_modele, noms_des_modeles  # noqa: E402
from core.normalisation import normaliser, recomposer, supprimer_accents  # noqa: E402
from core.scorer import scorer_candidat  # noqa: E402

SORTIE_PAR_DEFAUT = RACINE / "web" / "tests" / "reference"


# ----------------------------------------------------------------------
# 1. Arrondi
# ----------------------------------------------------------------------

# Python arrondit « à l'entier pair » quand la valeur tombe pile sur un demi ;
# JavaScript arrondit toujours vers le haut. Ces valeurs sont choisies pour que
# la moitié d'entre elles distinguent les deux comportements : si la version JS
# employait Math.round, la page de tests virerait au rouge ici.
VALEURS_ARRONDI = [
    0.0, 0.4, 0.5, 0.6, 1.5, 2.5, 3.5, 4.5,
    12.5, 17.5, 21.25, 37.5, 49.5, 50.5, 72.5, 99.5,
    -0.5, -1.5, -2.5, -12.5,
    0.49999999999999994,  # juste en dessous d'un demi, en binaire
    2.675, 100.0,
]


def reference_arrondi():
    return [{"valeur": v, "attendu": round(v)} for v in VALEURS_ARRONDI]


# ----------------------------------------------------------------------
# 2. Normalisation
# ----------------------------------------------------------------------

TEXTES_NORMALISATION = [
    "",
    "python",
    "PYTHON",
    "Développeur",
    "Developpeur",
    # Le même mot écrit en Unicode décomposé : « e » suivi d'un accent aigu
    # combinant. C'est la forme que rendent souvent les extracteurs de PDF, et
    # la cause du « Kouassi Guy-De´sire´ » de RecrutPro.
    "Développeur",
    "Kouassi Guy-Désiré",
    "C++/Python",
    "C#, .NET et F#",
    "Node.js / React.js",
    "  espaces   multiples  ",
    "espace insecable",          # U+00A0
    "tabulation\tet\nretour",
    "separateur\x1fde\x1funite",      # \s en Python, pas en JavaScript
    "ligne\x85suivante",              # NEL : \s en Python, pas en JavaScript
    "﻿marque d'ordre des octets",  # \s en JavaScript, pas en Python
    "Œuvre, cœur et €uro",
    "ÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸ",
    "Maître d'œuvre — 10 ans d'expérience",
    "SYSCOHADA / OHADA",
    "l'entreprise",
    "N'Guessan Kouamé",
    "comptabilité générale",
    "100 % · 5 Mo · 40 fichiers",
    "Ligature ﬁchier et ﬂux",
]


def reference_normalisation():
    return [
        {
            "entree": texte,
            "recompose": recomposer(texte),
            "sansAccents": supprimer_accents(texte),
            "normalise": normaliser(texte),
        }
        for texte in TEXTES_NORMALISATION
    ]


# ----------------------------------------------------------------------
# 3. Syntaxe des mots-clés
# ----------------------------------------------------------------------

SAISIES = [
    # Les cinq cas du C1 de verifier_moteur.py.
    "python",
    "python, javascript",
    "python\njavascript",
    "react = vue, angular",
    "python, javascript\nreact = vue, angular",
    # Tolérance de saisie (C2).
    "  python  ,  django  ",
    "python,,\n\n  \ndjango,",
    "python\npython",
    "a = b = c",
    "",
    # Cas limites supplémentaires.
    "   ",
    "=",
    "= vue, angular",
    "react =",
    "react = ",
    ",,,",
    "\n\n\n",
    "Développeur = Developer",
    "chef comptable = comptable senior, responsable comptable, directeur financier",
    "un terme avec des espaces",
    "A, B\nA, B",
    "python\n  python  ",
]


def reference_criteres():
    analyse = [
        {"saisie": saisie, "groupes": analyser_mots_cles(saisie)} for saisie in SAISIES
    ]

    # Aller-retour : texte -> groupes -> texte -> groupes. Le texte reformaté
    # n'est pas forcément identique à l'original, mais il doit avoir le même
    # SENS. C'est ce qui garantit qu'un modèle affiché dans la zone de saisie
    # score bien ce qu'il montre.
    aller_retour = []
    for nom_modele in noms_des_modeles():
        for critere in charger_modele(nom_modele):
            groupes = critere["groupes"]
            texte = formater_mots_cles(groupes)
            aller_retour.append({
                "modele": nom_modele,
                "critere": critere["nom"],
                "groupes": groupes,
                "formate": texte,
                "groupesApresRetour": analyser_mots_cles(texte),
            })

    # `construire_critere` : ce que l'interface collecte -> ce que le moteur
    # consomme. Le nom est débarrassé de ses espaces, le type suit.
    construction = [
        {
            "entree": {"nom": nom, "poids": poids, "motsCles": mots, "type": type_c},
            "critere": construire_critere(nom, poids, mots, type_c),
        }
        for nom, poids, mots, type_c in [
            ("  Langages  ", 35, "python, java", "requis"),
            ("", 0, "", "requis"),
            ("Intérim", 0, "interim = mission temporaire", "exclusion"),
            ("Sans mot-clé", 20, "   ", "requis"),
        ]
    ]

    # `total_des_poids` ignore les critères d'exclusion, et `criteres_incomplets`
    # repère ceux qui ont un poids mais aucun mot-clé.
    jeux_de_criteres = [
        [],
        [{"nom": "A", "poids": 35, "type": "requis", "groupes": [["x"]]}],
        [
            {"nom": "A", "poids": 35, "type": "requis", "groupes": [["x"]]},
            {"nom": "B", "poids": 20, "type": "exclusion", "groupes": [["y"]]},
        ],
        [
            {"nom": "A", "poids": 50, "type": "requis", "groupes": []},
            {"nom": "", "poids": 30, "type": "requis", "groupes": []},
            {"nom": "C", "poids": 0, "type": "requis", "groupes": []},
            {"nom": "D", "poids": 20, "type": "requis", "groupes": [["z"]]},
        ],
    ]
    indicateurs = [
        {
            "criteres": criteres,
            "total": total_des_poids(criteres),
            "incomplets": criteres_incomplets(criteres),
        }
        for criteres in jeux_de_criteres
    ]

    return {
        "analyse": analyse,
        "allerRetour": aller_retour,
        "construction": construction,
        "indicateurs": indicateurs,
    }


# ----------------------------------------------------------------------
# 4. Les cinq modèles
# ----------------------------------------------------------------------


def reference_modeles():
    """Le contenu intégral des cinq modèles.

    C'est ce qui attrape une faute de frappe dans la transposition de
    web/js/modeles.js : un mot-clé mal recopié change les groupes, donc les
    scores, et rien à l'écran ne le signalerait.
    """
    return {
        "ordre": noms_des_modeles(),
        "modeles": {
            nom: {
                "criteres": [
                    {
                        "nom": critere["nom"],
                        "poids": critere["poids"],
                        "type": critere["type"],
                        "motsCles": critere["mots_cles"],
                        "groupes": critere["groupes"],
                    }
                    for critere in charger_modele(nom)
                ],
                "total": total_des_poids(charger_modele(nom)),
                "nbGroupes": sum(len(c["groupes"]) for c in charger_modele(nom)),
            }
            for nom in noms_des_modeles()
        },
        "nbModeles": len(MODELES),
    }


# ----------------------------------------------------------------------
# 5. Scoring
# ----------------------------------------------------------------------

# Le texte du A4 de verifier_moteur.py : un profil complet qui déclenche aussi
# une règle d'exclusion.
TEXTE_COMPLET = (
    "Developpeur Python, Django, React, JavaScript. "
    "SQL, PostgreSQL, MySQL, MongoDB. Git, Docker, Linux. "
    "Freelance. Licence en informatique. "
    "Je recherche un stage de fin de cycle."
)

MODELE_DEV = charger_modele("Développeur web")

CAS_SCORING = [
    # A1 — frontières de mots. Aucun des trois termes courts ne doit être
    # trouvé à l'intérieur d'un autre mot.
    {
        "intitule": "A1 — frontières de mots",
        "texte": "Algorithme de recrutement. Mission au Congo et en Angola.",
        "criteres": [
            {"nom": "Courts", "poids": 100, "type": "requis",
             "groupes": [["r"], ["go"], ["c"], ["python"]]},
        ],
    },
    {
        "intitule": "A1 — un mot-clé d'une lettre reste trouvable seul",
        "texte": "Je programme en R et en Python.",
        "criteres": [
            {"nom": "Courts", "poids": 100, "type": "requis",
             "groupes": [["r"], ["python"], ["go"]]},
        ],
    },
    # A2 — accents des deux côtés.
    {
        "intitule": "A2 — mot-clé sans accent, CV accentué",
        "texte": "Développeur back-end, spécialisé en modélisation.",
        "criteres": [
            {"nom": "Accents", "poids": 50, "type": "requis",
             "groupes": [["developpeur"], ["modelisation"], ["specialise"]]},
        ],
    },
    {
        "intitule": "A2 — mot-clé accentué, CV sans accent",
        "texte": "Developpeur back-end, specialise en modelisation.",
        "criteres": [
            {"nom": "Accents", "poids": 50, "type": "requis",
             "groupes": [["développeur"], ["modélisation"]]},
        ],
    },
    # A3 — poids totalisant 150, puis les mêmes proportions sur 15.
    {
        "intitule": "A3 — poids 150, CV complet",
        "texte": "python sql git",
        "criteres": [
            {"nom": "A", "poids": 100, "type": "requis", "groupes": [["python"], ["sql"]]},
            {"nom": "B", "poids": 50, "type": "requis", "groupes": [["git"]]},
        ],
    },
    {
        "intitule": "A3 — poids 150, CV partiel",
        "texte": "python sql",
        "criteres": [
            {"nom": "A", "poids": 100, "type": "requis", "groupes": [["python"], ["sql"]]},
            {"nom": "B", "poids": 50, "type": "requis", "groupes": [["git"]]},
        ],
    },
    {
        "intitule": "A3 — poids 150, CV faible",
        "texte": "python",
        "criteres": [
            {"nom": "A", "poids": 100, "type": "requis", "groupes": [["python"], ["sql"]]},
            {"nom": "B", "poids": 50, "type": "requis", "groupes": [["git"]]},
        ],
    },
    {
        "intitule": "A3 — mêmes proportions sur 15, même score",
        "texte": "python sql",
        "criteres": [
            {"nom": "A", "poids": 10, "type": "requis", "groupes": [["python"], ["sql"]]},
            {"nom": "B", "poids": 5, "type": "requis", "groupes": [["git"]]},
        ],
    },
    # A4 — exclusion : signalement, sans effet sur le score.
    {
        "intitule": "A4 — avec critère d'exclusion",
        "texte": TEXTE_COMPLET,
        "criteres": MODELE_DEV + [
            {"nom": "Recherche un stage", "poids": 0, "type": "exclusion",
             "groupes": [["recherche un stage"], ["interim"]]},
        ],
    },
    {
        "intitule": "A4 — sans critère d'exclusion",
        "texte": TEXTE_COMPLET,
        "criteres": MODELE_DEV,
    },
    # L'ARRONDI, DANS LE SCORER. Un critère de poids 25 dont un groupe sur deux
    # est trouvé vaut 12,5 points : Python affiche 12, un Math.round naïf
    # afficherait 13. Le second cas déplace la divergence sur le score global.
    {
        "intitule": "arrondi — 12,5 points affichés",
        "texte": "python",
        "criteres": [
            {"nom": "A", "poids": 25, "type": "requis", "groupes": [["python"], ["sql"]]},
        ],
    },
    {
        "intitule": "arrondi — score global à 12,5 %",
        "texte": "python",
        "criteres": [
            {"nom": "A", "poids": 5, "type": "requis", "groupes": [["python"], ["sql"]]},
            {"nom": "B", "poids": 15, "type": "requis", "groupes": [["git"]]},
        ],
    },
    # Cas dégénérés : aucun critère, poids nuls, critère sans groupe.
    {"intitule": "aucun critère", "texte": "python", "criteres": []},
    {
        "intitule": "tous les poids à zéro",
        "texte": "python",
        "criteres": [{"nom": "A", "poids": 0, "type": "requis", "groupes": [["python"]]}],
    },
    {
        "intitule": "critère avec un poids mais aucun groupe",
        "texte": "python",
        "criteres": [
            {"nom": "A", "poids": 50, "type": "requis", "groupes": []},
            {"nom": "B", "poids": 50, "type": "requis", "groupes": [["python"]]},
        ],
    },
    {
        "intitule": "texte vide",
        "texte": "",
        "criteres": MODELE_DEV,
    },
    {
        "intitule": "groupe de synonymes — un seul terme suffit",
        "texte": "Je maîtrise Angular.",
        "criteres": [
            {"nom": "Front", "poids": 40, "type": "requis",
             "groupes": [["react", "vue", "angular"]]},
        ],
    },
    {
        "intitule": "exclusion seule, sans aucun critère requis",
        "texte": "Mission en interim.",
        "criteres": [
            {"nom": "Intérim", "poids": 0, "type": "exclusion", "groupes": [["interim"]]},
        ],
    },
    {
        "intitule": "modèle Comptable sur un profil de comptable",
        "texte": (
            "Chef comptable. Comptabilite generale et analytique, ecritures "
            "comptables. Rapprochement bancaire mensuel. Etats financiers et "
            "bilan. SYSCOHADA. Procedures comptables. Fiscalite, TVA, "
            "declarations fiscales, CNPS. Sage 100 et Excel. Cabinet "
            "d'expertise, controle interne."
        ),
        "criteres": charger_modele("Comptable"),
    },
]


def reference_scoring():
    return [
        {
            "intitule": cas["intitule"],
            "texte": cas["texte"],
            "criteres": cas["criteres"],
            "resultat": scorer_candidat(cas["texte"], cas["criteres"]),
        }
        for cas in CAS_SCORING
    ]


# ----------------------------------------------------------------------
# 6. Outils d'affichage
# ----------------------------------------------------------------------
#
# `accorder`, `nombre_francais` et `_formater_taille` vivent dans app.py, qui
# importe streamlit et exécute la page entière à l'import : on ne peut pas s'en
# servir ici. Leurs formules sont donc RETRANSCRITES ci-dessous, et c'est
# voulu — même procédé que SECTION_8_DEVELOPPEUR_WEB dans verifier_moteur.py.
# Si les deux transcriptions divergent un jour, c'est qu'au moins l'une des
# deux est fausse, et c'est exactement ce qu'on veut détecter.


def _accorder(nombre, singulier, pluriel=None):
    if pluriel is None:
        pluriel = singulier + "s"
    return f"{nombre} {singulier if abs(nombre) <= 1 else pluriel}"


def _nombre_francais(valeur, decimales=1):
    return f"{valeur:.{decimales}f}".replace(".", ",")


def _formater_taille(octets):
    if octets is None:
        return "—"
    if octets >= 1_048_576:
        return f"{_nombre_francais(octets / 1_048_576)} Mo"
    return f"{octets / 1024:.0f} Ko"


CAS_ACCORD = [
    (0, "fichier déposé", "fichiers déposés"),
    (1, "fichier déposé", "fichiers déposés"),
    (2, "fichier déposé", "fichiers déposés"),
    (40, "fichier déposé", "fichiers déposés"),
    (1, "candidat classé", "candidats classés"),
    (12, "candidat classé", "candidats classés"),
    (1, "groupe de recherche", "groupes de recherche"),
    (3, "groupe de recherche", "groupes de recherche"),
    (1, "règle", None),
    (4, "règle", None),
    (0, "CV", "CV"),
    (1, "CV", "CV"),
]

# Les valeurs qui tombent PILE sur un demi sont ici à dessein : c'est là que
# `toFixed` de JavaScript et le formatage de Python divergent si l'on n'y
# prend pas garde.
CAS_NOMBRE = [
    (0.0, 1), (0.3, 1), (1.0, 1), (12.34, 1), (0.05, 1), (0.15, 1),
    (0.25, 1), (0.75, 1), (1.25, 1), (2.675, 2), (1.005, 2),
    (0.5, 0), (1.5, 0), (2.5, 0), (3.5, 0), (12.5, 0), (49.99, 2),
]

CAS_TAILLE = [
    None, 0, 1, 512, 1024, 1536, 2560, 500_000, 1_048_575,
    1_048_576, 1_310_720, 2_621_440, 3_670_016, 5_242_880,
]


def reference_formatage():
    return {
        "accord": [
            {
                "nombre": nombre,
                "singulier": singulier,
                "pluriel": pluriel,
                "attendu": _accorder(nombre, singulier, pluriel),
            }
            for nombre, singulier, pluriel in CAS_ACCORD
        ],
        "nombre": [
            {"valeur": valeur, "decimales": decimales,
             "attendu": _nombre_francais(valeur, decimales)}
            for valeur, decimales in CAS_NOMBRE
        ],
        "taille": [
            {"octets": octets, "attendu": _formater_taille(octets)}
            for octets in CAS_TAILLE
        ],
    }


# ----------------------------------------------------------------------
# Écriture
# ----------------------------------------------------------------------


def ecrire(dossier, nom, contenu):
    chemin = dossier / nom
    chemin.write_text(
        json.dumps(contenu, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return chemin


def main():
    analyseur = argparse.ArgumentParser(description=__doc__)
    analyseur.add_argument(
        "--sortie",
        default=str(SORTIE_PAR_DEFAUT),
        help="dossier où écrire les fichiers JSON",
    )
    arguments = analyseur.parse_args()

    dossier = Path(arguments.sortie)
    dossier.mkdir(parents=True, exist_ok=True)

    fichiers = {
        "arrondi.json": reference_arrondi(),
        "normalisation.json": reference_normalisation(),
        "criteres.json": reference_criteres(),
        "modeles.json": reference_modeles(),
        "scoring.json": reference_scoring(),
        "formatage.json": reference_formatage(),
    }

    for nom, contenu in fichiers.items():
        chemin = ecrire(dossier, nom, contenu)
        print(f"  {chemin.relative_to(RACINE)}")

    print()
    print(f"{len(fichiers)} fichiers de référence écrits.")
    print("Ouvrir ensuite web/tests/tests.html pour comparer la version JavaScript.")


if __name__ == "__main__":
    main()
