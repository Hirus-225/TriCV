// Extraction du texte et des informations candidat.
//
// Transposition de `core/parser.py`. Conforme aux §7.5, §7.7 et §7.8 du
// cadrage.
//
// RIEN N'EST ÉCRIT NULLE PART, et cette fois c'est vrai par construction
// plutôt que par discipline. En Python, la règle « jamais d'écriture disque »
// tenait à ce qu'on passe au parser un objet mémoire et jamais un chemin.
// Dans un navigateur, le fichier déposé n'est de toute façon accessible que
// sous forme d'octets en mémoire, et la page n'a aucun moyen d'écrire sur le
// disque du visiteur. La règle n°1 du §5 devient structurelle.
//
// Aucune fonction de ce module n'affiche quoi que ce soit, ni ne journalise le
// texte extrait ou un nom de candidat (règle n°5 du §5).

import { ESPACE_CARACTERES, rogner } from "./outils.js";
import { normaliser, recomposer } from "./normalisation.js";
import { extraireTextePdf } from "./pdf-texte.js";
import { extraireTexteDocx } from "./docx-texte.js";

// ----------------------------------------------------------------------
// Seuil de lisibilité (§7.5)
// ----------------------------------------------------------------------

// En dessous de ce nombre de caractères APRÈS normalisation, on considère que
// l'extraction a échoué : le document est presque certainement un scan, une
// image sans couche texte.
//
// « Illisible » et « score de 0 » sont deux états DISTINCTS, et les confondre
// est précisément le défaut que cette détection corrige. Un CV illisible n'a
// pas de score du tout : il sort du classement et rejoint la section
// « À examiner manuellement ». Lui attribuer 0 le placerait en dernière
// position, ce qui affirmerait à tort qu'il ne correspond pas au poste.
export const SEUIL_TEXTE_MINIMUM = 100;

// ----------------------------------------------------------------------
// Expressions régulières
// ----------------------------------------------------------------------

const MOTIF_EMAIL = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;

// Formats ivoiriens. Les numéros comportent dix chiffres et commencent par
// 01, 05, 07 (mobiles) ou 25, 27 (fixes), avec un indicatif +225 facultatif,
// éventuellement entre parenthèses, et des séparateurs variables.
//
//   +225 07 58 41 22 96   (+225) 0758412296   07.58.41.22.96   0758412296
//
// (?<!\d) et (?!\d) empêchent d'attraper une tranche au milieu d'un nombre
// plus long (un numéro de compte, une référence).
const MOTIF_TELEPHONE = new RegExp(
  "(?<!\\d)" +
    "(?:\\(?\\+\\s?225\\)?[\\s.\\-]*)?" + // indicatif facultatif
    "(?:0[1257])" + //                      préfixe opérateur
    "(?:[\\s.\\-]?\\d{2}){4}" + //          quatre paires de chiffres
    "(?!\\d)",
);

// Ponctuation parasite en tête de ligne : tirets cadratins et demi-cadratins,
// puces, chevrons, astérisques, points. C'est ce qui avait donné
// « — Kouassi Guy-Désiré » dans RecrutPro.
//
// La classe d'espaces est celle de PYTHON, et non le `\s` de JavaScript : les
// deux ne recouvrent pas exactement les mêmes caractères, et ici la
// différence se verrait dans le texte extrait.
const PONCTUATION_INITIALE = new RegExp(
  `^[${ESPACE_CARACTERES}\\-\\u2010-\\u2015•·*>|:.,;_]+`,
);

// Espace, tabulation, espace insécable — exactement la classe de parser.py.
const ESPACES_MULTIPLES = /[ \t ]+/g;

// Une lettre, au sens Unicode : c'est `str.isalpha()` de Python. Surtout pas
// [a-zA-Z], qui rejetterait « Désiré ».
const LETTRES_SEULES = /^\p{L}+$/u;
const UNE_LETTRE = /\p{L}/u;
const MAJUSCULE = /\p{Lu}/u;

// `str.isdigit()` de Python : les chiffres décimaux, mais aussi les exposants
// et les chiffres cerclés. Repris de Rapprochement Bancaire, où la liste a
// été établie en comparant les deux langages caractère par caractère.
const CHIFFRE_ISDIGIT = new RegExp(
  "[\\p{Nd}\\u00b2\\u00b3\\u00b9\\u1369-\\u1371\\u19da\\u2070\\u2074-\\u2079\\u2080-\\u2089" +
    "\\u2460-\\u2468\\u2474-\\u247c\\u2488-\\u2490\\u24ea\\u24f5-\\u24fd\\u24ff\\u2776-\\u277e" +
    "\\u2780-\\u2788\\u278a-\\u2792\\u{10a40}-\\u{10a43}\\u{10e60}-\\u{10e68}\\u{11052}-\\u{1105a}" +
    "\\u{1f100}-\\u{1f10a}]",
  "u",
);

const SEPARATEURS_DE_MOT = new RegExp(`[${ESPACE_CARACTERES}]+`);

// ----------------------------------------------------------------------
// Intitulés de sections : des lignes qui ressemblent à un nom sans en être un
// ----------------------------------------------------------------------
//
// « CURRICULUM VITAE », « PROFIL PROFESSIONNEL » ou « EXPÉRIENCE
// PROFESSIONNELLE » passent tous les tests d'un nom naïf : deux mots, rien que
// des lettres. Sans cette liste, l'heuristique rendrait l'intitulé de la
// première section au lieu d'un nom.
//
// Les trois listes ci-dessous sont ENGENDRÉES depuis core/parser.py, comme les
// modèles : ce sont des dizaines de mots où une faute de recopie passerait
// inaperçue et changerait le nom affiché pour un candidat.
//
// NOTE DE MAINTENANCE (reprise de core/parser.py). Cette liste ne sera jamais
// complète : elle écarte des lignes vues sur de vrais CV, pas une catégorie
// close. Un mot qui y figure ne peut plus apparaître dans un nom de candidat.
// On n'y met donc QUE des mots qui ne sont ni prénoms ni patronymes en usage.

const MOTS_DE_SECTION = new Set([
  "administration", "adresse", "aptitudes", "assistant", "assistante",
  "audit", "auditeur", "benevolat", "candidature", "carriere", "celibataire",
  "centres", "certifications", "charge", "civil", "commercial", "commerciale",
  "competence", "competences", "competency", "comptable", "conduire",
  "conduite", "consultant", "contact", "contacts", "coordonnees",
  "curriculum", "cv", "developpeur", "diplome", "diplomes", "directeur",
  "directrice", "distinctions", "divers", "education", "emploi", "emplois",
  "enfant", "enfants", "etat", "etudes", "experience", "experiences",
  "finance", "formation", "formations", "gestion", "gestionnaire", "identite",
  "informations", "informatique", "ingenieur", "interets", "junior",
  "juriste", "languages", "langue", "langues", "lettre", "logistique",
  "loisirs", "marketing", "matrimoniale", "motivation", "naissance",
  "nationalite", "objectif", "objective", "parcours", "permis", "personnel",
  "personnelles", "poste", "professional", "professionnel", "professionnelle",
  "profil", "profile", "projects", "projet", "projets", "publications",
  "realisations", "reference", "references", "responsable", "resume",
  "secretaire", "senior", "situation", "skills", "stage", "stages", "summary",
  "technicien", "technique", "techniques", "vitae",
]);

const MOTS_DE_FICHIER_A_IGNORER = new Set([
  "candidature", "copie", "curriculum", "cv", "de", "def", "definitif", "des",
  "dev", "doc", "document", "docx", "dossier", "drh", "du", "final", "finale",
  "jour", "la", "le", "les", "lettre", "ma", "mes", "mise", "mon",
  "motivation", "nouveau", "nouvelle", "of", "pdf", "poste", "resume", "rh",
  "scan", "stage", "the", "version", "vitae", "word",
]);

const PARTICULES = new Set([
  "al", "ben", "bin", "d", "da", "de", "del", "della", "den", "der", "des",
  "di", "dos", "du", "el", "la", "le", "les", "ould", "ter", "van", "von",
]);

// Longueur minimale d'un fragment de nom de fichier pour être retenu comme
// partie d'un nom. Écarte « RH », « de », « v2 » sans écarter de vrais noms :
// les patronymes de moins de trois lettres sont rarissimes.
const LONGUEUR_MINIMALE_FRAGMENT = 3;

/** Les caractères d'une chaîne, un par un — et non ses unités UTF-16.
 *  `[...texte]` parcourt les points de code, comme Python le fait. */
const caracteres = (texte) => [...texte];

/** `str.split()` sans argument : découpe sur les espaces, sans vide aux bords. */
const mots = (ligne) => rogner(ligne).split(SEPARATEURS_DE_MOT).filter(Boolean);

// ----------------------------------------------------------------------
// Nettoyage du texte extrait
// ----------------------------------------------------------------------

/**
 * Remet en forme le texte sorti de l'extracteur, sans en altérer le sens.
 *
 * 1. RECOMPOSITION NFC. Les extracteurs de PDF rendent fréquemment les accents
 *    décomposés : « é » arrive sous la forme « e » suivi d'un accent aigu
 *    combinant. NFC les recolle. Sans cette étape, l'heuristique du nom rejette
 *    « Guy-Désiré », parce que l'accent isolé n'est pas une lettre.
 *
 * 2. NETTOYAGE DE LA PONCTUATION EN TÊTE DE LIGNE. Les puces et les tirets
 *    cadratins de mise en page se retrouvent collés au texte. C'est la seconde
 *    moitié du défaut documenté au §5.1.3 de PROCESS : le nom extrait était
 *    « — Kouassi Guy-Désiré », tiret compris.
 *
 * 3. RÉDUCTION DES ESPACES. Les PDF produisent souvent de longues séries
 *    d'espaces là où il y avait un alignement en colonnes.
 *
 * Les lignes vides sont CONSERVÉES : elles séparent les sections, et
 * l'heuristique du nom raisonne sur les premières lignes non vides.
 */
export function nettoyerTexte(texte) {
  if (!texte) return "";

  let resultat = recomposer(texte);
  resultat = resultat.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  return resultat
    .split("\n")
    .map((ligne) => rogner(ligne.replace(PONCTUATION_INITIALE, "").replace(ESPACES_MULTIPLES, " ")))
    .join("\n");
}

/**
 * Un document est lisible si son texte normalisé atteint le seuil du §7.5.
 *
 * On mesure APRÈS normalisation, et pas sur le texte brut, parce qu'un PDF
 * scanné rend parfois quelques dizaines de caractères parasites — numéros de
 * page, artefacts de compression, marques de mise en page. La normalisation
 * les réduit et évite de prendre ce bruit pour du contenu.
 */
export function estLisible(texte) {
  return caracteres(normaliser(texte)).length >= SEUIL_TEXTE_MINIMUM;
}

// ----------------------------------------------------------------------
// Informations candidat
// ----------------------------------------------------------------------

/** Première adresse électronique trouvée, ou null. */
export function extraireEmail(texte) {
  const trouve = MOTIF_EMAIL.exec(texte || "");
  if (!trouve) return null;
  // Une adresse en fin de phrase ramène parfois le point final.
  return trouve[0].replace(/\.+$/, "");
}

/** Premier numéro ivoirien trouvé, espaces réduits, ou null. */
export function extraireTelephone(texte) {
  const trouve = MOTIF_TELEPHONE.exec(texte || "");
  if (!trouve) return null;
  return rogner(trouve[0].replace(ESPACES_MULTIPLES, " "));
}

/**
 * Particules nobiliaires et liaisons qui s'écrivent légitimement en minuscules
 * À L'INTÉRIEUR d'un nom : « Jean de La Fontaine », « Kouamé N'guessan »,
 * « Van der Berg ».
 *
 * POURQUOI UNE RÈGLE DE CAPITALISATION PLUTÔT QU'UNE LISTE DE MOTS INTERDITS.
 *
 * L'essai sur échantillon réel du 16/09/2026 a produit deux faux noms :
 * « Permis de conduire ABCDE » et « Déclarations fiscales et sociales ». Les
 * écarter par une liste de mots aurait marché ce jour-là et échoué au CV
 * suivant : la liste des phrases qu'on peut trouver en tête d'un CV n'est pas
 * close, et l'allonger à chaque cas est une course perdue.
 *
 * Il existe une règle, elle : un nom propre s'écrit en capitales initiales.
 * Une phrase, non — elle porte au moins un mot en minuscules qui n'est pas une
 * particule.
 *
 * COÛT ASSUMÉ. Un candidat qui écrit son nom tout en minuscules n'est plus
 * reconnu, et le repli par le nom du fichier prend le relais. C'est rare, et
 * l'échec est silencieux et sans dommage, alors qu'un faux nom, lui, s'affiche
 * avec l'aplomb d'un vrai.
 */
function capitalisationDeNom(listeDeMots) {
  for (const mot of listeDeMots) {
    const lettres = caracteres(mot).filter((c) => UNE_LETTRE.test(c));
    if (!lettres.length) return false;
    if (MAJUSCULE.test(lettres[0])) continue;
    if (PARTICULES.has(normaliser(mot))) continue;
    return false;
  }
  return true;
}

/**
 * Décide si une ligne peut être un nom de personne. Quatre conditions :
 *
 *   - de deux à quatre mots (un mot seul est trop ambigu, cinq est une
 *     phrase) ;
 *   - chaque mot n'est composé que de lettres, de traits d'union ou
 *     d'apostrophes — ce qui écarte toute ligne contenant un chiffre, une
 *     arobase ou une virgule ;
 *   - aucun mot n'est un intitulé de section (« CURRICULUM VITAE ») ;
 *   - la ligne ne dépasse pas 60 caractères.
 */
function ressembleAUnNom(ligne) {
  if (!ligne || caracteres(ligne).length > 60) return false;

  const listeDeMots = mots(ligne);
  if (listeDeMots.length < 2 || listeDeMots.length > 4) return false;

  for (const mot of listeDeMots) {
    const fragments = mot.split(/[\-'’]/);
    const pleins = fragments.filter(Boolean);
    if (!pleins.length) return false;
    if (!pleins.every((f) => LETTRES_SEULES.test(f))) return false;
  }

  const normalises = new Set(normaliser(ligne).split(" ").filter(Boolean));
  for (const mot of normalises) {
    if (MOTS_DE_SECTION.has(mot)) return false;
  }

  return capitalisationDeNom(listeDeMots);
}

/**
 * Heuristique du §7.7 : le nom figure presque toujours dans les premières
 * lignes du CV.
 *
 * On examine les cinq premières lignes non vides et on retient la première qui
 * ressemble à un nom. La ligne est rendue telle que le candidat l'a écrite —
 * majuscules comprises, c'est sa propre présentation.
 *
 * Rend null si aucune ligne ne convient. C'est un échec NORMAL, prévu :
 * l'appelant enchaîne alors sur le repli par le nom du fichier.
 */
export function extraireNomDepuisTexte(texte) {
  const lignes = (texte || "")
    .split("\n")
    .map(rogner)
    .filter(Boolean)
    .slice(0, 5);
  for (const ligne of lignes) {
    if (ressembleAUnNom(ligne)) return ligne;
  }
  return null;
}

/** Première lettre en capitale, le reste en minuscules — `str.capitalize()`. */
function capitaliser(fragment) {
  const lettres = caracteres(fragment);
  if (!lettres.length) return fragment;
  return lettres[0].toUpperCase() + lettres.slice(1).join("").toLowerCase();
}

/** Capitale initiale en respectant les traits d'union : « Guy-Desire ». */
function mettreEnFormeFragment(fragment) {
  return fragment.split("-").map(capitaliser).join("-");
}

/** La racine d'un nom de fichier, sans son extension — `PurePath(...).stem`. */
function racineDuNom(nomFichier) {
  const nom = (nomFichier || "").split(/[\\/]/).pop();
  const point = nom.lastIndexOf(".");
  // `point > 0` et non `>= 0` : un fichier nommé « .pdf » n'a pas
  // d'extension, c'est un nom qui commence par un point.
  return point > 0 ? nom.slice(0, point) : nom;
}

/**
 * Repli du §7.7 : dériver le nom depuis le nom du fichier.
 *
 * En pratique les candidats nomment leur CV « CV_Kouassi_Jean.pdf », et c'est
 * plus fiable que d'afficher « Nom inconnu ».
 *
 * MAIS CE REPLI DOIT ÉCHOUER PROPREMENT. `CV_Rubben_Lago_2026_RH.pdf` donne un
 * nom exploitable, mais `CVBR.pdf`, `cv de MOHAMED.pdf` et
 * `Fatogoma_cv.DEC2025.pdf` n'en donnent aucun. Rendre « Cvbr » ou « Mohamed »
 * serait pire que de ne rien rendre : un nom absurde affiché avec assurance est
 * plus trompeur qu'une case vide, parce que le RH n'a aucun moyen de savoir
 * qu'il a été inventé.
 *
 * C'est l'exigence de DEUX fragments au moins qui fait échouer proprement : un
 * seul fragment peut être un prénom seul, un acronyme, ou n'importe quoi
 * d'autre — on ne peut pas trancher, donc on ne tranche pas.
 */
export function extraireNomDepuisFichier(nomFichier) {
  const racine = racineDuNom(nomFichier);
  const fragments = racine.split(/[\s_\-.]+/).filter(Boolean);

  const retenus = [];
  for (const fragment of fragments) {
    if (caracteres(fragment).some((c) => CHIFFRE_ISDIGIT.test(c))) continue;
    if (caracteres(fragment).length < LONGUEUR_MINIMALE_FRAGMENT) continue;
    if (MOTS_DE_FICHIER_A_IGNORER.has(normaliser(fragment))) continue;
    const parties = fragment.split(/['’]/).filter(Boolean);
    if (!parties.every((p) => LETTRES_SEULES.test(p))) continue;
    retenus.push(fragment);
  }

  if (retenus.length < 2) return null;
  // Au-delà de quatre fragments, on n'a plus affaire à un nom mais à une
  // phrase entière dans le nom de fichier. On ne devine pas.
  if (retenus.length > 4) return null;

  return retenus.map(mettreEnFormeFragment).join(" ");
}

/**
 * Nom du candidat : heuristique sur le texte, puis repli sur le nom du
 * fichier, puis null.
 *
 * SUR UN DOCUMENT ILLISIBLE, LE TEXTE NE VAUT RIEN. Un PDF scanné porte
 * souvent une maigre couche de texte : un tampon, un en-tête, une mention
 * isolée. L'essai du 16/09/2026 a montré ce que cela donne : un CV scanné ne
 * livrait que « MARIE SANS / ENFANT EN CHARGE », soit vingt-sept caractères de
 * situation de famille. L'outil en tirait « MARIE SANS » et l'affichait comme
 * identité du candidat, alors que le nom du fichier portait le vrai nom.
 *
 * Afficher une situation matrimoniale à la place d'un nom n'est pas une
 * imprécision, c'est une information fausse présentée avec l'aplomb d'une
 * information vraie. Quand le document est illisible, on va donc directement
 * au nom du fichier.
 */
export function extraireNom(texte, nomFichier) {
  if (!estLisible(texte)) return extraireNomDepuisFichier(nomFichier);
  return extraireNomDepuisTexte(texte) ?? extraireNomDepuisFichier(nomFichier);
}

// ----------------------------------------------------------------------
// Point d'entrée
// ----------------------------------------------------------------------

/** Extension d'un nom de fichier, en minuscules, point compris. */
function extension(nomFichier) {
  const nom = (nomFichier || "").split(/[\\/]/).pop();
  const point = nom.lastIndexOf(".");
  return point > 0 ? nom.slice(point).toLowerCase() : "";
}

/**
 * Aiguille vers le bon lecteur selon l'extension, et rend le texte nettoyé.
 *
 * `raison` vaut null si tout s'est bien passé, et sinon dit POURQUOI : format
 * non pris en charge, document protégé par mot de passe, fichier illisible.
 * Python ne faisait pas cette distinction et affichait « Document scanné »
 * dans les trois cas. On la retient ici sans rien changer au texte extrait ;
 * c'est l'interface qui décidera quoi en faire.
 */
export async function extraireTexte(octets, nomFichier) {
  const suffixe = extension(nomFichier);

  let resultat;
  if (suffixe === ".pdf") {
    resultat = await extraireTextePdf(octets);
  } else if (suffixe === ".docx") {
    resultat = extraireTexteDocx(octets);
  } else {
    return { texte: "", raison: "format", extension: suffixe };
  }

  return { texte: nettoyerTexte(resultat.texte), raison: resultat.raison, extension: suffixe };
}

/**
 * Point d'entrée du lecteur de CV.
 *
 * `octets` : le contenu du fichier, en mémoire. `nomFichier` : son nom
 * d'origine, nécessaire pour connaître le format et pour le repli
 * d'extraction du nom.
 *
 * Sur un document illisible, `texte` est rendu tel quel (souvent vide) et les
 * champs candidat sont remplis dans la mesure du possible. Le document ne doit
 * PAS être scoré : la règle du §7.5 est qu'« illisible » et « score de 0 »
 * sont deux états distincts.
 *
 * RÈGLE DE CONFIDENTIALITÉ. `texte` est la seule donnée volumineuse rendue par
 * ce module. L'appelant doit le passer au scorer puis le LIBÉRER, sans jamais
 * le conserver (règle n°3 du §5 du cadrage).
 */
export async function parserCv(octets, nomFichier) {
  const { texte, raison } = await extraireTexte(octets, nomFichier);

  return {
    fichier: nomFichier,
    lisible: estLisible(texte),
    nom: extraireNom(texte, nomFichier),
    email: extraireEmail(texte),
    telephone: extraireTelephone(texte),
    texte,
    raison,
  };
}
