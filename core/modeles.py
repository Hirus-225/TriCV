"""
Les cinq modèles de critères pré-remplis.

Transcription du §8 du cadrage. Un formulaire vide fait fuir l'utilisateur :
ces cinq modèles couvrent l'essentiel du marché visé et donnent un point de
départ modifiable.

POURQUOI LES MOTS-CLÉS SONT STOCKÉS EN TEXTE, PAS EN GROUPES.

Chaque critère porte ses mots-clés sous la forme exacte que l'utilisateur
verra dans la zone de saisie, et `charger_modele` les convertit en groupes au
moment de l'usage. On aurait pu stocker directement les groupes, mais il
aurait alors fallu les reformater pour les afficher — et la moindre
divergence entre les deux écritures aurait produit un modèle qui ne score pas
ce qu'il montre. Ici, ce qui est affiché EST ce qui est scoré.

CONVENTION D'ÉCRITURE. Les mots-clés sont écrits sans accent, comme le
prescrit le §8 du cadrage. Cela n'a aucun effet sur le résultat : la
normalisation retire les accents des deux côtés de la comparaison, donc
« comptabilite generale » trouve « Comptabilité générale » et réciproquement.
C'est uniquement une convention d'écriture, modifiable sans rien casser.

Aucun modèle ne contient de critère d'exclusion : ceux-ci dépendent du
contexte de recrutement et sont ajoutés par l'utilisateur.
"""

from core.criteres import analyser_mots_cles, total_des_poids

# Les intitulés de la liste déroulante reprennent ceux de la maquette, qui
# sont des textes validés. « Logistique » n'y figurait pas et reprend le
# libellé du cadrage.
#
# L'ordre est celui d'affichage.
MODELES = {
    "Développeur web": [
        {
            "nom": "Langages & frameworks",
            "poids": 35,
            "mots_cles": (
                "python\n"
                "javascript = js\n"
                "django = flask\n"
                "react = vue, angular"
            ),
        },
        {
            "nom": "Bases de données",
            "poids": 20,
            "mots_cles": (
                "sql\n"
                "postgresql = postgres\n"
                "mysql\n"
                "mongodb = nosql"
            ),
        },
        {
            "nom": "Outils & versioning",
            "poids": 15,
            "mots_cles": (
                "git = github, gitlab\n"
                "docker\n"
                "linux"
            ),
        },
        {
            "nom": "Expérience terrain",
            "poids": 20,
            "mots_cles": (
                "developpeur = developer, ingenieur logiciel\n"
                "freelance\n"
                "stage"
            ),
        },
        {
            "nom": "Formation",
            "poids": 10,
            "mots_cles": (
                "licence = bachelor\n"
                "master\n"
                "informatique"
            ),
        },
    ],
    # Modèle « Comptable » — RECALIBRÉ LE 16/09/2026 SUR ÉCHANTILLON RÉEL.
    #
    # Les poids restent ceux du §8 du cadrage (35/25/20/20) : c'est le
    # jugement métier, il n'appartient pas au moteur de le corriger. Seuls
    # les MOTS-CLÉS ont changé, et pour une raison mesurée, pas ressentie.
    #
    # CE QUE L'ESSAI A MONTRÉ. Passés sur huit CV réels de comptables, quatre
    # des quinze mots-clés d'origine ne se déclenchaient JAMAIS — « grand
    # livre », « erp », « quickbooks », « aide comptable » — et
    # « comptabilite generale » une seule fois sur huit. Le critère le plus
    # lourd, 35 points, reposait en pratique sur un seul terme.
    #
    # LA CAUSE. Un mot-clé de plusieurs mots est une EXPRESSION EXACTE
    # (§7.3 : `\bterme\b`). Une offre d'emploi écrit « comptabilité
    # générale » ; un CV écrit « comptabilité analytique et générale », ou
    # « gestion de la comptabilité ». Les deux parlent de la même chose et ne
    # se rencontrent jamais. Même cause pour « aide comptable », que personne
    # ne s'attribue : on se dit « assistant comptable ».
    #
    # LA CORRECTION. Chaque groupe porte désormais un CONCEPT et ses
    # écritures usuelles, réunis par le signe « = ». Un mot-clé mort ne
    # mesure rien et abaisse tout le monde pareil ; un mot-clé présent chez
    # tous ne classe rien non plus. On vise donc, par critère, une ANCRE
    # présente chez tout comptable — elle écarte les profils hors métier —
    # et des groupes plus rares qui, eux, ordonnent les comptables entre eux.
    #
    # LE CINQUIÈME GROUPE, « manuel de procédure », suit la même logique que
    # « rapprochement bancaire » : une mission concrète et vérifiable, qui
    # distingue un comptable qui a formalisé l'organisation comptable d'un
    # comptable qui a seulement tenu les comptes. Écrit en expression exacte,
    # « manuel de procedure » ne se déclenchait sur AUCUN des huit CV réels ;
    # le concept, lui, y figure trois fois, sous les formes « procédures
    # comptables », « procédures de gestion » et « procédures » tout court.
    # Le groupe porte donc ces écritures-là, faute de quoi il aurait rejoint
    # les mots morts qu'on vient de retirer.
    #
    # LIMITE ASSUMÉE. Ce réglage s'appuie sur huit CV. C'est assez pour voir
    # qu'un mot-clé est mort, pas pour prétendre à une mesure fine. Les mots
    # retenus sont ceux qui ont un sens pour le métier, pas ceux qui
    # séparaient joliment cet échantillon-là.
    "Comptable": [
        {
            "nom": "Comptabilité générale",
            "poids": 35,
            "mots_cles": (
                "comptabilite generale = comptabilite analytique, "
                "ecritures comptables, saisie comptable\n"
                "rapprochement bancaire = rapprochements bancaires\n"
                "etats financiers = etat financier, bilan, compte de resultat, "
                "balance generale\n"
                "syscohada = ohada, syscoa\n"
                "manuel de procedure = manuel de procedures, "
                "procedures comptables, procedures de gestion, procedures, "
                "procedure"
            ),
        },
        {
            "nom": "Fiscalité & déclarations",
            "poids": 25,
            "mots_cles": (
                "fiscalite = fiscal, fiscale, fiscales, fiscaux\n"
                "tva\n"
                "declaration fiscale = declarations fiscales, "
                "declaration d'impots\n"
                "cnps = charges sociales, cotisations sociales"
            ),
        },
        {
            "nom": "Outils",
            "poids": 20,
            "mots_cles": (
                "sage = saari, sage 100\n"
                "excel = tableur\n"
                "erp = sap, dynamics, odoo, tompro, oracle"
            ),
        },
        {
            "nom": "Expérience",
            "poids": 20,
            "mots_cles": (
                "comptable\n"
                "chef comptable = comptable senior, responsable comptable, "
                "directeur financier\n"
                "cabinet = cabinet comptable, cabinet d'expertise\n"
                "audit = controle de gestion, controle interne, "
                "commissariat aux comptes"
            ),
        },
    ],
    "Assistant administratif": [
        {
            "nom": "Administration",
            "poids": 30,
            "mots_cles": (
                "gestion administrative\n"
                "courrier\n"
                "archivage\n"
                "agenda = planning"
            ),
        },
        {
            "nom": "Ressources humaines",
            "poids": 30,
            "mots_cles": (
                "recrutement\n"
                "paie = salaire, payroll\n"
                "contrat de travail\n"
                "dossier du personnel"
            ),
        },
        {
            "nom": "Bureautique",
            "poids": 20,
            "mots_cles": (
                "word\n"
                "excel\n"
                "powerpoint\n"
                "outlook"
            ),
        },
        {
            "nom": "Qualités & langues",
            "poids": 20,
            "mots_cles": (
                "anglais\n"
                "redaction\n"
                "organisation"
            ),
        },
    ],
    "Commercial terrain": [
        {
            "nom": "Développement commercial",
            "poids": 35,
            "mots_cles": (
                "prospection\n"
                "negociation\n"
                "portefeuille client\n"
                "chiffre d'affaires"
            ),
        },
        {
            "nom": "Relation client",
            "poids": 25,
            "mots_cles": (
                "relation client = service client\n"
                "fidelisation\n"
                "reclamation"
            ),
        },
        {
            "nom": "Outils",
            "poids": 15,
            "mots_cles": (
                "crm\n"
                "salesforce\n"
                "excel\n"
                "reporting"
            ),
        },
        {
            "nom": "Expérience",
            "poids": 25,
            "mots_cles": (
                "commercial\n"
                "charge de clientele\n"
                "terrain"
            ),
        },
    ],
    "Logistique": [
        {
            "nom": "Gestion des flux",
            "poids": 35,
            "mots_cles": (
                "approvisionnement\n"
                "stock = inventaire\n"
                "transit\n"
                "douane"
            ),
        },
        {
            "nom": "Transport",
            "poids": 25,
            "mots_cles": (
                "transport\n"
                "fret\n"
                "import = export\n"
                "incoterms"
            ),
        },
        {
            "nom": "Outils",
            "poids": 20,
            "mots_cles": (
                "erp\n"
                "sap\n"
                "excel\n"
                "wms"
            ),
        },
        {
            "nom": "Expérience",
            "poids": 20,
            "mots_cles": (
                "logistique\n"
                "supply chain\n"
                "magasinier"
            ),
        },
    ],
}

# Ce que la liste déroulante affiche en premier, avant tout choix. Le libellé
# vient de la maquette.
LIBELLE_AUCUN_MODELE = "— Choisir un modèle —"


def noms_des_modeles():
    """Les intitulés des modèles, dans l'ordre d'affichage."""
    return list(MODELES)


def charger_modele(nom_du_modele):
    """
    Retourne les critères d'un modèle, prêts pour le scorer ET pour
    l'affichage.

    Chaque critère rendu porte :
      - `nom`, `poids`, `type` ;
      - `mots_cles`, le texte à afficher dans la zone de saisie ;
      - `groupes`, la structure que consomme `scorer_candidat`.

    Les dictionnaires rendus sont des COPIES. Sans cela, l'interface
    modifierait `MODELES` en place et le modèle suivant serait servi altéré —
    un bug déroutant, parce que rien dans le code n'aurait l'air d'écrire
    dans la constante.

    Lève `KeyError` si le modèle n'existe pas : c'est une faute de
    programmation, pas une saisie utilisateur, et elle doit être bruyante.
    """
    return [
        {
            "nom": critere["nom"],
            "poids": critere["poids"],
            "type": "requis",
            "mots_cles": critere["mots_cles"],
            "groupes": analyser_mots_cles(critere["mots_cles"]),
        }
        for critere in MODELES[nom_du_modele]
    ]


def total_des_poids_du_modele(nom_du_modele):
    """Somme des poids d'un modèle. Doit valoir 100 pour les cinq."""
    return total_des_poids(charger_modele(nom_du_modele))
