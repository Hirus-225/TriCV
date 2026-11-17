// Mise à plat du texte avant comparaison.
//
// Transposition de `core/normalisation.py`. Ce module ne fait qu'une chose :
// ramener un texte à une forme canonique, pour que « Développeur, Python. »
// et « developpeur python » deviennent comparables.
//
// Il est appliqué au texte du CV **et** à chaque terme recherché. C'est la
// symétrie qui compte : normaliser un seul des deux côtés reviendrait à
// comparer des pommes et des poires.
//
// Conforme au §7.1 du cadrage. Fonctions pures : aucune lecture de fichier,
// aucun état, aucun accès à la page.

// Tout ce qui n'est ni une lettre, ni un chiffre, ni une espace devient une
// espace. On travaille sur la chaîne déjà désaccentuée, donc les lettres
// restantes sont de l'ASCII de base.
//
// NOTE SUR UNE DIFFÉRENCE SANS CONSÉQUENCE. `\s` ne désigne pas tout à fait
// les mêmes caractères en Python et en JavaScript : Python y range les
// séparateurs \x1c à \x1f, JavaScript y range la marque d'ordre des octets
// ﻿. Le résultat est pourtant identique, parce que les deux chemins
// mènent au même endroit : un caractère reconnu comme espace est conservé
// puis réduit par ESPACES_MULTIPLES, un caractère non reconnu est remplacé
// par une espace puis réduit de même. Dans tous les cas, ce qui n'est ni
// lettre ni chiffre finit en espace.
const PONCTUATION = /[^a-z0-9\s]/g;
const ESPACES_MULTIPLES = /\s+/g;

// Les marques combinantes d'Unicode (catégorie Mn, pour « Mark, nonspacing »).
// Le drapeau `u` est OBLIGATOIRE pour que \p{...} soit reconnu ; sans lui,
// l'expression ne cherche pas la bonne chose et ne lève aucune erreur.
const MARQUES_COMBINANTES = /\p{Mn}/gu;

// ---------------------------------------------------------------------------
// Ligatures (correction du 17/11/2026)
// ---------------------------------------------------------------------------
//
// LE « œ » N'EST PAS UNE LETTRE ACCENTUÉE, C'EST UNE LETTRE À PART ENTIÈRE. La
// décomposition NFD ne le défait donc pas, et la règle qui remplace tout
// non-alphanumérique par une espace l'EFFAÇAIT : « cœur » devenait « c ur ».
//
// Ce n'était pas un cas tiré par les cheveux : « œ » est l'orthographe
// française normale, et c'est ce que la correction automatique de Word produit
// quand on tape « coeur » ou « oeuvre ». Mesuré avant correction, sur un CV de
// conducteur de travaux avec un critère de 50 points portant le mot-clé
// « maitre d'oeuvre » : 75 points si le candidat écrivait « oeuvre », 50 s'il
// écrivait « œuvre ».
//
// Les ligatures de « f » sont un cas plus rare, traité par précaution : un PDF
// lu par pdfplumber — et par pdf-texte.js, qui le reproduit — ne les livre pas,
// mais un .docx livre le caractère tel que l'auteur l'a tapé.
//
// La table est appliquée APRÈS le passage en minuscules : « Œ » est déjà devenu
// « œ » à ce moment-là, et il n'y a donc qu'une forme à prévoir.
//
// Même table et même place que `_LIGATURES` dans core/normalisation.py.
const LIGATURES = {
  "œ": "oe",
  "æ": "ae",
  "ﬀ": "ff",
  "ﬁ": "fi",
  "ﬂ": "fl",
  "ﬃ": "ffi",
  "ﬄ": "ffl",
  "ﬅ": "st",
  "ﬆ": "st",
};

const MOTIF_LIGATURES = new RegExp(`[${Object.keys(LIGATURES).join("")}]`, "gu");

/**
 * Remplace « œ » par « oe », « æ » par « ae », et les ligatures de « f » par
 * leurs lettres.
 *
 * À appliquer sur du texte DÉJÀ EN MINUSCULES, et des deux côtés de la
 * comparaison — ce que garantit `normaliser`, seul appelant.
 */
export function defaireLigatures(texte) {
  if (!texte) return "";
  return texte.replace(MOTIF_LIGATURES, (caractere) => LIGATURES[caractere]);
}

/**
 * Recompose les caractères Unicode en forme NFC.
 *
 * À quoi ça sert ? Un « é » peut être stocké de deux façons différentes :
 * soit comme un caractère unique (U+00E9), soit comme un « e » suivi d'un
 * accent aigu combinant (U+0065 U+0301). Les deux s'affichent pareil, mais
 * ce sont deux chaînes DIFFÉRENTES, de longueurs différentes.
 *
 * Les extracteurs de PDF rendent souvent la seconde forme. C'est ce qui avait
 * produit le fameux « Kouassi Guy-De´sire´ » de RecrutPro : le texte était
 * décomposé, et n'importe quel traitement caractère par caractère séparait la
 * lettre de son accent.
 *
 * NFC recolle systématiquement accent et lettre. À appliquer dès la sortie du
 * lecteur de fichier, avant tout autre traitement.
 */
export function recomposer(texte) {
  if (!texte) return "";
  return texte.normalize("NFC");
}

/**
 * Retire les accents : « développeur » devient « developpeur ».
 *
 * La méthode est en deux temps. NFD décompose chaque lettre accentuée en
 * lettre de base + marque combinante. On supprime ensuite toutes les marques
 * combinantes. Il ne reste que les lettres de base.
 *
 * C'est plus fiable qu'une table de correspondance écrite à la main : ça
 * marche pour tous les alphabets latins, y compris les caractères qu'on
 * n'avait pas prévus.
 */
export function supprimerAccents(texte) {
  if (!texte) return "";
  return texte.normalize("NFD").replace(MARQUES_COMBINANTES, "");
}

/**
 * Applique la chaîne complète du §7.1 du cadrage :
 *
 *   1. recomposition NFC (pour partir d'une base saine) ;
 *   2. passage en minuscules ;
 *   3. ligatures défaites : « œ » devient « oe » ;
 *   4. suppression des accents ;
 *   5. remplacement de toute ponctuation par une espace ;
 *   6. réduction des espaces multiples.
 *
 * L'étape 3 a été ajoutée le 17/11/2026, dans les deux langages à la fois.
 *
 * Le point 5 mérite une explication. On remplace la ponctuation par une
 * ESPACE et non par rien du tout. Sinon « C++/Python » deviendrait
 * « cpython », un mot qui n'existe dans aucun des deux termes recherchés. En
 * insérant une espace, on obtient « c python », où « python » reste trouvable
 * avec ses frontières de mot intactes.
 *
 * Rend une chaîne sans accent, en minuscules, où les mots sont séparés par
 * une espace unique.
 */
export function normaliser(texte) {
  if (!texte) return "";

  let resultat = recomposer(texte);
  resultat = resultat.toLowerCase();
  resultat = defaireLigatures(resultat);
  resultat = supprimerAccents(resultat);
  resultat = resultat.replace(PONCTUATION, " ");
  resultat = resultat.replace(ESPACES_MULTIPLES, " ");
  return resultat.trim();
}
