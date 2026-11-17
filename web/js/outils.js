// Petits outils communs. Rien de métier ici : des fonctions que plusieurs
// modules utilisent, et qui doivent se comporter EXACTEMENT comme leur
// équivalent Python.

/**
 * Arrondit comme `round()` de Python, et non comme `Math.round()`.
 *
 * C'EST LE PIÈGE DE TOUTE LA MIGRATION. Les deux langages ne traitent pas de
 * la même façon une valeur qui tombe pile sur un demi :
 *
 *     valeur   Python round()   JavaScript Math.round()
 *      12,5          12                   13
 *      17,5          18                   18
 *      72,5          72                   73
 *
 * Python applique l'« arrondi du banquier » : à exactement ,5 il va vers
 * l'entier PAIR. JavaScript arrondit toujours vers le haut. Ce n'est pas une
 * curiosité théorique — le cas se produit avec des poids ordinaires : un
 * critère de poids 25 dont un groupe sur deux est trouvé vaut 12,5 points, et
 * l'application affiche 12 aujourd'hui.
 *
 * Sans cette fonction, des points affichés différeraient, et surtout deux
 * candidats pourraient changer de place dans le classement. Elle est donc
 * employée PARTOUT où le code Python écrit `round()` — nulle part ailleurs.
 *
 * Fonctionne aussi pour les valeurs négatives, où Python donne
 * round(-0,5) = 0, round(-1,5) = -2 et round(-2,5) = -2.
 */
export function arrondirCommePython(valeur) {
  const bas = Math.floor(valeur);
  const reste = valeur - bas;

  if (reste > 0.5) return bas + 1;
  if (reste < 0.5) return bas;

  // Exactement ,5 : on va vers l'entier pair.
  // En JavaScript, -2 % 2 vaut -0, et -0 === 0 est vrai : le test fonctionne
  // donc aussi du côté négatif.
  return bas % 2 === 0 ? bas : bas + 1;
}

/**
 * Neutralise les caractères qu'une expression régulière interpréterait comme
 * des symboles. Équivalent de `re.escape` de Python, qui n'existe pas en
 * JavaScript.
 *
 * Sans lui, un mot-clé « C++ » provoquerait une erreur de syntaxe, car « + »
 * a un sens particulier dans une expression régulière. En pratique la
 * normalisation a déjà retiré la ponctuation, mais on ne dépend pas de ce
 * détail — c'est exactement le raisonnement du commentaire de
 * `core/scorer.py`.
 */
export function echapperRegExp(texte) {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Accorde un mot avec un nombre : « 1 CV », « 2 CV analysés ».
 *
 * Transposition de `accorder` dans app.py. Écrire « 1 candidat(s) classé(s) »
 * est le réflexe qui économise cinq minutes et coûte la crédibilité de
 * l'interface. Le français s'accorde, et un outil destiné à des
 * professionnels RH est jugé aussi sur sa langue.
 *
 * Comme en Python, zéro prend le SINGULIER : « 0 fichier déposé ».
 */
export function accorder(nombre, singulier, pluriel = null) {
  const forme = pluriel === null ? singulier + "s" : pluriel;
  return `${nombre} ${Math.abs(nombre) <= 1 ? singulier : forme}`;
}

/**
 * Formate un nombre décimal à la française : 0,3 et non 0.3.
 *
 * Transposition de `nombre_francais` dans app.py. `toFixed` écrit le
 * séparateur décimal en point, comme Python ; on remplace donc par une
 * virgule, plutôt que de passer par `toLocaleString`, qui dépendrait de la
 * langue réglée dans le navigateur du visiteur — l'application est en
 * français quelle que soit cette langue.
 */
export function nombreFrancais(valeur, decimales = 1) {
  // `toFixed` et le formatage de Python arrondissent tous deux au plus proche,
  // mais pas de la même façon quand la valeur tombe PILE sur un demi : Python
  // va vers le chiffre pair, `toFixed` vers le haut. « 2,5 » devient donc 2 en
  // Python et 3 en JavaScript.
  //
  // Un demi exact à `decimales` décimales, c'est une valeur dont le produit par
  // 2^(decimales+1) est un entier IMPAIR. Le test porte sur une puissance de
  // DEUX, et non de dix : multiplier un nombre à virgule flottante par une
  // puissance de deux est exact, donc le test ne se trompe jamais. Avec une
  // puissance de dix il se tromperait — 0,05 ou 0,15 ne sont pas des demis
  // exacts en binaire, mais le produit par 10 le laisse croire.
  const double = valeur * 2 ** (decimales + 1);
  if (Number.isInteger(double) && Math.abs(double % 2) === 1) {
    const facteur = 10 ** decimales;
    return (arrondirCommePython(valeur * facteur) / facteur)
      .toFixed(decimales)
      .replace(".", ",");
  }
  return valeur.toFixed(decimales).replace(".", ",");
}

/**
 * Taille d'un fichier, lisible. Transposition de `_formater_taille`.
 * Au-delà d'un mégaoctet on écrit en Mo avec une décimale, en dessous en Ko
 * sans décimale.
 */
export function formaterTaille(octets) {
  if (octets === null || octets === undefined) return "—";
  if (octets >= 1048576) return `${nombreFrancais(octets / 1048576)} Mo`;
  // `round()` de Python, pas `Math.round` : 2560 octets font 2,5 Ko, que
  // Python affiche « 2 » et Math.round « 3 ».
  return `${arrondirCommePython(octets / 1024)} Ko`;
}

// ---------------------------------------------------------------------------
// Espaces, au sens de Python
// ---------------------------------------------------------------------------

/**
 * Les caractères que Python considère comme des espaces (`str.isspace()`, donc
 * `\s` d'une expression régulière).
 *
 * Ce n'est pas tout à fait la même liste qu'en JavaScript : Python y range les
 * séparateurs \x1c à \x1f et la nouvelle ligne \x85, JavaScript y range la
 * marque d'ordre des octets \ufeff. Là où la distinction compte — la découpe
 * des mots d'un PDF, qui doit suivre pdfplumber au caractère près — on emploie
 * cette liste-ci plutôt que `\s`.
 */
export const ESPACE_CARACTERES =
  "\\t\\n\\v\\f\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";

export const ESPACE = `[${ESPACE_CARACTERES}]`;

const ESPACES_AUX_BORDS = new RegExp(`^${ESPACE}+|${ESPACE}+$`, "g");

/** Équivalent de `str.strip()` de Python, sur la liste d'espaces ci-dessus. */
export function rogner(texte) {
  return texte.replace(ESPACES_AUX_BORDS, "");
}

// ---------------------------------------------------------------------------
// Bandes de couleur du score
// ---------------------------------------------------------------------------

/**
 * Vert au-dessus de 70, ambre de 40 à 70, rouge en dessous.
 *
 * Ces teintes qualifient LA CORRESPONDANCE AUX MOTS-CLÉS, pas le candidat —
 * c'est ce que dit la note sous le tableau, et c'est pour cela qu'elle y est.
 *
 * Les deux seuils sont ici, et non dans la vue, parce que l'écran et le
 * classeur Excel doivent employer les mêmes : un candidat vert à l'écran et
 * ambre dans le fichier exporté serait un défaut difficile à expliquer. Côté
 * Python, ils vivent pour la même raison dans core/export.py, d'où app.py les
 * importe.
 */
export const SEUIL_VERT = 70;
export const SEUIL_AMBRE = 40;

/** Le suffixe de classe CSS correspondant au score : haut, moyen ou bas. */
export function bandeDuScore(score) {
  if (score >= SEUIL_VERT) return "haut";
  if (score >= SEUIL_AMBRE) return "moyen";
  return "bas";
}
