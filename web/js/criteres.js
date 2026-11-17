// Conversion entre la saisie de l'utilisateur et la structure du moteur.
//
// Transposition de `core/criteres.py`.
//
// Le scorer attend des critères déjà structurés (§7.2 du cadrage) :
//
//     { nom: "...", poids: 35, type: "requis",
//       groupes: [["react", "vue", "angular"]] }
//
// L'interface, elle, ne peut proposer qu'une zone de texte. Ce module fait le
// pont entre les deux, dans les deux sens. C'est sa seule responsabilité : il
// ne calcule aucun score et ne lit aucun fichier.
//
// LA RÈGLE DE SYNTAXE (décision du 14/09/2026).
//
//     LE SIGNE « = » EST LA SEULE CHOSE QUI CRÉE UN GROUPE DE SYNONYMES.
//
// Sans « = », chaque terme est un mot-clé indépendant, qu'il soit séparé par
// une virgule ou par un retour à la ligne. Avec « = », le terme de gauche est
// le terme principal et ceux de droite ses synonymes.
//
//     python, javascript          ->  [python]  [javascript]
//     react = vue, angular        ->  [react, vue, angular]
//
// L'intérêt : celui qui tape une liste plate obtient un comportement correct
// sans rien avoir à apprendre. Celui qui veut des synonymes ajoute un « = ».

export const SEPARATEUR_SYNONYMES = "=";
export const SEPARATEUR_TERMES = ",";

/** Retire les espaces autour de chaque terme et écarte les vides. */
function nettoyerTermes(termes) {
  return termes.map((terme) => terme.trim()).filter((terme) => terme !== "");
}

/**
 * Convertit la saisie de l'utilisateur en liste de groupes.
 *
 * Rend une liste de listes de termes. Chaque groupe est trouvé dans un CV si
 * au moins un de ses termes y figure (§7.3 du cadrage).
 *
 * La lecture est VOLONTAIREMENT TOLÉRANTE : espaces superflus, lignes vides,
 * virgules en trop et doublons sont absorbés sans message d'erreur. Une zone
 * de texte est un endroit où l'on tape vite ; refuser une saisie pour une
 * virgule de trop serait hostile, et il n'y a ici aucun risque d'ambiguïté à
 * corriger silencieusement.
 *
 *     analyserMotsCles("python, javascript\nreact = vue, angular")
 *     -> [["python"], ["javascript"], ["react", "vue", "angular"]]
 */
export function analyserMotsCles(texte) {
  if (!texte) return [];

  const groupes = [];

  for (let ligne of texte.split("\n")) {
    ligne = ligne.trim();
    if (!ligne) continue;

    const position = ligne.indexOf(SEPARATEUR_SYNONYMES);

    if (position !== -1) {
      // Un groupe de synonymes. On coupe sur le PREMIER « = » seulement : un
      // second signe sur la même ligne est une faute de frappe, pas une
      // intention, et le traiter comme un séparateur produirait un groupe
      // surprenant. C'est ce que fait `str.partition` en Python.
      const principal = ligne.slice(0, position);
      const synonymes = ligne.slice(position + SEPARATEUR_SYNONYMES.length);
      const groupe = nettoyerTermes([principal, ...synonymes.split(SEPARATEUR_TERMES)]);
      if (groupe.length) groupes.push(groupe);
    } else {
      // Pas de « = » : chaque terme séparé par une virgule est un mot-clé
      // indépendant, donc son propre groupe.
      for (const terme of ligne.split(SEPARATEUR_TERMES)) {
        const groupe = nettoyerTermes([terme]);
        if (groupe.length) groupes.push(groupe);
      }
    }
  }

  // Retrait des groupes en double, en conservant l'ordre de saisie.
  //
  // En Python on se sert d'un `set` de tuples. En JavaScript, deux tableaux
  // de même contenu ne sont jamais « égaux » pour un Set — ce sont deux
  // objets distincts. On compare donc une EMPREINTE : les termes réunis par
  // un caractère qui ne peut pas figurer dans une saisie (le caractère nul).
  const dejaVus = new Set();
  const uniques = [];
  for (const groupe of groupes) {
    const empreinte = groupe.join("\u0000");
    if (!dejaVus.has(empreinte)) {
      dejaVus.add(empreinte);
      uniques.push(groupe);
    }
  }

  return uniques;
}

/**
 * Opération inverse : reconstruit le texte à afficher dans la zone de saisie.
 *
 * Sert à pré-remplir le champ quand l'utilisateur choisit un modèle. Un
 * groupe d'un seul terme donne une ligne nue, un groupe de plusieurs donne
 * une ligne avec « = ».
 *
 *     formaterMotsCles([["python"], ["react", "vue"]])  ->  "python\nreact = vue"
 *
 * Le texte produit n'est pas forcément identique au texte d'origine — une
 * liste séparée par des virgules ressort sur plusieurs lignes — mais il a
 * exactement le même SENS. C'est cette propriété-là qui est vérifiée dans la
 * page de tests, et c'est la seule qui compte.
 */
export function formaterMotsCles(groupes) {
  const lignes = [];
  for (const groupe of groupes) {
    if (!groupe || !groupe.length) continue;
    if (groupe.length === 1) {
      lignes.push(groupe[0]);
    } else {
      lignes.push(`${groupe[0]} ${SEPARATEUR_SYNONYMES} ${groupe.slice(1).join(", ")}`);
    }
  }
  return lignes.join("\n");
}

/**
 * Assemble un critère complet à partir de ce que l'interface a collecté.
 * `motsCles` est le contenu brut de la zone de texte.
 */
export function construireCritere(nom, poids, motsCles, typeCritere = "requis") {
  return {
    nom: (nom || "").trim(),
    poids,
    type: typeCritere,
    groupes: analyserMotsCles(motsCles),
  };
}

/**
 * Somme des poids des critères REQUIS.
 *
 * Les critères d'exclusion en sont exclus : ils ne rapportent aucun point
 * (§7.4 du cadrage), les compter fausserait l'indicateur « Poids attribués :
 * 85 / 100 » de l'étape 1.
 */
export function totalDesPoids(criteres) {
  return criteres
    .filter((critere) => (critere.type ?? "requis") === "requis")
    .reduce((somme, critere) => somme + (critere.poids ?? 0), 0);
}

/**
 * Rend le nom des critères requis qui ont un poids mais aucun mot-clé.
 *
 * Un tel critère consomme des points du total sans pouvoir jamais en
 * rapporter : il abaisse mécaniquement tous les scores, sans que rien ne
 * l'explique à l'écran. C'est une faute de saisie silencieuse, et l'endroit
 * pour la signaler est l'interface — d'où cette fonction, qui se contente de
 * la détecter sans rien afficher.
 */
export function criteresIncomplets(criteres) {
  return criteres
    .filter(
      (critere) =>
        (critere.type ?? "requis") === "requis" &&
        (critere.poids ?? 0) > 0 &&
        !(critere.groupes && critere.groupes.length),
    )
    .map((critere) => critere.nom ?? "");
}
