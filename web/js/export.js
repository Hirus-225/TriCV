// Génération du classeur Excel récapitulatif.
//
// Transposition de `core/export.py`. Trois feuilles — Résumé, Classement,
// Critères — avec leur mise en forme : en-têtes indigo, bandes de couleur sur
// les scores, lignes alternées, cellules fusionnées, filets.
//
// POURQUOI ExcelJS ET PAS SheetJS. La version communautaire de SheetJS
// n'écrit pas les styles de cellule : on obtiendrait trois feuilles de données
// brutes, pas le livrable actuel. ExcelJS écrit `fill`, `font`, `border`,
// `alignment`, les fusions, les largeurs et les hauteurs — c'est l'équivalent
// direct d'openpyxl.
//
// IL EST CHARGÉ À LA DEMANDE, au premier clic sur le bouton de téléchargement.
// Le fichier pèse près d'un mégaoctet ; l'imposer à chaque visiteur, y compris
// à celui qui n'exportera rien, serait payer cher une fonction facultative.
//
// RIEN N'EST ÉCRIT SUR UN DISQUE. Le classeur est construit en mémoire et rendu
// au navigateur sous forme de `Blob`, que l'utilisateur enregistre lui-même par
// la boîte de dialogue de son système. C'est la règle n°1 du §5 du cadrage
// appliquée à la sortie, comme le lecteur l'applique à l'entrée.

import { bandeDuScore, SEUIL_AMBRE, SEUIL_VERT } from "./outils.js";

// ----------------------------------------------------------------------
// Palette — identique à celle de core/export.py
// ----------------------------------------------------------------------
//
// L'indigo est celui de l'export RecrutPro, conservé ici alors que l'écran est
// passé au marine du portfolio. C'est la décision D3 de docs/MIGRATION-JS.md,
// encore ouverte : la changer, c'est changer cette seule constante.

const INDIGO = "4F46E5";
const BLANC = "FFFFFF";
const GRIS_CLAIR = "F8FAFC";
const GRIS_HEADER = "E2E8F0";
const GRIS_TEXTE = "64748B";
const ARDOISE = "1E293B";

const SCORE_VERT_FOND = "D1FAE5";
const SCORE_VERT_TEXTE = "065F46";
const SCORE_AMBRE_FOND = "FEF3C7";
const SCORE_AMBRE_TEXTE = "92400E";
const SCORE_ROUGE_FOND = "FEE2E2";
const SCORE_ROUGE_TEXTE = "991B1B";

const SIGNALEMENT_FOND = "FEF3C7";
const SIGNALEMENT_TEXTE = "92400E";

export const TYPE_MIME_XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Texte du §4 du cadrage, garde-fou n°3. Il figure dans l'interface ET dans
// l'export : un classeur circule par courriel, souvent sans la personne qui
// l'a produit, et l'avertissement doit voyager avec les chiffres.
export const AVERTISSEMENT =
  "Un score faible signifie que les mots-clés recherchés sont absents du CV, " +
  "pas que le candidat est moins qualifié.";

export const NOTE_LECTURE =
  "Le score mesure la correspondance aux mots-clés définis. Il ne mesure ni la " +
  "qualité d'un candidat ni son adéquation au poste. Lisez les CV avant toute " +
  "décision.";

export const NOTE_ILLISIBLES =
  "Ces CV n'ont pas pu être analysés : ils sont scannés en image, aucun texte " +
  "n'en est extractible. Ils ne reçoivent pas de score et ne sont pas classés. " +
  "Ouvrez-les directement.";

// ----------------------------------------------------------------------
// Chargement d'ExcelJS
// ----------------------------------------------------------------------

let chargement = null;

/**
 * Charge la bibliothèque au premier appel, une seule fois.
 *
 * ExcelJS n'est pas un module ES : il se déclare dans `window.ExcelJS`. On
 * insère donc une balise `<script>`, ce que la politique de sécurité autorise
 * puisque le fichier vient du site lui-même.
 */
function chargerExcelJs() {
  if (globalThis.ExcelJS) return Promise.resolve(globalThis.ExcelJS);
  if (!chargement) {
    chargement = new Promise((resoudre, rejeter) => {
      const balise = document.createElement("script");
      balise.src = new URL("../vendor/exceljs/exceljs.min.js", import.meta.url).href;
      balise.addEventListener("load", () => resoudre(globalThis.ExcelJS));
      balise.addEventListener("error", () =>
        rejeter(new Error("La bibliothèque d'export n'a pas pu être chargée.")),
      );
      document.head.append(balise);
    });
  }
  return chargement;
}

// ----------------------------------------------------------------------
// Petits utilitaires de mise en forme
// ----------------------------------------------------------------------

const argb = (hex) => `FF${hex}`;

/** Applique police, fond et alignement à une cellule — `_styler` en Python. */
function styler(cellule, { gras = false, couleur = null, fond = null, alignement = "left", taille = 11 } = {}) {
  cellule.font = { bold: gras, color: { argb: argb(couleur || ARDOISE) }, size: taille, name: "Calibri" };
  if (fond) cellule.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(fond) } };
  cellule.alignment = { horizontal: alignement, vertical: "middle", wrapText: true };
}

/** Trace un filet fin sur les quatre côtés — `_border` en Python. */
function filet(cellule) {
  const trait = { style: "thin", color: { argb: argb(GRIS_HEADER) } };
  cellule.border = { left: trait, right: trait, top: trait, bottom: trait };
}

/**
 * Une feuille et son compteur de lignes.
 *
 * openpyxl suit lui-même la dernière ligne écrite (`append` puis `max_row`) ;
 * ExcelJS compte autrement, et une ligne entièrement vide ne compte pas
 * toujours pour lui. On tient donc le compte à la main, ce qui garantit que
 * les deux classeurs placent chaque bloc sur la MÊME ligne — sans quoi la
 * comparaison cellule par cellule n'aurait aucun sens.
 */
function cahier(feuille) {
  let derniere = 0;
  return {
    feuille,
    get ligne() {
      return derniere;
    },
    /** Écrit une ligne de valeurs et rend son numéro. */
    ajouter(valeurs = []) {
      derniere += 1;
      const ligne = feuille.getRow(derniere);
      valeurs.forEach((valeur, index) => {
        if (valeur !== undefined && valeur !== null) ligne.getCell(index + 1).value = valeur;
      });
      return derniere;
    },
    cellule(ligne, colonne) {
      return feuille.getRow(ligne).getCell(colonne);
    },
    hauteur(ligne, valeur) {
      feuille.getRow(ligne).height = valeur;
    },
  };
}

/** Écrit une ligne d'en-tête indigo et rend son numéro — `_ecrire_entete`. */
function ecrireEntete(cahierFeuille, intitules, hauteur = 30) {
  const ligne = cahierFeuille.ajouter(intitules);
  cahierFeuille.hauteur(ligne, hauteur);
  for (let colonne = 1; colonne <= intitules.length; colonne++) {
    const cellule = cahierFeuille.cellule(ligne, colonne);
    styler(cellule, { gras: true, couleur: BLANC, fond: INDIGO, alignement: "center" });
    filet(cellule);
  }
  return ligne;
}

/** Le couple (fond, texte) de la bande de couleur du score. */
function couleursDuScore(score) {
  const bande = bandeDuScore(score);
  if (bande === "haut") return [SCORE_VERT_FOND, SCORE_VERT_TEXTE];
  if (bande === "moyen") return [SCORE_AMBRE_FOND, SCORE_AMBRE_TEXTE];
  return [SCORE_ROUGE_FOND, SCORE_ROUGE_TEXTE];
}

function largeurs(feuille, valeurs) {
  valeurs.forEach((largeur, index) => {
    feuille.getColumn(index + 1).width = largeur;
  });
}

/**
 * Met en forme les signalements d'exclusion pour une cellule de tableau.
 *
 * Quand le nom du critère et son terme déclencheur sont identiques — cas
 * courant, l'utilisateur nommant souvent son critère d'après son mot-clé — on
 * n'écrit pas deux fois la même chose.
 */
function resumerSignalements(signalements) {
  if (!signalements || !signalements.length) return "—";
  const morceaux = [];
  for (const signalement of signalements) {
    const critere = signalement.critere ?? "";
    const termes = (signalement.declencheurs ?? []).join(", ");
    morceaux.push(termes && termes !== critere ? `${critere} (${termes})` : critere || termes);
  }
  return morceaux.join(" ; ") || "—";
}

/** Rend la valeur, ou un tiret cadratin si elle est absente. */
const ouTiret = (valeur) => (valeur ? valeur : "—");

const deuxChiffres = (nombre) => String(nombre).padStart(2, "0");
const enFrancais = (jour) =>
  `${deuxChiffres(jour.getDate())}/${deuxChiffres(jour.getMonth() + 1)}/${jour.getFullYear()}`;
const enIso = (jour) =>
  `${jour.getFullYear()}-${deuxChiffres(jour.getMonth() + 1)}-${deuxChiffres(jour.getDate())}`;

// ----------------------------------------------------------------------
// Feuille 1 — Résumé
// ----------------------------------------------------------------------

function feuilleResume(classeur, classes, illisibles, criteres, nomDuModele, jour) {
  const feuille = classeur.addWorksheet("Résumé");
  feuille.views = [{ showGridLines: false }];
  largeurs(feuille, [34, 46]);
  const c = cahier(feuille);

  c.ajouter(["TriCV — Récapitulatif de tri"]);
  c.hauteur(1, 50);
  feuille.mergeCells("A1:B1");
  styler(c.cellule(1, 1), { gras: true, couleur: BLANC, fond: INDIGO, alignement: "center", taille: 16 });

  c.ajouter([`Généré le ${enFrancais(jour)}`]);
  feuille.mergeCells("A2:B2");
  styler(c.cellule(2, 1), { couleur: GRIS_TEXTE, fond: GRIS_CLAIR, alignement: "center", taille: 10 });

  c.ajouter();

  const nbSignales = classes.filter((candidat) => candidat.signalements?.length).length;
  const infos = [
    ["Modèle de poste", nomDuModele || "Critères personnalisés"],
    ["CV reçus", classes.length + illisibles.length],
    ["Analysés et classés", classes.length],
    ["À examiner manuellement", illisibles.length],
    ["Signalements", nbSignales],
    ["Critères de sélection", criteres.length],
  ];

  for (const [intitule, valeur] of infos) {
    const ligne = c.ajouter([intitule, String(valeur)]);
    c.hauteur(ligne, 25);
    styler(c.cellule(ligne, 1), { gras: true, fond: GRIS_HEADER });
    styler(c.cellule(ligne, 2), { fond: GRIS_CLAIR });
    filet(c.cellule(ligne, 1));
    filet(c.cellule(ligne, 2));
  }

  c.ajouter();

  // L'avertissement méthodologique, sur deux lignes fusionnées pour rester
  // lisible sans que l'utilisateur ait à élargir la colonne.
  for (const [texte, hauteur] of [[AVERTISSEMENT, 44], [NOTE_LECTURE, 58]]) {
    const ligne = c.ajouter([texte]);
    feuille.mergeCells(ligne, 1, ligne, 2);
    c.hauteur(ligne, hauteur);
    styler(c.cellule(ligne, 1), { fond: SCORE_AMBRE_FOND, couleur: SCORE_AMBRE_TEXTE });
    filet(c.cellule(ligne, 1));
  }

  c.ajouter();

  let ligne = c.ajouter(["Traitement éphémère — aucune conservation"]);
  feuille.mergeCells(ligne, 1, ligne, 2);
  styler(c.cellule(ligne, 1), { gras: true, couleur: GRIS_TEXTE });

  ligne = c.ajouter([
    "Les CV analysés pour produire ce récapitulatif n'ont jamais été " +
      "enregistrés sur un disque ni transmis à un tiers. Ce fichier est la " +
      "seule trace qui subsiste.",
  ]);
  feuille.mergeCells(ligne, 1, ligne, 2);
  c.hauteur(ligne, 58);
  styler(c.cellule(ligne, 1), { couleur: GRIS_TEXTE, taille: 10 });
}

// ----------------------------------------------------------------------
// Feuille 2 — Classement
// ----------------------------------------------------------------------

function feuilleClassement(classeur, classes, illisibles, criteres) {
  const feuille = classeur.addWorksheet("Classement");
  feuille.views = [{ showGridLines: false }];
  const c = cahier(feuille);

  const nomsCriteres = criteres.map((critere) => critere.nom ?? "");

  const intitules = [
    "Rang", "Candidat", "Email", "Téléphone", "Score /100", "Signalements",
    ...nomsCriteres.map((nom) => `${nom} (pts)`),
    "Mots-clés trouvés", "Mots-clés absents", "Fichier",
  ];

  largeurs(feuille, [6, 28, 30, 20, 12, 22, ...nomsCriteres.map(() => 16), 46, 46, 30]);
  ecrireEntete(c, intitules);

  classes.forEach((candidat, index) => {
    const rang = index + 1;
    const score = candidat.score ?? 0;

    // ATTENTION : le détail est repris DANS L'ORDRE DES CRITÈRES, et non
    // retrouvé par son nom. Python l'indexe par nom, et deux critères de même
    // nom — ce que « Ajouter un critère » produit par défaut, sans nom — s'y
    // écrasent : le classeur annonce alors zéro point sur les deux colonnes.
    // C'est le défaut n°1 du §4 de docs/MIGRATION-JS.md ; il est reproduit
    // ici tel quel pour que la comparaison avec Python reste exacte, et la
    // correction est l'objet de l'étape E7.
    const detailParNom = new Map();
    for (const ligne of candidat.detail ?? []) detailParNom.set(ligne.critere, ligne);

    const trouves = [];
    const absents = [];
    for (const nom of nomsCriteres) {
      const ligne = detailParNom.get(nom);
      if (ligne) {
        trouves.push(...(ligne.trouves ?? []));
        absents.push(...(ligne.absents ?? []));
      }
    }

    const valeurs = [
      rang,
      ouTiret(candidat.nom),
      ouTiret(candidat.email),
      ouTiret(candidat.telephone),
      score,
      resumerSignalements(candidat.signalements),
      ...nomsCriteres.map((nom) => {
        const ligne = detailParNom.get(nom);
        return ligne ? `${ligne.points} / ${ligne.poids}` : "—";
      }),
      trouves.join(", ") || "—",
      absents.join(", ") || "—",
      candidat.fichier ?? "—",
    ];

    const ligne = c.ajouter(valeurs);
    c.hauteur(ligne, 25);

    const fondLigne = rang % 2 === 0 ? BLANC : GRIS_CLAIR;
    const [scoreFond, scoreTexte] = couleursDuScore(score);

    for (let colonne = 1; colonne <= valeurs.length; colonne++) {
      const cellule = c.cellule(ligne, colonne);
      filet(cellule);
      if (colonne === 1) {
        styler(cellule, { fond: fondLigne, alignement: "center", couleur: GRIS_TEXTE });
      } else if (colonne === 5) {
        styler(cellule, { gras: true, couleur: scoreTexte, fond: scoreFond, alignement: "center" });
      } else if (colonne === 6 && candidat.signalements?.length) {
        styler(cellule, { couleur: SIGNALEMENT_TEXTE, fond: SIGNALEMENT_FOND, alignement: "center" });
      } else if (colonne >= 7 && colonne <= 6 + nomsCriteres.length) {
        styler(cellule, { fond: fondLigne, alignement: "center" });
      } else {
        styler(cellule, { fond: fondLigne });
      }
    }
  });

  // Bloc « À examiner manuellement », APRÈS le classement et séparé de lui.
  // Jamais en fin de tableau avec un score de 0 : les y mettre affirmerait
  // qu'ils correspondent mal au poste, alors qu'on n'en sait rien — on n'a pas
  // pu les lire (§7.5 du cadrage).
  if (!illisibles.length) return;

  c.ajouter();
  c.ajouter();

  let ligne = c.ajouter(["À examiner manuellement"]);
  styler(c.cellule(ligne, 1), { gras: true, taille: 13 });

  ligne = c.ajouter([NOTE_ILLISIBLES]);
  feuille.mergeCells(ligne, 1, ligne, 4);
  c.hauteur(ligne, 40);
  styler(c.cellule(ligne, 1), { couleur: GRIS_TEXTE, taille: 10 });

  ecrireEntete(c, ["Fichier", "Taille", "Raison", "Score /100"]);

  illisibles.forEach((candidat, position) => {
    const ligneIllisible = c.ajouter([
      candidat.fichier ?? "—",
      ouTiret(candidat.taille),
      "Document scanné, aucun texte lisible",
      "—",
    ]);
    c.hauteur(ligneIllisible, 25);
    const fond = (position + 1) % 2 === 0 ? BLANC : GRIS_CLAIR;
    for (let colonne = 1; colonne <= 4; colonne++) {
      const cellule = c.cellule(ligneIllisible, colonne);
      filet(cellule);
      styler(cellule, { fond, alignement: colonne === 4 ? "center" : "left" });
    }
  });
}

// ----------------------------------------------------------------------
// Feuille 3 — Critères
// ----------------------------------------------------------------------

function feuilleCriteres(classeur, criteres) {
  const feuille = classeur.addWorksheet("Critères");
  feuille.views = [{ showGridLines: false }];
  largeurs(feuille, [28, 14, 14, 62]);
  const c = cahier(feuille);

  ecrireEntete(c, ["Critère", "Type", "Poids", "Mots-clés recherchés"]);

  criteres.forEach((critere, position) => {
    const groupes = critere.groupes ?? [];
    // On réaffiche les mots-clés tels que l'utilisateur les a saisis quand on
    // les a sous la main, sinon on les reconstruit depuis les groupes. Le
    // lecteur du classeur doit pouvoir rejouer le tri.
    let motsCles = critere.motsCles;
    if (!motsCles) {
      motsCles = groupes
        .map((groupe) => (groupe.length === 1 ? groupe[0] : `${groupe[0]} = ${groupe.slice(1).join(", ")}`))
        .join("\n");
    }

    const typeCritere = critere.type ?? "requis";
    const ligne = c.ajouter([
      critere.nom ?? "",
      typeCritere === "exclusion" ? "Exclusion" : "Requis",
      typeCritere === "exclusion" ? "—" : critere.poids ?? 0,
      motsCles || "—",
    ]);
    // Une ligne par groupe de mots-clés, pour que rien ne soit tronqué.
    c.hauteur(ligne, Math.max(25, 15 * Math.max(1, groupes.length)));
    const fond = (position + 1) % 2 === 0 ? BLANC : GRIS_CLAIR;
    for (let colonne = 1; colonne <= 4; colonne++) {
      const cellule = c.cellule(ligne, colonne);
      filet(cellule);
      styler(cellule, { fond, alignement: colonne === 2 || colonne === 3 ? "center" : "left" });
    }
  });

  c.ajouter();
  const ligne = c.ajouter([
    "Un groupe de synonymes est écrit « terme principal = synonyme, synonyme ». " +
      "Le groupe compte pour trouvé si au moins un de ses termes figure dans le CV.",
  ]);
  feuille.mergeCells(ligne, 1, ligne, 4);
  c.hauteur(ligne, 30);
  styler(c.cellule(ligne, 1), { couleur: GRIS_TEXTE, taille: 10 });
}

// ----------------------------------------------------------------------
// Point d'entrée
// ----------------------------------------------------------------------

/**
 * Construit le classeur récapitulatif et le rend en octets.
 *
 * `candidats` : la liste des résultats. `criteres` : les critères utilisés.
 * `nomDuModele` : l'intitulé du modèle, ou null si les critères ont été
 * saisis à la main. `jour` : la date à inscrire ; laissée vide, c'est
 * aujourd'hui.
 *
 * POURQUOI `jour` EST UN PARAMÈTRE. Lire l'horloge rend une fonction impure :
 * deux appels identiques peuvent produire deux fichiers différents, et un test
 * ne peut rien affirmer sur le contenu. En laissant l'appelant fournir la
 * date, la fonction redevient vérifiable, tout en restant commode à l'usage.
 */
export async function genererClasseur(candidats, criteres, nomDuModele = null, jour = null) {
  const ExcelJS = await chargerExcelJs();
  const date = jour ?? new Date();

  // Les critères d'exclusion ne produisent pas de colonne de points : ils ne
  // rapportent rien (§7.4). Ils restent listés dans la feuille 3.
  const criteresRequis = criteres.filter((critere) => (critere.type ?? "requis") !== "exclusion");

  const classes = candidats
    .filter((candidat) => candidat.lisible)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const illisibles = candidats.filter((candidat) => !candidat.lisible);

  const classeur = new ExcelJS.Workbook();
  feuilleResume(classeur, classes, illisibles, criteres, nomDuModele, date);
  feuilleClassement(classeur, classes, illisibles, criteresRequis);
  feuilleCriteres(classeur, criteres);

  return classeur.xlsx.writeBuffer();
}

/**
 * Nom proposé au téléchargement.
 *
 * Volontairement NEUTRE : ni nom de candidat, ni intitulé de poste. Un nom de
 * fichier se retrouve dans l'historique de téléchargement du navigateur et
 * dans les pièces jointes des courriels — c'est-à-dire à des endroits durables
 * que l'utilisateur ne contrôle pas.
 */
export function nomDuFichierExport(jour = null) {
  return `tricv_recapitulatif_${enIso(jour ?? new Date())}.xlsx`;
}

/** Propose le classeur au téléchargement. */
export function telecharger(octets, nomDuFichier) {
  const blob = new Blob([octets], { type: TYPE_MIME_XLSX });
  const adresse = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = adresse;
  lien.download = nomDuFichier;
  document.body.append(lien);
  lien.click();
  lien.remove();
  // L'adresse d'objet retient le blob en mémoire tant qu'on ne la révoque
  // pas. Le téléchargement est lancé, elle n'a plus de raison d'être.
  URL.revokeObjectURL(adresse);
}

export { SEUIL_AMBRE, SEUIL_VERT };
