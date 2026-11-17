// Texte d'un PDF, tel que `page.extract_text()` de pdfplumber le rend.
//
// Transposition de `extraire_texte_pdf` (core/parser.py).
//
// COMMENT pdfplumber FABRIQUE CE TEXTE. Ce n'est pas « le texte du PDF » : un
// PDF ne contient pas de texte, il contient des instructions pour dessiner des
// caractères à des positions. pdfplumber procède en trois temps :
//
//   1. il relève chaque caractère avec sa position (`page.chars`) ;
//   2. il en forme des MOTS : des caractères qui se suivent de près, sur la
//      même ligne (`page.extract_words()`, tolérances de 3 points) ;
//   3. il regroupe ces mots en LIGNES — ceux dont le haut est à moins de
//      3 points l'un de l'autre — puis joint les mots par une espace et les
//      lignes par un retour à la ligne.
//
// Les deux premiers temps sont dans pdf-mots.js, copié du projet Rapprochement
// Bancaire où ils ont été écrits et éprouvés. Ce fichier-ci ne fait que le
// troisième, qui est court.
//
// POURQUOI NE PAS SE SERVIR DE `getTextContent()` DE PDF.js, qui rend du texte
// tout fait ? Parce qu'il ne rend pas le même. Il livre les morceaux dans
// l'ordre du flux de dessin, qui peut entrelacer deux colonnes, et il décide
// lui-même où mettre des espaces. Le texte sortirait différent de celui de
// Python — et c'est précisément ce qu'on veut éviter : le classement doit être
// le même des deux côtés.

import { grappes, lirePages, motsDePage, ouvrirPdf } from "./pdf-mots.js";

// pdfplumber : DEFAULT_Y_TOLERANCE. Deux mots dont le haut diffère de moins de
// 3 points sont sur la même ligne.
const TOLERANCE_Y = 3;

/**
 * Regroupe les mots d'une page en lignes, puis les joint.
 *
 * Reproduit la fin de `extract_text` de pdfplumber : `cluster_objects` sur le
 * haut de chaque mot, puis `"\n".join(" ".join(...))`.
 *
 * Le tri par numéro de grappe doit être STABLE — c'est-à-dire conserver
 * l'ordre d'origine entre deux mots de la même grappe. Le tri de JavaScript
 * l'est depuis 2019, comme celui de Python : l'ordre des mots dans une ligne
 * reste donc celui qu'a établi `motsDePage`, et non un ordre recalculé ici.
 */
function texteDesMots(mots) {
  if (!mots.length) return "";

  const grappe = grappes(mots.map((mot) => mot.top), TOLERANCE_Y);

  const lignes = new Map();
  for (const mot of [...mots].sort((a, b) => grappe.get(a.top) - grappe.get(b.top))) {
    const numero = grappe.get(mot.top);
    if (!lignes.has(numero)) lignes.set(numero, []);
    lignes.get(numero).push(mot);
  }

  return [...lignes.values()]
    .map((ligne) => ligne.map((mot) => mot.texte).join(" "))
    .join("\n");
}

/**
 * Extrait le texte d'un PDF fourni en octets.
 *
 * Une page sans texte extractible rend une chaîne vide — c'est le cas de
 * toutes les pages d'un document scanné. On les ignore, et le texte total
 * reste vide, ce que la détection de lisibilité reconnaîtra ensuite.
 *
 * En cas d'échec de lecture (fichier tronqué, chiffré, abîmé), on rend une
 * chaîne vide plutôt que de laisser l'erreur remonter : un seul document
 * abîmé ne doit pas interrompre le traitement du lot. L'erreur n'est
 * volontairement PAS journalisée — son message peut contenir des fragments du
 * document (règle n°5 du §5 du cadrage).
 *
 * `raison` dit POURQUOI la lecture a échoué, quand on le sait. Python ne le
 * distinguait pas et affichait « Document scanné » pour un PDF protégé par
 * mot de passe, ce qui est faux. On retient l'information ici ; l'interface
 * s'en servira.
 */
export async function extraireTextePdf(octets) {
  let pdf;
  try {
    pdf = await ouvrirPdf(octets);
  } catch (erreur) {
    // `name` est le seul champ qu'on regarde : il dit le type d'échec sans
    // contenir de fragment du document.
    const protege = erreur && erreur.name === "PasswordException";
    return { texte: "", raison: protege ? "protege" : "illisible" };
  }

  try {
    // `lirePages` rend, pour chaque page, ses caractères positionnés. Il
    // calcule aussi des lignes et des traits dont on ne se sert pas ici :
    // c'est le prix à payer pour que pdf-mots.js reste une copie conforme de
    // celui de Rapprochement Bancaire, où ces informations servent.
    const pages = await lirePages(pdf);
    const morceaux = [];
    for (const page of pages) {
      const contenu = texteDesMots(motsDePage(page.caracteres));
      if (contenu) morceaux.push(contenu);
    }
    return { texte: morceaux.join("\n"), raison: null };
  } catch {
    return { texte: "", raison: "illisible" };
  } finally {
    // Libère la mémoire du document et son fil d'exécution. Sans cela,
    // quarante CV laisseraient quarante documents ouverts dans l'onglet.
    //
    // C'est `loadingTask` qu'il faut détruire, pas le document : dans PDF.js
    // 6.4, PDFDocumentProxy n'a plus de méthode `destroy`. L'appel est gardé
    // par `?.` et par son propre `catch`, parce qu'échouer à faire le ménage
    // ne doit pas transformer une lecture réussie en échec.
    try {
      await pdf.loadingTask?.destroy();
    } catch {
      /* rien : le document sera ramassé avec la page */
    }
  }
}
