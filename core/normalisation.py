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
    3. suppression des accents ;
    4. remplacement de toute ponctuation par une espace ;
    5. réduction des espaces multiples.

    Le point 4 mérite une explication. On remplace la ponctuation par une
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
    texte = supprimer_accents(texte)
    texte = _PONCTUATION.sub(" ", texte)
    texte = _ESPACES_MULTIPLES.sub(" ", texte)
    return texte.strip()
