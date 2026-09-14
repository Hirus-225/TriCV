"""
Extraction du texte et des informations candidat, depuis un OBJET MÉMOIRE.

Conforme aux §7.5, §7.7 et §7.8 du cadrage.

POURQUOI UN OBJET MÉMOIRE ET JAMAIS UN CHEMIN.

`st.file_uploader` rend un objet fichier déjà chargé en mémoire vive.
`pdfplumber.open()` et `docx.Document()` acceptent tous deux un tel objet à la
place d'un chemin. En les alimentant directement, on n'a JAMAIS besoin d'écrire
le CV sur le disque — et il n'y a donc jamais rien à supprimer. C'est la
règle n°1 du §5 du cadrage, et c'est ce qui rend la promesse vraie par
construction plutôt que par procédure de nettoyage.

Aucune fonction de ce module n'ouvre de chemin, n'écrit de fichier, ni
n'imprime de texte extrait. Aucun import de streamlit.
"""

import re
import unicodedata
from pathlib import PurePath

import pdfplumber
from docx import Document

from core.normalisation import normaliser, recomposer

# ----------------------------------------------------------------------
# Seuil de lisibilité (§7.5)
# ----------------------------------------------------------------------

# En dessous de ce nombre de caractères APRÈS normalisation, on considère que
# l'extraction a échoué : le document est presque certainement un scan, une
# image sans couche texte.
#
# « Illisible » et « score de 0 » sont deux états DISTINCTS, et les confondre
# est précisément le défaut que cette détection corrige. Un CV illisible n'a
# pas de score du tout : il sort du classement et rejoint la section
# « À examiner manuellement ». Lui attribuer 0 le placerait en dernière
# position, ce qui affirmerait à tort qu'il ne correspond pas au poste.
SEUIL_TEXTE_MINIMUM = 100


# ----------------------------------------------------------------------
# Expressions régulières
# ----------------------------------------------------------------------

_MOTIF_EMAIL = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")

# Formats ivoiriens. Les numéros comportent dix chiffres et commencent par
# 01, 05, 07 (mobiles) ou 25, 27 (fixes), avec un indicatif +225 facultatif,
# éventuellement entre parenthèses, et des séparateurs variables.
#
#   +225 07 58 41 22 96   (+225) 0758412296   07.58.41.22.96   0758412296
#
# `(?<!\d)` et `(?!\d)` empêchent d'attraper une tranche au milieu d'un nombre
# plus long (un numéro de compte, une référence).
_MOTIF_TELEPHONE = re.compile(
    r"(?<!\d)"
    r"(?:\(?\+\s?225\)?[\s.\-]*)?"     # indicatif facultatif
    r"(?:0[1257])"                     # préfixe opérateur
    r"(?:[\s.\-]?\d{2}){4}"            # quatre paires de chiffres
    r"(?!\d)"
)

# Ponctuation parasite en tête de ligne : tirets cadratins et demi-cadratins,
# puces, chevrons, astérisques, points. C'est ce qui avait donné
# « — Kouassi Guy-Désiré » dans RecrutPro.
_PONCTUATION_INITIALE = re.compile(r"^[\s\-‐-―•·*>|:.,;_]+")

_ESPACES_MULTIPLES = re.compile(r"[ \t ]+")


# ----------------------------------------------------------------------
# Intitulés de sections : des lignes qui ressemblent à un nom sans en être un
# ----------------------------------------------------------------------

# « CURRICULUM VITAE », « PROFIL PROFESSIONNEL » ou « EXPÉRIENCE
# PROFESSIONNELLE » passent tous les tests d'un nom naïf : deux mots, rien que
# des lettres. Sans cette liste, l'heuristique retournerait l'intitulé de la
# première section au lieu d'un nom, et le repli sur le nom du fichier ne
# serait jamais atteint.
#
# Les mots sont écrits sans accent : ils sont comparés à du texte normalisé.
_MOTS_DE_SECTION = {
    "curriculum", "vitae", "cv", "resume", "summary",
    "profil", "profile", "professionnel", "professionnelle", "professional",
    "experience", "experiences", "parcours", "emploi", "emplois", "carriere",
    "competence", "competences", "competency", "skills", "aptitudes",
    "formation", "formations", "education", "diplome", "diplomes", "etudes",
    "contact", "contacts", "coordonnees", "adresse", "informations",
    "personnelles", "personnel", "etat", "civil", "identite",
    "langue", "langues", "languages", "interets", "loisirs", "centres",
    "reference", "references", "divers", "objectif", "objective",
    "stage", "stages", "projet", "projets", "projects", "realisations",
    "candidature", "motivation", "lettre", "poste", "technique", "techniques",
    "certifications", "distinctions", "publications", "benevolat",
}

# Mots à écarter d'un NOM DE FICHIER avant d'en dériver un nom de candidat.
_MOTS_DE_FICHIER_A_IGNORER = {
    "cv", "curriculum", "vitae", "resume", "candidature", "lettre",
    "motivation", "dossier", "document", "copie", "scan", "final", "finale",
    "def", "definitif", "nouveau", "nouvelle", "version", "mise", "jour",
    "rh", "drh", "dev", "stage", "poste", "pdf", "docx", "doc", "word",
    "mon", "ma", "mes", "le", "la", "les", "de", "du", "des", "of", "the",
}

# Longueur minimale d'un fragment de nom de fichier pour être retenu comme
# partie d'un nom. Écarte « RH », « de », « v2 » sans écarter de vrais noms :
# les patronymes de moins de trois lettres sont rarissimes.
_LONGUEUR_MINIMALE_FRAGMENT = 3


# ----------------------------------------------------------------------
# Nettoyage du texte extrait
# ----------------------------------------------------------------------


def nettoyer_texte(texte):
    """
    Remet en forme le texte sorti de l'extracteur, sans en altérer le sens.

    Trois opérations :

    1. RECOMPOSITION NFC. Les extracteurs de PDF rendent fréquemment les
       accents décomposés : « é » arrive sous la forme « e » suivi d'un accent
       aigu combinant. NFC les recolle. Sans cette étape, l'heuristique du nom
       rejette « Guy-Désiré », parce que l'accent isolé n'est pas une lettre.

    2. NETTOYAGE DE LA PONCTUATION EN TÊTE DE LIGNE. Les puces et les tirets
       cadratins de mise en page se retrouvent collés au texte. C'est la
       seconde moitié du défaut documenté au §5.1.3 de PROCESS : le nom extrait
       était « — Kouassi Guy-Désiré », tiret compris.

    3. RÉDUCTION DES ESPACES. Les PDF produisent souvent de longues séries
       d'espaces là où il y avait un alignement en colonnes.

    Les lignes vides sont conservées : elles séparent les sections, et
    l'heuristique du nom raisonne sur les premières lignes NON vides.
    """
    if not texte:
        return ""

    texte = recomposer(texte)
    texte = texte.replace("\r\n", "\n").replace("\r", "\n")

    lignes_propres = []
    for ligne in texte.split("\n"):
        ligne = _PONCTUATION_INITIALE.sub("", ligne)
        ligne = _ESPACES_MULTIPLES.sub(" ", ligne)
        lignes_propres.append(ligne.strip())

    return "\n".join(lignes_propres)


# ----------------------------------------------------------------------
# Extraction du texte selon le format
# ----------------------------------------------------------------------


def extraire_texte_pdf(fichier):
    """
    Extrait le texte d'un PDF fourni comme objet mémoire.

    Une page sans texte extractible rend None — c'est le cas de toutes les
    pages d'un document scanné. On les ignore et le texte total reste vide,
    ce que la détection de lisibilité reconnaîtra ensuite.

    En cas d'échec de lecture (fichier tronqué, chiffré, corrompu), on
    retourne une chaîne vide plutôt que de laisser l'exception remonter :
    un seul document abîmé ne doit pas interrompre le traitement du lot.
    L'exception n'est volontairement PAS journalisée — son message peut
    contenir des fragments du document (règle n°5 du §5 du cadrage).
    """
    morceaux = []
    try:
        with pdfplumber.open(fichier) as pdf:
            for page in pdf.pages:
                contenu = page.extract_text()
                if contenu:
                    morceaux.append(contenu)
    except Exception:
        return ""

    return "\n".join(morceaux)


def extraire_texte_docx(fichier):
    """
    Extrait le texte d'un .docx fourni comme objet mémoire — PARAGRAPHES ET
    TABLEAUX.

    C'EST LE PIÈGE DU LOT 2 (§7.8 du cadrage).

    Beaucoup de CV Word sont entièrement construits dans des tableaux : une
    colonne étroite à gauche pour les intitulés, une large à droite pour le
    contenu. C'est la façon la plus simple d'obtenir une mise en page en deux
    colonnes dans Word, et les modèles gratuits en sont remplis.

    Or `document.paragraphs` ne rend QUE les paragraphes de premier niveau.
    Le texte à l'intérieur des cellules n'y figure pas. Un parser qui s'en
    contenterait rendrait un texte quasi vide sur ces CV, qui seraient alors
    classés « illisibles » à tort — et le RH conclurait que l'outil ne sait
    pas lire les fichiers Word.

    On parcourt donc `document.tables` en plus, cellule par cellule.

    Note : `cell.text` ramène déjà le contenu des paragraphes de la cellule.
    Les tableaux imbriqués dans une cellule sont rendus par la propriété
    `cell.tables`, parcourue récursivement ci-dessous.
    """
    morceaux = []
    try:
        document = Document(fichier)
    except Exception:
        return ""

    for paragraphe in document.paragraphs:
        if paragraphe.text.strip():
            morceaux.append(paragraphe.text)

    def parcourir_tableaux(tableaux):
        for tableau in tableaux:
            for ligne in tableau.rows:
                for cellule in ligne.cells:
                    if cellule.text.strip():
                        morceaux.append(cellule.text)
                    # Un tableau peut en contenir un autre.
                    if cellule.tables:
                        parcourir_tableaux(cellule.tables)

    parcourir_tableaux(document.tables)

    return "\n".join(morceaux)


def extraire_texte(fichier, nom_fichier):
    """
    Aiguille vers le bon extracteur selon l'extension, et rend le texte
    nettoyé.

    `fichier` est un objet mémoire (BytesIO, ou l'objet rendu par
    `st.file_uploader`). On le rembobine avant lecture : s'il a déjà été lu
    une fois, le curseur est en fin de fichier et l'extraction ne verrait
    rien.
    """
    extension = PurePath(nom_fichier).suffix.lower()

    if hasattr(fichier, "seek"):
        fichier.seek(0)

    if extension == ".pdf":
        texte = extraire_texte_pdf(fichier)
    elif extension == ".docx":
        texte = extraire_texte_docx(fichier)
    else:
        raise ValueError(f"Format non pris en charge : {extension or 'inconnu'}")

    return nettoyer_texte(texte)


def est_lisible(texte):
    """
    Un document est lisible si son texte normalisé atteint le seuil du §7.5.

    On mesure APRÈS normalisation, et pas sur le texte brut, parce qu'un PDF
    scanné rend parfois quelques dizaines de caractères parasites — numéros de
    page, artefacts de compression, marques de mise en page. La normalisation
    les réduit et évite de prendre ce bruit pour du contenu.
    """
    return len(normaliser(texte)) >= SEUIL_TEXTE_MINIMUM


# ----------------------------------------------------------------------
# Informations candidat
# ----------------------------------------------------------------------


def extraire_email(texte):
    """Retourne le premier email trouvé, ou None."""
    correspondance = _MOTIF_EMAIL.search(texte or "")
    if not correspondance:
        return None
    # Une adresse en fin de phrase ramène parfois le point final.
    return correspondance.group(0).rstrip(".")


def extraire_telephone(texte):
    """
    Retourne le premier numéro ivoirien trouvé, avec ses espaces réduits,
    ou None.
    """
    correspondance = _MOTIF_TELEPHONE.search(texte or "")
    if not correspondance:
        return None
    return _ESPACES_MULTIPLES.sub(" ", correspondance.group(0)).strip()


def _ressemble_a_un_nom(ligne):
    """
    Décide si une ligne peut être un nom de personne.

    Quatre conditions :

    - de deux à quatre mots (un mot seul est trop ambigu, cinq est une
      phrase) ;
    - chaque mot n'est composé que de lettres, de traits d'union ou
      d'apostrophes — ce qui écarte toute ligne contenant un chiffre, une
      arobase ou une virgule ;
    - aucun mot n'est un intitulé de section (« CURRICULUM VITAE ») ;
    - la ligne ne dépasse pas 60 caractères.

    `str.isalpha()` est utilisé plutôt qu'une plage de caractères écrite à la
    main : il connaît l'Unicode, donc « Désiré » passe. En revanche un accent
    combinant isolé n'est PAS une lettre — c'est ce qui rend la recomposition
    NFC de `nettoyer_texte` indispensable en amont.
    """
    if not ligne or len(ligne) > 60:
        return False

    mots = ligne.split()
    if not (2 <= len(mots) <= 4):
        return False

    for mot in mots:
        fragments = re.split(r"[\-'’]", mot)
        if not all(f.isalpha() for f in fragments if f):
            return False
        if not any(f for f in fragments):
            return False

    mots_normalises = set(normaliser(ligne).split())
    if mots_normalises & _MOTS_DE_SECTION:
        return False

    return True


def extraire_nom_depuis_texte(texte):
    """
    Heuristique du §7.7 : le nom figure presque toujours dans les premières
    lignes du CV.

    On examine les cinq premières lignes non vides et on retient la première
    qui ressemble à un nom. La ligne est rendue telle que le candidat l'a
    écrite — majuscules comprises, c'est sa propre présentation.

    Retourne None si aucune ligne ne convient. C'est un échec NORMAL, prévu :
    l'appelant enchaîne alors sur le repli par le nom du fichier.
    """
    lignes = [l.strip() for l in (texte or "").split("\n") if l.strip()]
    for ligne in lignes[:5]:
        if _ressemble_a_un_nom(ligne):
            return ligne
    return None


def _mettre_en_forme_fragment(fragment):
    """
    Met un fragment de nom en capitale initiale, en respectant les traits
    d'union : « guy-desire » devient « Guy-Desire », pas « Guy-desire ».
    """
    return "-".join(partie.capitalize() for partie in fragment.split("-"))


def extraire_nom_depuis_fichier(nom_fichier):
    """
    Repli du §7.7 : dériver le nom depuis le nom du fichier.

    En pratique les candidats nomment leur CV « CV_Kouassi_Jean.pdf », et
    c'est plus fiable que d'afficher « Nom inconnu ».

    MAIS CE REPLI DOIT ÉCHOUER PROPREMENT.

    Le §5.1.3 de PROCESS le dit à partir de noms de fichiers réels :
    `CV_Rubben_Lago_2026_RH.pdf` donne un nom exploitable, mais `CVBR.pdf`,
    `cv de MOHAMED.pdf` et `Fatogoma_cv.DEC2025.pdf` n'en donnent aucun.
    Retourner « Cvbr » ou « Mohamed » serait pire que de ne rien retourner :
    un nom absurde affiché avec assurance est plus trompeur qu'une case vide,
    parce que le RH n'a aucun moyen de savoir qu'il a été inventé.

    La méthode :

    1. retirer l'extension ;
    2. découper sur les séparateurs usuels (_ - . espace) ;
    3. écarter les fragments contenant un chiffre — années, dates, versions ;
    4. écarter les mots de vocabulaire administratif (« cv », « rh », « de ») ;
    5. écarter les fragments de moins de trois lettres ;
    6. n'accepter le résultat qu'à partir de DEUX fragments restants.

    C'est l'étape 6 qui fait échouer proprement : un seul fragment peut être
    un prénom seul, un acronyme, ou n'importe quoi d'autre — on ne peut pas
    trancher, donc on ne tranche pas.

    Retourne le nom mis en forme, ou None.
    """
    racine = PurePath(nom_fichier or "").stem
    fragments = [f for f in re.split(r"[\s_\-.]+", racine) if f]

    retenus = []
    for fragment in fragments:
        if any(caractere.isdigit() for caractere in fragment):
            continue
        if len(fragment) < _LONGUEUR_MINIMALE_FRAGMENT:
            continue
        if normaliser(fragment) in _MOTS_DE_FICHIER_A_IGNORER:
            continue
        if not all(
            partie.isalpha()
            for partie in re.split(r"['’]", fragment)
            if partie
        ):
            continue
        retenus.append(fragment)

    if len(retenus) < 2:
        return None

    # Au-delà de quatre fragments, on n'a plus affaire à un nom mais à une
    # phrase entière dans le nom de fichier. On ne devine pas.
    if len(retenus) > 4:
        return None

    return " ".join(_mettre_en_forme_fragment(f) for f in retenus)


def extraire_nom(texte, nom_fichier):
    """
    Nom du candidat : heuristique sur le texte, puis repli sur le nom du
    fichier, puis None.

    None est une valeur de retour légitime. L'interface affichera le nom du
    fichier à la place — une information vraie — plutôt qu'un nom fabriqué.
    """
    nom = extraire_nom_depuis_texte(texte)
    if nom:
        return nom
    return extraire_nom_depuis_fichier(nom_fichier)


# ----------------------------------------------------------------------
# Point d'entrée
# ----------------------------------------------------------------------


def parser_cv(fichier, nom_fichier):
    """
    Point d'entrée du parser.

    `fichier`      : objet mémoire ouvert en binaire (jamais un chemin).
    `nom_fichier`  : le nom d'origine, nécessaire pour connaître le format et
                     pour le repli d'extraction du nom.

    Retourne :

        {
            "fichier": "CV_Kouassi_Jean.pdf",
            "lisible": True,
            "nom": "Kouassi Jean",     # ou None
            "email": "...",            # ou None
            "telephone": "...",        # ou None
            "texte": "...",            # texte extrait, nettoyé
        }

    Sur un document illisible, `texte` est rendu tel quel (souvent vide) et
    les champs candidat sont remplis dans la mesure du possible. Le document
    ne doit PAS être scoré : la règle du §7.5 est que « illisible » et
    « score de 0 » sont deux états distincts.

    RÈGLE DE CONFIDENTIALITÉ. `texte` est la seule donnée volumineuse rendue
    par ce module. L'appelant doit le passer au scorer puis le LIBÉRER, sans
    jamais le déposer dans l'état de session (règle n°3 du §5 du cadrage).
    """
    texte = extraire_texte(fichier, nom_fichier)

    return {
        "fichier": nom_fichier,
        "lisible": est_lisible(texte),
        "nom": extraire_nom(texte, nom_fichier),
        "email": extraire_email(texte),
        "telephone": extraire_telephone(texte),
        "texte": texte,
    }
