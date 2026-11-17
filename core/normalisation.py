"""
Mise à plat du texte avant comparaison.

Ce module ne fait qu'une chose : ramener un texte à une forme canonique, pour
que « Développeur, Python. » et « developpeur python » deviennent comparables.

Il est appliqué au texte du CV **et** à chaque terme recherché. C'est la
symétrie qui compte : normaliser un seul des deux côtés reviendrait à
comparer des pommes et des poires.

Conforme au §7.1 du cadrage. Fonctions pures : aucune entrée-sortie, aucun
état global, aucun import de streamlit.
"""

import re
import unicodedata

# Tout ce qui n'est ni une lettre, ni un chiffre, ni une espace devient une
# espace. On travaille sur la chaîne déjà désaccentuée, donc les lettres
# restantes sont de l'ASCII de base.
_PONCTUATION = re.compile(r"[^a-z0-9\s]")
_ESPACES_MULTIPLES = re.compile(r"\s+")


# ----------------------------------------------------------------------
# Ligatures (correction du 17/11/2026)
# ----------------------------------------------------------------------

# LE « œ » N'EST PAS UNE LETTRE ACCENTUÉE, C'EST UNE LETTRE À PART ENTIÈRE.
# La décomposition NFD ne le défait donc pas, et la règle qui remplace tout
# non-alphanumérique par une espace l'EFFAÇAIT : « cœur » devenait « c ur » et
# « maître d'œuvre » devenait « maitre d uvre ».
#
# Ce n'était pas un cas tiré par les cheveux : « œ » est l'orthographe
# française normale, et c'est ce que la correction automatique de Word produit
# quand on tape « coeur » ou « oeuvre ». Mesuré avant correction, sur un CV de
# conducteur de travaux avec un critère de 50 points portant le mot-clé
# « maitre d'oeuvre » : 75 points si le candidat écrivait « oeuvre », 50 s'il
# écrivait « œuvre ». Vingt-cinq points pour la même phrase, selon que Word
# avait corrigé son orthographe ou non. Et rien à l'écran ne distinguait « le
# mot est absent » de « le mot a été détruit ».
#
# LES LIGATURES DE « f » SONT UN CAS PLUS RARE, ET TRAITÉES PAR PRÉCAUTION.
# Un PDF lu par pdfplumber ne les livre pas : pdfminer décompose « ﬁ » en
# « fi » avant même que ce module ne voie le texte (vérifié sur un PDF d'essai
# employant les glyphes /fi, /fl, /ff et /oe sans table Unicode). Un .docx,
# lui, livre le caractère tel que l'auteur l'a tapé — d'où leur présence ici.
#
# La table est appliquée APRÈS le passage en minuscules : « Œ » est déjà
# devenu « œ » à ce moment-là, et il n'y a donc qu'une forme à prévoir.
_LIGATURES = {
    "œ": "oe",
    "æ": "ae",
    "ﬀ": "ff",
    "ﬁ": "fi",
    "ﬂ": "fl",
    "ﬃ": "ffi",
    "ﬄ": "ffl",
    "ﬅ": "st",
    "ﬆ": "st",
}

_TABLE_LIGATURES = str.maketrans(_LIGATURES)


def defaire_ligatures(texte):
    """
    Remplace « œ » par « oe », « æ » par « ae », et les ligatures de « f » par
    leurs lettres.

    À appliquer sur du texte DÉJÀ EN MINUSCULES, et des deux côtés de la
    comparaison — ce que garantit `normaliser`, seul appelant.
    """
    if not texte:
        return ""
    return texte.translate(_TABLE_LIGATURES)


def recomposer(texte):
    """
    Recompose les caractères Unicode en forme NFC.

    À quoi ça sert ? Un « é » peut être stocké de deux façons différentes :
    soit comme un caractère unique (U+00E9), soit comme un « e » suivi d'un
    accent aigu combinant (U+0065 U+0301). Les deux s'affichent pareil, mais
    pour Python ce sont deux chaînes DIFFÉRENTES, de longueurs différentes.

    Les extracteurs de PDF rendent souvent la seconde forme. C'est ce qui
    avait produit le fameux « Kouassi Guy-De´sire´ » de RecrutPro : le texte
    était décomposé, et n'importe quel traitement caractère par caractère
    séparait la lettre de son accent.

    NFC recolle systématiquement accent et lettre. À appliquer dès la sortie
    du parser, avant tout autre traitement.
    """
    if not texte:
        return ""
    return unicodedata.normalize("NFC", texte)


def supprimer_accents(texte):
    """
    Retire les accents : « développeur » devient « developpeur ».

    La méthode est en deux temps. NFD décompose chaque lettre accentuée en
    lettre de base + marque combinante. On supprime ensuite toutes les marques
    combinantes (catégorie Unicode « Mn », pour Mark, nonspacing). Il ne reste
    que les lettres de base.

    C'est plus fiable qu'une table de correspondance écrite à la main : ça
    marche pour tous les alphabets latins, y compris les caractères qu'on
    n'avait pas prévus.
    """
    if not texte:
        return ""
    decompose = unicodedata.normalize("NFD", texte)
    return "".join(c for c in decompose if unicodedata.category(c) != "Mn")


def normaliser(texte):
    """
    Applique la chaîne complète du §7.1 du cadrage :

    1. recomposition NFC (pour partir d'une base saine) ;
    2. passage en minuscules ;
    3. ligatures défaites : « œ » devient « oe » ;
    4. suppression des accents ;
    5. remplacement de toute ponctuation par une espace ;
    6. réduction des espaces multiples.

    L'étape 3 a été ajoutée le 17/11/2026. Sans elle, « cœur » devenait
    « c ur » : le « œ » n'est pas une lettre accentuée, la décomposition NFD
    ne le défait pas, et la règle de l'étape 5 l'effaçait. Voir le commentaire
    de `_LIGATURES` pour la mesure qui a motivé la correction.

    Le point 5 mérite une explication. On remplace la ponctuation par une
    ESPACE et non par rien du tout. Sinon « C++/Python » deviendrait
    « cpython », un mot qui n'existe dans aucun des deux termes recherchés.
    En insérant une espace, on obtient « c python », où « python » reste
    trouvable avec ses frontières de mot intactes.

    Retourne une chaîne sans accent, en minuscules, où les mots sont séparés
    par une espace unique.
    """
    if not texte:
        return ""

    texte = recomposer(texte)
    texte = texte.lower()
    texte = defaire_ligatures(texte)
    texte = supprimer_accents(texte)
    texte = _PONCTUATION.sub(" ", texte)
    texte = _ESPACES_MULTIPLES.sub(" ", texte)
    return texte.strip()
