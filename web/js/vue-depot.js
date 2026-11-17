// La section « CV » : dépôt des fichiers, contrôles, lancement et analyse.
//
// REMPLACE `afficher_etape_depot` et `analyser_les_cv` (app.py).

import { construireCritere, criteresIncomplets, totalDesPoids } from "./criteres.js";
import { etat, nouveauFichier } from "./etat.js";
import { accorder, formaterTaille, nombreFrancais } from "./outils.js";
import { parserCv } from "./parser.js";
import { scorerCandidat } from "./scorer.js";

// §3 du cadrage. Ces deux plafonds venaient du gigaoctet de mémoire partagé de
// Streamlit ; sur un site statique, la limite est celle de l'appareil du
// visiteur. Ils sont conservés en l'état pour l'instant — c'est la décision D1
// de docs/MIGRATION-JS.md — et rassemblés ici pour qu'en changer tienne en
// deux lignes.
export const MAX_FICHIERS = 40;
export const MAX_OCTETS_PAR_FICHIER = 5 * 1024 * 1024;
const FORMATS_ACCEPTES = [".pdf", ".docx"];

let auChangement = () => {};
let surResultats = () => {};

function element(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

const extension = (nom) => {
  const point = nom.lastIndexOf(".");
  return point > 0 ? nom.slice(point).toLowerCase() : "";
};

// ---------------------------------------------------------------------------
// Dépôt
// ---------------------------------------------------------------------------

/**
 * Contrôle un fichier au moment du dépôt, et rend la raison du refus, ou null.
 *
 * DEUX CONTRÔLES QUE LA VERSION PYTHON NE FAISAIT PAS ELLE-MÊME.
 *
 * Le format : `st.file_uploader` filtrait en amont, et le code n'avait donc
 * jamais à traiter un .doc. Dans un navigateur, l'attribut `accept` n'est
 * qu'une suggestion pour la fenêtre de sélection — un glisser-déposer passe
 * outre. Sans ce contrôle, l'utilisateur qui dépose un .doc lirait
 * « Fichier illisible ou endommagé » et croirait son document abîmé, alors
 * qu'il suffit de l'enregistrer en .docx.
 *
 * La taille : le plafond de 5 Mo était appliqué par `server.maxUploadSize`,
 * c'est-à-dire par l'hébergeur. Il n'y a plus d'hébergeur ; si l'on garde le
 * plafond, c'est ici qu'il se programme.
 */
function refuser(fichier) {
  const suffixe = extension(fichier.name);
  if (!FORMATS_ACCEPTES.includes(suffixe)) {
    return (
      `Format non pris en charge : ${suffixe || "inconnu"}. ` +
      "Enregistrez le document en .docx depuis Word, ou exportez-le en PDF."
    );
  }
  if (fichier.size > MAX_OCTETS_PAR_FICHIER) {
    return `Fichier trop volumineux : ${formaterTaille(fichier.size)}. Le maximum est de 5 Mo.`;
  }
  return null;
}

function ajouterFichiers(liste) {
  for (const fichier of liste) {
    // Deux dépôts successifs du même fichier : on ne l'ajoute qu'une fois.
    const deja = etat.fichiers.some(
      (f) => f.nom === fichier.nom && f.taille === fichier.size,
    );
    if (deja) continue;
    etat.fichiers.push(nouveauFichier(fichier, refuser(fichier)));
  }
  // Un nouveau dépôt n'invalide pas le classement affiché : il correspond
  // toujours aux fichiers analysés. C'est le lancement qui le remplacera.
  dessiner();
  auChangement();
}

function dessinerListeDesFichiers() {
  const liste = document.getElementById("liste-fichiers");
  liste.replaceChildren();

  for (const entree of etat.fichiers) {
    const ligne = element("li", entree.erreur ? "fichier fichier--refuse" : "fichier");

    const texte = element("span", "fichier__texte");
    texte.append(element("span", "fichier__nom", entree.nom));
    texte.append(element("span", "fichier__taille", formaterTaille(entree.taille)));
    if (entree.erreur) texte.append(element("span", "fichier__erreur", entree.erreur));
    ligne.append(texte);

    const retirer = element("button", "fichier__retirer", "✕");
    retirer.type = "button";
    retirer.title = `Retirer ${entree.nom}`;
    retirer.setAttribute("aria-label", retirer.title);
    retirer.addEventListener("click", () => {
      etat.fichiers = etat.fichiers.filter((f) => f.id !== entree.id);
      dessiner();
      auChangement();
    });
    ligne.append(retirer);

    liste.append(ligne);
  }
}

// ---------------------------------------------------------------------------
// État du lancement
// ---------------------------------------------------------------------------

/** Les critères saisis, transformés en structures que le moteur consomme. */
export function criteresPrets() {
  return etat.criteres.map((c) => construireCritere(c.nom, c.poids, c.motsCles, c.type));
}

const fichiersValides = () => etat.fichiers.filter((f) => !f.erreur);

/**
 * Met à jour les messages, le résumé et l'état du bouton.
 *
 * Le bouton désactivé dit toujours POURQUOI il l'est, juste en dessous. Un
 * bouton grisé sans explication est une impasse : l'utilisateur ne sait pas
 * ce qu'on attend de lui.
 */
export function rafraichir() {
  const valides = fichiersValides();
  const criteres = criteresPrets();
  const poidsTotal = totalDesPoids(criteres);
  const manquants = criteresIncomplets(criteres);
  const tropDeFichiers = valides.length > MAX_FICHIERS;

  const messages = document.getElementById("messages-depot");
  messages.replaceChildren();

  if (tropDeFichiers) {
    messages.append(
      element(
        "p",
        "alerte alerte--erreur",
        `${valides.length} fichiers déposés. Le maximum est de ${MAX_FICHIERS} par ` +
          "session : au-delà, l'analyse devient longue dans votre navigateur. " +
          `Retirez-en ${valides.length - MAX_FICHIERS} et relancez.`,
      ),
    );
  }

  if (manquants.length) {
    const noms = manquants.map((nom) => `« ${nom || "critère sans nom"} »`).join(", ");
    messages.append(
      element(
        "p",
        "alerte alerte--avertissement",
        manquants.length === 1
          ? "Ce critère a un poids mais aucun mot-clé, et abaisse donc tous les " +
            `scores sans rien pouvoir rapporter : ${noms}`
          : "Ces critères ont un poids mais aucun mot-clé, et abaissent donc tous " +
            `les scores sans rien pouvoir rapporter : ${noms}`,
      ),
    );
  }

  const resume = document.getElementById("depot-resume");
  if (valides.length) {
    const octets = valides.reduce((somme, f) => somme + f.taille, 0);
    resume.textContent =
      accorder(valides.length, "fichier déposé", "fichiers déposés") +
      ` · ${nombreFrancais(octets / 1048576)} Mo au total`;
  } else {
    resume.textContent = "";
  }

  const bouton = document.getElementById("lancer");
  const pret = valides.length > 0 && poidsTotal > 0 && !tropDeFichiers && !etat.analyseEnCours;
  bouton.disabled = !pret;
  bouton.textContent = valides.length
    ? `Lancer l'analyse des ${valides.length} CV`
    : "Lancer l'analyse";

  const raison = document.getElementById("lancer-raison");
  if (etat.analyseEnCours) {
    raison.textContent = "Analyse en cours…";
  } else if (poidsTotal <= 0) {
    raison.textContent =
      "Définissez au moins un critère avec un poids à l'étape 1 pour activer l'analyse.";
  } else if (!valides.length) {
    raison.textContent = "Déposez au moins un CV pour activer l'analyse.";
  } else {
    raison.textContent = "";
  }
}

export function dessiner() {
  dessinerListeDesFichiers();
  rafraichir();
}

// ---------------------------------------------------------------------------
// L'analyse
// ---------------------------------------------------------------------------

/** Rend la main au navigateur, le temps qu'il redessine la barre. */
const respirer = () => new Promise((suite) => setTimeout(suite, 0));

/**
 * Analyse le lot et ne conserve que les résultats.
 *
 * LE POINT CRITIQUE DE TOUT LE FICHIER est la ligne `delete resultat.texte`.
 *
 * Le lecteur rend le texte intégral du CV. On le passe au scorer, puis on le
 * SUPPRIME avant que le résultat n'entre dans l'état. Sans cette ligne, le
 * texte complet de quarante CV resterait en mémoire pour toute la durée de la
 * session : c'est la règle n°3 du §5 du cadrage.
 *
 * Les fichiers sont lus UN PAR UN, et leurs octets ne sont jamais conservés :
 * `fichier.arrayBuffer()` rend le contenu, on s'en sert, on passe au suivant.
 */
async function analyser() {
  const valides = fichiersValides();
  const criteres = criteresPrets();
  const total = valides.length;

  etat.analyseEnCours = true;
  rafraichir();

  const zone = document.getElementById("analyse");
  const barre = document.getElementById("analyse-barre");
  const texteEtat = document.getElementById("analyse-etat");
  zone.hidden = false;
  zone.classList.remove("analyse--terminee");
  barre.style.width = "0%";
  texteEtat.textContent = "Préparation…";
  await respirer();

  const resultats = [];

  for (const [index, entree] of valides.entries()) {
    barre.style.width = `${(index / total) * 100}%`;
    texteEtat.textContent = `Extraction du texte · ${entree.nom}  (${index + 1} sur ${total})`;
    await respirer();

    let resultat;
    try {
      const octets = new Uint8Array(await entree.fichier.arrayBuffer());
      resultat = await parserCv(octets, entree.nom);
    } catch {
      // On ne journalise NI l'erreur NI son message : il peut contenir des
      // fragments du document (règle n°5 du §5).
      resultats.push({
        fichier: entree.nom,
        lisible: false,
        nom: null,
        email: null,
        telephone: null,
        score: null,
        signalements: [],
        detail: [],
        taille: formaterTaille(entree.taille),
        raison: "Fichier illisible ou endommagé",
      });
      continue;
    }

    if (resultat.lisible) {
      Object.assign(resultat, scorerCandidat(resultat.texte, criteres));
    } else {
      resultat.score = null;
      resultat.signalements = [];
      resultat.detail = [];
      resultat.raison =
        resultat.raison === "protege"
          ? "Document protégé par mot de passe"
          : resultat.raison === "illisible"
            ? "Fichier illisible ou endommagé"
            : "Document scanné, aucun texte lisible";
    }

    resultat.taille = formaterTaille(entree.taille);

    // ↓↓↓ Libération du texte brut. Ne jamais retirer cette ligne. ↓↓↓
    delete resultat.texte;

    resultats.push(resultat);
  }

  barre.style.width = "100%";
  texteEtat.textContent = `Analyse terminée — ${accorder(total, "CV", "CV")} traités`;
  zone.classList.add("analyse--terminee");

  etat.resultats = resultats;
  etat.criteresAnalyse = criteres;
  etat.analyseEnCours = false;
  rafraichir();
  surResultats();
}

// ---------------------------------------------------------------------------
// Branchement
// ---------------------------------------------------------------------------

export function brancher(surChangement, quandResultats) {
  auChangement = surChangement;
  surResultats = quandResultats;

  const champ = document.getElementById("champ-fichiers");
  champ.addEventListener("change", () => {
    ajouterFichiers([...champ.files]);
    // On vide le champ : sans cela, redéposer le même fichier après l'avoir
    // retiré ne déclencherait aucun événement, le champ n'ayant pas changé.
    champ.value = "";
  });

  const depot = document.getElementById("depot");
  for (const evenement of ["dragenter", "dragover"]) {
    depot.addEventListener(evenement, (e) => {
      e.preventDefault();
      depot.classList.add("depot--survol");
    });
  }
  for (const evenement of ["dragleave", "drop"]) {
    depot.addEventListener(evenement, () => depot.classList.remove("depot--survol"));
  }
  depot.addEventListener("drop", (e) => {
    e.preventDefault();
    ajouterFichiers([...e.dataTransfer.files]);
  });

  document.getElementById("lancer").addEventListener("click", () => {
    analyser();
  });

  dessiner();
}
