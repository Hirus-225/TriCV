// Texte d'un fichier .docx — PARAGRAPHES, TABLEAUX ET ZONES DE TEXTE.
//
// Transposition de `extraire_texte_docx` et `_collecter_paragraphes`
// (core/parser.py).
//
// CE QU'EST UN .docx. Une archive zip contenant des fichiers XML. Le texte du
// document est dans `word/document.xml`. On a donc besoin de deux choses :
// décompresser (fflate) et lire du XML — et pour ce second point le navigateur
// fournit `DOMParser`, sans bibliothèque.
//
// POURQUOI PAS mammoth.js, qui lit les .docx en une ligne ? Parce qu'il
// convertit le document en HTML en interprétant sa mise en forme, et qu'il
// IGNORE LES ZONES DE TEXTE FLOTTANTES. C'est précisément le cas découvert le
// 16/09/2026 : un CV entièrement construit en zones de texte — la mise en page
// que produisent Canva et les modèles Word graphiques — ressortait avec ZÉRO
// caractère, donc classé illisible, alors qu'il contenait onze cents
// caractères parfaitement extractibles. Un candidat réel disparaissait du
// classement sans que rien ne le signale.
//
// C'EST LE PIÈGE DU FORMAT, ET IL A DEUX ÉTAGES. Beaucoup de CV Word sont
// construits dans des TABLEAUX : une colonne étroite à gauche pour les
// intitulés, une large à droite pour le contenu. C'est la façon la plus simple
// d'obtenir deux colonnes dans Word, et les modèles gratuits en sont remplis.
// Les propriétés de commodité de python-docx — `paragraphs`, `tables` — ne
// voient que les deux premiers niveaux. On descend donc dans l'arbre XML et on
// ramasse tous les paragraphes, où qu'ils soient.
//
// CONTREPARTIE ASSUMÉE. Les zones de texte sont POSITIONNÉES, pas enchaînées
// dans le fil du document. L'ordre des lignes rendues peut donc ne pas
// correspondre à l'ordre de lecture à l'écran — un titre de section peut
// arriver après son contenu. C'est sans effet sur le score, qui ne regarde que
// la présence des mots. Cela affaiblit en revanche l'extraction du nom, qui
// suppose que le nom figure dans les premières lignes ; le repli par le nom du
// fichier prend alors le relais.

import { strFromU8, unzipSync } from "../vendor/fflate/fflate.mjs";

// Espaces de noms du format Word. Chaque balise d'un .docx est rattachée à
// l'URL de sa spécification : on compare donc un couple (espace de noms, nom
// local), et non le seul nom « p » ou « t ».
const NS_WORD = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const NS_COMPATIBILITE = "http://schemas.openxmlformats.org/markup-compatibility/2006";

const CHEMIN_DOCUMENT = "word/document.xml";

const estBalise = (noeud, espace, nom) =>
  noeud.namespaceURI === espace && noeud.localName === nom;

/**
 * Parcourt l'arbre XML et ajoute à `lignes` le texte de chaque paragraphe
 * rencontré, dans l'ordre du document.
 *
 * DEUX PRÉCAUTIONS, les mêmes qu'en Python.
 *
 * 1. On saute les sous-arbres `mc:Fallback`. Word écrit souvent une zone de
 *    texte DEUX FOIS : une version moderne dans `mc:Choice` et une version de
 *    repli dans `mc:Fallback`, pour les traitements de texte anciens. Sans ce
 *    filtre, tout le contenu des zones de texte serait compté en double —
 *    sans effet sur le score, mais avec un texte extrait deux fois plus long
 *    et illisible à la relecture.
 *
 * 2. Un paragraphe peut en contenir d'autres, quand une zone de texte est
 *    ancrée dedans. On sépare donc le texte PROPRE du paragraphe (ses balises
 *    `w:t` directes) des paragraphes imbriqués, traités ensuite. Sans cette
 *    séparation, le texte de la zone de texte serait collé à celui du
 *    paragraphe hôte, et deux mots sans rapport se retrouveraient accolés —
 *    de quoi créer ou détruire une correspondance de mot-clé.
 */
function collecterParagraphes(element, lignes) {
  const propre = [];
  const imbriques = [];

  function descendre(noeud) {
    for (const enfant of noeud.children) {
      if (estBalise(enfant, NS_COMPATIBILITE, "Fallback")) continue;
      if (estBalise(enfant, NS_WORD, "p")) {
        imbriques.push(enfant);
      } else if (estBalise(enfant, NS_WORD, "t")) {
        if (enfant.textContent) propre.push(enfant.textContent);
      } else {
        descendre(enfant);
      }
    }
  }

  descendre(element);

  const texte = propre.join("").trim();
  if (texte) lignes.push(texte);

  for (const paragraphe of imbriques) {
    collecterParagraphes(paragraphe, lignes);
  }
}

/**
 * Extrait le texte d'un .docx fourni en octets.
 *
 * En cas d'échec — fichier qui n'est pas une archive, archive sans
 * `word/document.xml` (un .doc renommé, un .odt, un .pages), XML abîmé — on
 * rend une chaîne vide plutôt que de laisser l'erreur remonter, comme le fait
 * `extraire_texte_docx`. L'erreur n'est pas journalisée : son message peut
 * contenir des fragments du document.
 */
export function extraireTexteDocx(octets) {
  let xml;
  try {
    // `unzipSync` ne décompresse que ce qu'on lui demande : inutile de sortir
    // les images du document pour en lire le texte.
    const archive = unzipSync(octets, { filter: (f) => f.name === CHEMIN_DOCUMENT });
    const fichier = archive[CHEMIN_DOCUMENT];
    if (!fichier) return { texte: "", raison: "illisible" };
    xml = strFromU8(fichier);
  } catch {
    return { texte: "", raison: "illisible" };
  }

  const document = new DOMParser().parseFromString(xml, "application/xml");

  // `parseFromString` ne lève jamais d'erreur : sur un XML abîmé, il rend un
  // document dont la racine est `parsererror`. C'est un piège classique —
  // sans ce contrôle, on croirait avoir lu un document vide.
  if (document.querySelector("parsererror")) {
    return { texte: "", raison: "illisible" };
  }

  const corps = document.documentElement
    ? [...document.documentElement.children].find((n) => estBalise(n, NS_WORD, "body"))
    : null;
  if (!corps) return { texte: "", raison: "illisible" };

  const lignes = [];
  collecterParagraphes(corps, lignes);
  return { texte: lignes.join("\n"), raison: null };
}
