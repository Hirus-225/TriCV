// Tests de non-régression : la version JavaScript doit reproduire exactement
// les résultats du moteur Python de core/, enregistrés par
// tests/generer_reference_js.py dans web/tests/reference/.
//
// Chaque cas rend { statut, intitule, detail } :
//   "conforme" — identique à Python ;
//   "ecart"    — différent : à corriger ;
//   "tolere"   — différent pour une raison connue, écrite dans le cas même.
//
// Aucun cas n'est « tolere » à l'étape E3 : le moteur pur doit être au
// caractère près. La catégorie existe pour les étapes suivantes, où la lecture
// des PDF introduira des écarts légitimes (découpage en lignes).

import { arrondirCommePython, accorder, nombreFrancais, formaterTaille } from "../js/outils.js";
import { normaliser, recomposer, supprimerAccents } from "../js/normalisation.js";
import {
  analyserMotsCles,
  construireCritere,
  criteresIncomplets,
  formaterMotsCles,
  totalDesPoids,
} from "../js/criteres.js";
import { MODELES, chargerModele, nomsDesModeles } from "../js/modeles.js";
import { scorerCandidat } from "../js/scorer.js";
import {
  extraireNomDepuisFichier,
  extraireNomDepuisTexte,
  parserCv,
} from "../js/parser.js";
import { genererClasseur, nomDuFichierExport } from "../js/export.js";

const DOSSIER_REFERENCE = new URL("reference/", import.meta.url);
// Les CV du corpus sont hors de web/ : on remonte à la racine du projet,
// que le serveur local sert. En ligne ils n'existent pas — la page de
// tests est une page de développement.
const RACINE_PROJET = new URL("../../", import.meta.url);

/** Contenu brut d'un fichier du projet, en octets. */
async function lireFichier(chemin) {
  const reponse = await fetch(new URL(encodeURI(chemin), RACINE_PROJET));
  if (!reponse.ok) throw new Error(`${chemin} : HTTP ${reponse.status}`);
  return new Uint8Array(await reponse.arrayBuffer());
}

async function lireJson(nom) {
  const reponse = await fetch(new URL(nom, DOSSIER_REFERENCE));
  // fetch ne lève pas d'erreur sur un 404 : il faut tester `ok` soi-même.
  if (!reponse.ok) throw new Error(`${nom} : HTTP ${reponse.status}`);
  return reponse.json();
}

// ---------------------------------------------------------------------------
// Comparaison
// ---------------------------------------------------------------------------

/**
 * Égalité en profondeur. `===` ne compare que l'identité pour les tableaux et
 * les objets : deux tableaux de même contenu sont deux objets distincts, donc
 * « différents ». C'est le piège classique quand on vient de Python, où
 * `[1, 2] == [1, 2]` est vrai.
 *
 * L'ordre des clés d'un objet n'est pas significatif ; celui d'un tableau
 * l'est — et il compte ici, puisque l'ordre des groupes et des critères fait
 * partie de ce qu'on vérifie.
 */
function memeValeur(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    return a.length === b.length && a.every((valeur, i) => memeValeur(valeur, b[i]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const clesA = Object.keys(a);
    const clesB = Object.keys(b);
    return (
      clesA.length === clesB.length &&
      clesA.every((cle) => Object.hasOwn(b, cle) && memeValeur(a[cle], b[cle]))
    );
  }
  return false;
}

/** Cas de test : compare une valeur obtenue à la valeur attendue. */
function comparer(intitule, obtenu, attendu, contexte = {}) {
  return {
    statut: memeValeur(obtenu, attendu) ? "conforme" : "ecart",
    intitule,
    detail: { ...contexte, obtenu, attendu },
  };
}

// ---------------------------------------------------------------------------
// Groupe 1 — l'arrondi
// ---------------------------------------------------------------------------

function groupeArrondi(reference) {
  const cas = reference.map((c) =>
    comparer(`round(${c.valeur})`, arrondirCommePython(c.valeur), c.attendu),
  );

  // Contrôle supplémentaire : on montre que Math.round NE convient PAS. Si ce
  // cas devenait conforme, c'est que les valeurs de référence ne distinguent
  // plus les deux comportements — et le garde-fou serait devenu inutile sans
  // que rien ne le signale.
  const divergences = reference.filter((c) => Math.round(c.valeur) !== c.attendu);
  cas.push({
    statut: divergences.length > 0 ? "conforme" : "ecart",
    intitule: "les valeurs de référence distinguent bien Math.round de round()",
    detail: {
      obtenu: `${divergences.length} valeur(s) où Math.round diffère de Python`,
      attendu: "au moins une",
      exemples: divergences
        .slice(0, 5)
        .map((c) => `${c.valeur} : Python ${c.attendu}, Math.round ${Math.round(c.valeur)}`),
    },
  });

  return cas;
}

// ---------------------------------------------------------------------------
// Groupe 2 — la normalisation
// ---------------------------------------------------------------------------

function groupeNormalisation(reference) {
  const cas = [];
  for (const c of reference) {
    const apercu = JSON.stringify(c.entree);
    cas.push(comparer(`recomposer ${apercu}`, recomposer(c.entree), c.recompose));
    cas.push(
      comparer(`supprimerAccents ${apercu}`, supprimerAccents(c.entree), c.sansAccents),
    );
    cas.push(comparer(`normaliser ${apercu}`, normaliser(c.entree), c.normalise));
  }
  return cas;
}

// ---------------------------------------------------------------------------
// Groupe 3 — la syntaxe des mots-clés
// ---------------------------------------------------------------------------

function groupeCriteres(reference) {
  const cas = [];

  for (const c of reference.analyse) {
    cas.push(
      comparer(`analyserMotsCles ${JSON.stringify(c.saisie)}`, analyserMotsCles(c.saisie), c.groupes),
    );
  }

  for (const c of reference.allerRetour) {
    const intitule = `${c.modele} / ${c.critere}`;
    cas.push(comparer(`formaterMotsCles — ${intitule}`, formaterMotsCles(c.groupes), c.formate));
    // La propriété qui compte vraiment : le texte reformaté a le même SENS que
    // l'original. C'est ce qui garantit qu'un modèle affiché dans la zone de
    // saisie score bien ce qu'il montre.
    cas.push(
      comparer(
        `aller-retour stable — ${intitule}`,
        analyserMotsCles(formaterMotsCles(c.groupes)),
        c.groupesApresRetour,
      ),
    );
  }

  for (const c of reference.construction) {
    const { nom, poids, motsCles, type } = c.entree;
    cas.push(
      comparer(
        `construireCritere ${JSON.stringify(nom)} / ${JSON.stringify(motsCles)}`,
        construireCritere(nom, poids, motsCles, type),
        // Le Python rend les mêmes noms de champs : nom, poids, type, groupes.
        c.critere,
      ),
    );
  }

  for (const [index, c] of reference.indicateurs.entries()) {
    cas.push(comparer(`totalDesPoids — jeu ${index + 1}`, totalDesPoids(c.criteres), c.total));
    cas.push(
      comparer(`criteresIncomplets — jeu ${index + 1}`, criteresIncomplets(c.criteres), c.incomplets),
    );
  }

  return cas;
}

// ---------------------------------------------------------------------------
// Groupe 4 — les cinq modèles
// ---------------------------------------------------------------------------

function groupeModeles(reference) {
  const cas = [];

  cas.push(comparer("les 5 modèles du §8 sont présents", Object.keys(MODELES).length, reference.nbModeles));
  cas.push(comparer("ordre d'affichage des modèles", nomsDesModeles(), reference.ordre));

  for (const nom of reference.ordre) {
    const attendu = reference.modeles[nom];
    const obtenu = chargerModele(nom);

    cas.push(comparer(`« ${nom} » — critères, poids, mots-clés et groupes`, obtenu, attendu.criteres));
    cas.push(comparer(`« ${nom} » totalise exactement 100 points`, totalDesPoids(obtenu), attendu.total));
    cas.push(
      comparer(
        `« ${nom} » — nombre total de groupes de recherche`,
        obtenu.reduce((somme, critere) => somme + critere.groupes.length, 0),
        attendu.nbGroupes,
      ),
    );
    cas.push({
      statut: obtenu.every((critere) => critere.groupes.length > 0) ? "conforme" : "ecart",
      intitule: `« ${nom} » : aucun critère sans mot-clé`,
      detail: { criteresVides: obtenu.filter((c) => !c.groupes.length).map((c) => c.nom) },
    });
  }

  // chargerModele doit rendre des COPIES : modifier le résultat ne doit pas
  // altérer la constante MODELES. En JavaScript comme en Python, une variable
  // ne contient pas l'objet mais une référence vers lui — sans copie, le
  // modèle suivant serait servi altéré.
  const premier = chargerModele("Comptable");
  premier[0].poids = 999;
  premier[0].groupes.push(["intrus"]);
  cas.push(
    comparer(
      "chargerModele rend des copies : modifier le résultat n'altère pas MODELES",
      totalDesPoids(chargerModele("Comptable")),
      reference.modeles["Comptable"].total,
    ),
  );

  return cas;
}

// ---------------------------------------------------------------------------
// Groupe 5 — le scoring
// ---------------------------------------------------------------------------

/**
 * Le détail rendu par Python emploie la convention de nommage de Python
 * (`points_exacts`), celle de JavaScript emploie la sienne (`pointsExacts`).
 * Ce n'est pas un écart de comportement : on remet donc la référence dans la
 * forme JavaScript avant de comparer, plutôt que d'aligner les noms d'un côté
 * ou de l'autre et de trahir la convention d'un des deux langages.
 */
function detailEnFormeJs(detail) {
  return detail.map((ligne) => ({
    critere: ligne.critere,
    poids: ligne.poids,
    points: ligne.points,
    pointsExacts: ligne.points_exacts,
    trouves: ligne.trouves,
    absents: ligne.absents,
  }));
}

function groupeScoring(reference) {
  const cas = [];

  for (const c of reference) {
    const obtenu = scorerCandidat(c.texte, c.criteres);
    const contexte = { texte: c.texte, criteres: c.criteres };

    cas.push(comparer(`${c.intitule} — score`, obtenu.score, c.resultat.score, contexte));
    cas.push(
      comparer(`${c.intitule} — détail par critère`, obtenu.detail, detailEnFormeJs(c.resultat.detail), contexte),
    );
    cas.push(
      comparer(`${c.intitule} — signalements`, obtenu.signalements, c.resultat.signalements, contexte),
    );
  }

  return cas;
}

// ---------------------------------------------------------------------------
// Groupe 6 — les outils d'affichage
// ---------------------------------------------------------------------------

/**
 * Les outils d'affichage : accord en français, nombre à la française, taille
 * de fichier. Leurs valeurs attendues viennent de Python comme les autres.
 *
 * Deux pièges s'y cachent, et les cas de référence les visent exprès.
 * D'abord l'accord : écrire « 1 candidat(s) classé(s) » est le réflexe qui
 * économise cinq minutes et coûte la crédibilité de l'interface. Ensuite
 * l'arrondi, encore : `toFixed` arrondit 2,5 vers le haut quand Python va
 * vers le chiffre pair.
 */
function groupeOutils(reference) {
  const cas = [];

  for (const c of reference.accord) {
    cas.push(
      comparer(
        `accorder(${c.nombre}, ${JSON.stringify(c.singulier)})`,
        accorder(c.nombre, c.singulier, c.pluriel),
        c.attendu,
      ),
    );
  }

  for (const c of reference.nombre) {
    cas.push(
      comparer(
        `nombreFrancais(${c.valeur}, ${c.decimales})`,
        nombreFrancais(c.valeur, c.decimales),
        c.attendu,
      ),
    );
  }

  for (const c of reference.taille) {
    cas.push(comparer(`formaterTaille(${c.octets})`, formaterTaille(c.octets), c.attendu));
  }

  return cas;
}

// ---------------------------------------------------------------------------
// Groupe 7 — la lecture des fichiers
// ---------------------------------------------------------------------------

/**
 * Pour chaque fichier du corpus : le TEXTE EXTRAIT EN ENTIER doit être
 * identique à celui de Python, caractère par caractère.
 *
 * C'est le contrôle le plus exigeant de toute la migration, et le plus utile.
 * Un PDF ne contient pas de texte : il contient des instructions pour
 * dessiner des caractères à des positions. Deux bibliothèques différentes —
 * pdfplumber d'un côté, PDF.js de l'autre — peuvent en tirer deux textes
 * différents sans que ni l'une ni l'autre ait tort. Comparer les scores
 * seulement ne suffirait pas : un score peut rester juste par chance alors
 * que le texte diverge.
 */
async function groupeLecture(reference) {
  const cas = [];

  for (const attendu of reference.fichiers) {
    const intitule = attendu.fichier;

    let octets;
    try {
      octets = await lireFichier(attendu.chemin);
    } catch (erreur) {
      cas.push({
        statut: "ecart",
        intitule: `${intitule} — fichier introuvable`,
        detail: { message: erreur.message, chemin: attendu.chemin },
      });
      continue;
    }

    cas.push(comparer(`${intitule} — taille lue`, octets.length, attendu.octets));

    const obtenu = await parserCv(octets, attendu.fichier);

    cas.push(comparer(`${intitule} — TEXTE EXTRAIT`, obtenu.texte, attendu.texte));
    cas.push(comparer(`${intitule} — lisible`, obtenu.lisible, attendu.lisible));
    cas.push(comparer(`${intitule} — nom`, obtenu.nom, attendu.nom));
    cas.push(comparer(`${intitule} — email`, obtenu.email, attendu.email));
    cas.push(comparer(`${intitule} — téléphone`, obtenu.telephone, attendu.telephone));

    // Les deux moitiés de l'extraction du nom, séparément : c'est ce qui dit
    // laquelle a échoué quand le nom diverge.
    cas.push(
      comparer(
        `${intitule} — nom tiré du nom de fichier`,
        extraireNomDepuisFichier(attendu.fichier),
        attendu.nomDepuisFichier,
      ),
    );
    cas.push(
      comparer(
        `${intitule} — nom tiré du texte`,
        extraireNomDepuisTexte(attendu.texte),
        attendu.nomDepuisTexte,
      ),
    );

    if (attendu.scores) {
      for (const [nomDuModele, resultat] of Object.entries(attendu.scores)) {
        const calcule = scorerCandidat(obtenu.texte, chargerModele(nomDuModele));
        cas.push(comparer(`${intitule} — score « ${nomDuModele} »`, calcule.score, resultat.score));
        cas.push(
          comparer(
            `${intitule} — détail « ${nomDuModele} »`,
            calcule.detail,
            detailEnFormeJs(resultat.detail),
          ),
        );
      }
    }
  }

  return cas;
}

/**
 * Le contrôle C4 de verifier_moteur.py, transposé : le modèle « Comptable »
 * doit séparer le seul comptable du corpus des profils hors métier.
 *
 * CE QU'ON MESURE EST UN ÉCART, PAS UN SEUIL. La première version de ce
 * contrôle, côté Python, exigeait un score absolu d'au moins 70. Elle a sauté
 * dès l'ajout d'un cinquième groupe au critère le plus lourd : le comptable de
 * référence est tombé à 69 sans que le modèle soit devenu moins juste. Un
 * critère qui gagne un groupe partage ses points entre cinq au lieu de quatre,
 * et TOUS les candidats baissent ensemble — c'est arithmétique, pas un défaut.
 */
function groupeModeleComptable(reference, lecture) {
  const attendu = reference.modeleComptable;
  const cas = [];

  cas.push(
    comparer(
      "le comptable du corpus obtient le même score qu'en Python",
      lecture.get(attendu.cvDuComptable),
      attendu.scoreDuComptable,
    ),
  );

  const autres = [...lecture.entries()]
    .filter(([nom]) => nom !== attendu.cvDuComptable)
    .map(([, score]) => score);
  const meilleurHorsMetier = autres.length ? Math.max(...autres) : null;

  cas.push(
    comparer(
      "le meilleur profil hors métier obtient le même score qu'en Python",
      meilleurHorsMetier,
      attendu.meilleurHorsMetier,
    ),
  );

  const score = lecture.get(attendu.cvDuComptable);
  cas.push({
    statut: score !== undefined && score >= 60 ? "conforme" : "ecart",
    intitule: "le seul comptable du corpus reste largement au-dessus du plancher",
    detail: { obtenu: score, attendu: "au moins 60" },
  });
  cas.push({
    statut:
      score !== undefined && meilleurHorsMetier !== null && score - meilleurHorsMetier >= 40
        ? "conforme"
        : "ecart",
    intitule: "il se détache d'au moins 40 points du meilleur profil hors métier",
    detail: {
      obtenu: `${score} contre ${meilleurHorsMetier} (écart ${score - meilleurHorsMetier})`,
      attendu: "écart d'au moins 40",
    },
  });

  return cas;
}

// ---------------------------------------------------------------------------
// Groupe 9 — le classeur Excel
// ---------------------------------------------------------------------------

/**
 * On ne compare pas deux fichiers .xlsx octet par octet : deux classeurs
 * peuvent décrire la même feuille avec un XML différent, et openpyxl et
 * ExcelJS ne l'écrivent pas de la même façon. On compare ce qui se VOIT à
 * l'ouverture — valeur, police, fond, alignement, filets, fusions, largeurs,
 * hauteurs — en RELISANT le fichier qu'on vient d'écrire. Ce qui compte n'est
 * pas ce que le code croit avoir demandé, c'est ce qui est dans le fichier.
 */

/** Les six chiffres d'une couleur ARGB. L'octet de transparence est ignoré :
 *  openpyxl écrit 00, ExcelJS écrit FF, et Excel ne l'applique pas aux
 *  cellules. */
const couleurHex = (argb) => (argb ? String(argb).slice(-6).toUpperCase() : null);

/**
 * L'alignement vertical, dans le vocabulaire du FICHIER et non dans celui de
 * la bibliothèque.
 *
 * ExcelJS appelle « middle » ce qu'openpyxl appelle « center ». Ce n'est pas
 * un écart de comportement : vérifié en ouvrant l'archive du .xlsx produit et
 * en lisant xl/styles.xml, les deux écrivent `vertical="center"`. Seul le mot
 * employé par l'API diffère, et c'est lui qu'on ramène ici au mot du fichier.
 */
const alignementVertical = (valeur) => (valeur === "middle" ? "center" : (valeur ?? null));

/** La lettre d'une colonne : 1 -> A, 27 -> AA. */
function lettreDeColonne(numero) {
  let lettre = "";
  let reste = numero;
  while (reste > 0) {
    const modulo = (reste - 1) % 26;
    lettre = String.fromCharCode(65 + modulo) + lettre;
    reste = Math.floor((reste - 1) / 26);
  }
  return lettre;
}

function decrireFeuille(feuille) {
  // ExcelJS compte les lignes autrement qu'openpyxl ; on prend une marge et
  // on repère nous-mêmes la dernière cellule remplie, comme le fait le script
  // Python — c'est la seule façon d'obtenir deux nombres comparables.
  const lignesAParcourir = Math.max(feuille.rowCount, 1) + 5;
  const colonnesAParcourir = Math.max(feuille.columnCount, 1) + 5;

  let derniereLigne = 0;
  let derniereColonne = 0;
  const cellules = [];

  for (let ligne = 1; ligne <= lignesAParcourir; ligne++) {
    for (let colonne = 1; colonne <= colonnesAParcourir; colonne++) {
      const cellule = feuille.getRow(ligne).getCell(colonne);

      // Dans une plage fusionnée, ExcelJS fait rendre à chaque cellule la
      // valeur de la première, tandis qu'openpyxl rend None. On ne décrit donc
      // que la cellule maîtresse, sans quoi tout bloc fusionné ressortirait
      // comme un écart.
      if (cellule.isMerged && cellule.master && cellule.master.address !== cellule.address) {
        continue;
      }

      const fond =
        cellule.fill && cellule.fill.pattern === "solid"
          ? couleurHex(cellule.fill.fgColor?.argb)
          : null;
      const valeur = cellule.value === undefined ? null : cellule.value;

      if (valeur !== null) {
        derniereLigne = Math.max(derniereLigne, ligne);
        derniereColonne = Math.max(derniereColonne, colonne);
      }
      if (valeur === null && fond === null) continue;

      const bordure = cellule.border ?? {};
      const filets = ["left", "right", "top", "bottom"].every(
        (cote) => bordure[cote]?.style === "thin",
      );

      cellules.push({
        adresse: cellule.address,
        valeur,
        gras: Boolean(cellule.font?.bold),
        taille: cellule.font?.size ?? null,
        police: cellule.font?.name ?? null,
        couleur: couleurHex(cellule.font?.color?.argb),
        fond,
        alignementH: cellule.alignment?.horizontal ?? null,
        alignementV: alignementVertical(cellule.alignment?.vertical),
        retourLigne: Boolean(cellule.alignment?.wrapText),
        filets,
      });
    }
  }

  const largeurs = {};
  for (let colonne = 1; colonne <= colonnesAParcourir; colonne++) {
    const largeur = feuille.getColumn(colonne).width;
    if (largeur !== undefined && largeur !== null) largeurs[lettreDeColonne(colonne)] = largeur;
  }

  const hauteurs = {};
  for (let ligne = 1; ligne <= lignesAParcourir; ligne++) {
    const hauteur = feuille.getRow(ligne).height;
    if (hauteur !== undefined && hauteur !== null) hauteurs[String(ligne)] = hauteur;
  }

  return {
    nom: feuille.name,
    grille: Boolean(feuille.views?.[0]?.showGridLines),
    derniereLigne,
    derniereColonne,
    fusions: [...(feuille.model?.merges ?? [])].sort(),
    largeurs,
    hauteurs,
    cellules,
  };
}

/**
 * Les critères de la référence emploient la convention de nommage de Python
 * (`mots_cles`) ; le code JavaScript emploie la sienne (`motsCles`). Ce n'est
 * pas un écart de comportement, on remet donc la référence dans la forme
 * JavaScript plutôt que de trahir la convention d'un des deux langages.
 */
const criteresEnFormeJs = (criteres) =>
  criteres.map((critere) => ({
    nom: critere.nom,
    poids: critere.poids,
    type: critere.type,
    groupes: critere.groupes,
    motsCles: critere.mots_cles,
  }));

async function groupeExport(reference) {
  const cas = [];
  const jour = new Date(`${reference.jour}T12:00:00`);

  cas.push(
    comparer("nom du fichier proposé au téléchargement", nomDuFichierExport(jour), reference.nomDuFichier),
  );

  for (const jeu of reference.jeux) {
    const octets = await genererClasseur(
      jeu.candidats,
      criteresEnFormeJs(jeu.criteres),
      jeu.modele,
      jour,
    );

    // On relit le fichier produit, et non l'objet en mémoire.
    const relu = new globalThis.ExcelJS.Workbook();
    await relu.xlsx.load(octets);

    cas.push(
      comparer(
        `${jeu.intitule} — les trois feuilles, dans l'ordre`,
        relu.worksheets.map((f) => f.name),
        jeu.nomsDesFeuilles,
      ),
    );

    for (const attendue of jeu.feuilles) {
      const feuille = relu.getWorksheet(attendue.nom);
      if (!feuille) {
        cas.push({
          statut: "ecart",
          intitule: `${jeu.intitule} / ${attendue.nom} — feuille absente`,
          detail: { attendu: attendue.nom },
        });
        continue;
      }

      const obtenue = decrireFeuille(feuille);
      const prefixe = `${jeu.intitule} / ${attendue.nom}`;

      cas.push(comparer(`${prefixe} — grille masquée`, obtenue.grille, attendue.grille));
      cas.push(comparer(`${prefixe} — dernière ligne remplie`, obtenue.derniereLigne, attendue.derniereLigne));
      cas.push(comparer(`${prefixe} — dernière colonne remplie`, obtenue.derniereColonne, attendue.derniereColonne));
      cas.push(comparer(`${prefixe} — cellules fusionnées`, obtenue.fusions, attendue.fusions));
      cas.push(comparer(`${prefixe} — largeurs de colonnes`, obtenue.largeurs, attendue.largeurs));
      cas.push(comparer(`${prefixe} — hauteurs de lignes`, obtenue.hauteurs, attendue.hauteurs));

      // Les cellules, comparées une par une : un écart doit désigner SA
      // cellule, pas « le tableau est différent ».
      const parAdresse = new Map(obtenue.cellules.map((c) => [c.adresse, c]));
      for (const attendueCellule of attendue.cellules) {
        cas.push(
          comparer(
            `${prefixe} — cellule ${attendueCellule.adresse}`,
            parAdresse.get(attendueCellule.adresse) ?? null,
            attendueCellule,
          ),
        );
        parAdresse.delete(attendueCellule.adresse);
      }
      // Ce qui reste a été écrit par la version JavaScript seule.
      for (const [adresse, surplus] of parAdresse) {
        cas.push({
          statut: "ecart",
          intitule: `${prefixe} — cellule ${adresse} écrite en trop`,
          detail: { obtenu: surplus, attendu: null },
        });
      }
    }
  }

  return cas;
}

// ---------------------------------------------------------------------------
// Affichage
// ---------------------------------------------------------------------------

const MARQUES = { conforme: "conforme", ecart: "ÉCART", tolere: "toléré" };

function dessinerGroupe(titre, cas) {
  const section = document.createElement("section");
  section.className = "groupe";

  const ecarts = cas.filter((c) => c.statut === "ecart").length;
  const tolerés = cas.filter((c) => c.statut === "tolere").length;

  const h2 = document.createElement("h2");
  h2.textContent = titre + " ";
  const compte = document.createElement("span");
  compte.className = "groupe__compte";
  compte.textContent =
    `${cas.length} cas · ${cas.length - ecarts - tolerés} conformes` +
    (tolerés ? ` · ${tolerés} tolérés` : "") +
    (ecarts ? ` · ${ecarts} écarts` : "");
  h2.append(compte);
  section.append(h2);

  // On ne dessine que les écarts et les tolérés en détail : une page de mille
  // lignes vertes ne se lit pas. Les conformes sont comptés dans l'en-tête.
  const aMontrer = cas.filter((c) => c.statut !== "conforme");
  if (!aMontrer.length) {
    section.append(Object.assign(document.createElement("p"), {
      className: "intro",
      textContent: "Tous les cas sont conformes à la référence Python.",
    }));
    document.getElementById("groupes").append(section);
    return { total: cas.length, ecarts, tolerés };
  }

  const table = document.createElement("table");
  table.className = "cas";
  table.innerHTML = "<thead><tr><th>Statut</th><th>Cas</th></tr></thead>";
  const corps = document.createElement("tbody");

  for (const c of aMontrer) {
    const ligne = document.createElement("tr");

    const statut = document.createElement("td");
    statut.className = `statut statut-${c.statut}`;
    statut.textContent = MARQUES[c.statut];

    const contenu = document.createElement("td");
    contenu.textContent = c.intitule;
    const details = document.createElement("details");
    details.append(Object.assign(document.createElement("summary"), { textContent: "voir le détail" }));
    const pre = document.createElement("pre");
    pre.textContent = JSON.stringify(c.detail, null, 2);
    details.append(pre);
    contenu.append(details);

    ligne.append(statut, contenu);
    corps.append(ligne);
  }

  table.append(corps);
  section.append(table);
  document.getElementById("groupes").append(section);
  return { total: cas.length, ecarts, tolerés };
}

async function lancer() {
  const bilan = document.getElementById("bilan");

  let references;
  try {
    const [arrondi, normalisation, criteres, modeles, scoring, formatage, lecture, exportation] =
      await Promise.all([
        lireJson("arrondi.json"),
        lireJson("normalisation.json"),
        lireJson("criteres.json"),
        lireJson("modeles.json"),
        lireJson("scoring.json"),
        lireJson("formatage.json"),
        lireJson("lecture.json"),
        lireJson("export.json"),
      ]);
    references = { arrondi, normalisation, criteres, modeles, scoring, formatage, lecture, exportation };
  } catch (erreur) {
    bilan.className = "bilan echec";
    bilan.textContent =
      `Références introuvables (${erreur.message}). Lancer d'abord : ` +
      "./venv/bin/python tests/generer_reference_js.py";
    return;
  }

  // Les scores calculés ici servent au contrôle C4, juste après.
  const casLecture = await groupeLecture(references.lecture);
  const scoresComptable = new Map();
  for (const attendu of references.lecture.fichiers) {
    if (!attendu.scores || !attendu.chemin.startsWith("tests/corpus/")) continue;
    const octets = await lireFichier(attendu.chemin).catch(() => null);
    if (!octets) continue;
    const { texte } = await parserCv(octets, attendu.fichier);
    scoresComptable.set(attendu.fichier, scorerCandidat(texte, chargerModele("Comptable")).score);
  }

  const groupes = [
    ["1. Arrondi — round() de Python, pas Math.round", groupeArrondi(references.arrondi)],
    ["2. Normalisation du texte", groupeNormalisation(references.normalisation)],
    ["3. Syntaxe des mots-clés", groupeCriteres(references.criteres)],
    ["4. Les cinq modèles", groupeModeles(references.modeles)],
    ["5. Scoring", groupeScoring(references.scoring)],
    ["6. Outils d'affichage", groupeOutils(references.formatage)],
    ["7. Lecture des fichiers", casLecture],
    [
      "8. Le modèle « Comptable » sépare-t-il le métier ?",
      groupeModeleComptable(references.lecture, scoresComptable),
    ],
    ["9. Le classeur Excel", await groupeExport(references.exportation)],
  ];

  let total = 0;
  let ecarts = 0;
  let tolerés = 0;
  for (const [titre, cas] of groupes) {
    const compte = dessinerGroupe(titre, cas);
    total += compte.total;
    ecarts += compte.ecarts;
    tolerés += compte.tolerés;
  }

  bilan.className = ecarts ? "bilan echec" : "bilan ok";
  bilan.textContent = ecarts
    ? `${ecarts} écart(s) sur ${total} cas — la version JavaScript ne reproduit pas le moteur Python.`
    : `${total} cas, aucun écart` +
      (tolerés ? ` (dont ${tolerés} tolérés et documentés).` : ". La version JavaScript reproduit le moteur Python.");
}

lancer();
