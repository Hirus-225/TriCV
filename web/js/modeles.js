// Les cinq modèles de critères pré-remplis.
//
// Transposition de `core/modeles.py`, lui-même transcription du §8 du
// cadrage. Un formulaire vide fait fuir l'utilisateur : ces cinq modèles
// couvrent l'essentiel du marché visé et donnent un point de départ
// modifiable.
//
// POURQUOI LES MOTS-CLÉS SONT STOCKÉS EN TEXTE, PAS EN GROUPES.
//
// Chaque critère porte ses mots-clés sous la forme exacte que l'utilisateur
// verra dans la zone de saisie, et `chargerModele` les convertit en groupes
// au moment de l'usage. On aurait pu stocker directement les groupes, mais il
// aurait alors fallu les reformater pour les afficher — et la moindre
// divergence entre les deux écritures aurait produit un modèle qui ne score
// pas ce qu'il montre. Ici, ce qui est affiché EST ce qui est scoré.
//
// CONVENTION D'ÉCRITURE. Les mots-clés sont écrits sans accent, comme le
// prescrit le §8 du cadrage. Cela n'a aucun effet sur le résultat : la
// normalisation retire les accents des deux côtés de la comparaison, donc
// « comptabilite generale » trouve « Comptabilité générale » et
// réciproquement. C'est uniquement une convention d'écriture.
//
// Aucun modèle ne contient de critère d'exclusion : ceux-ci dépendent du
// contexte de recrutement et sont ajoutés par l'utilisateur.
//
// ---------------------------------------------------------------------------
// CE BLOC DE DONNÉES EST ENGENDRÉ DEPUIS core/modeles.py, PAS RECOPIÉ.
//
// Les mots-clés sont de longues chaînes où une faute de frappe — une virgule
// de trop, un « = » manquant — ne se verrait pas à la relecture et changerait
// silencieusement les scores. La page de tests compare d'ailleurs ce bloc,
// critère par critère et groupe par groupe, à ce que Python produit : une
// divergence y apparaît en rouge.
//
// Le modèle « Comptable » porte le recalibrage du 16/09/2026, dont la
// justification complète est dans core/modeles.py : quatre des quinze
// mots-clés d'origine ne se déclenchaient JAMAIS, parce qu'un mot-clé de
// plusieurs mots est une expression exacte. Chaque groupe porte désormais un
// CONCEPT et ses écritures usuelles, réunis par le signe « = ».
// ---------------------------------------------------------------------------

import { analyserMotsCles, totalDesPoids } from "./criteres.js";

export const MODELES = {
  "Développeur web": [
    {
      nom: "Langages & frameworks",
      poids: 35,
      motsCles: "python\njavascript = js\ndjango = flask\nreact = vue, angular",
    },
    {
      nom: "Bases de données",
      poids: 20,
      motsCles: "sql\npostgresql = postgres\nmysql\nmongodb = nosql",
    },
    {
      nom: "Outils & versioning",
      poids: 15,
      motsCles: "git = github, gitlab\ndocker\nlinux",
    },
    {
      nom: "Expérience terrain",
      poids: 20,
      motsCles: "developpeur = developer, ingenieur logiciel\nfreelance\nstage",
    },
    {
      nom: "Formation",
      poids: 10,
      motsCles: "licence = bachelor\nmaster\ninformatique",
    },
  ],
  "Comptable": [
    {
      nom: "Comptabilité générale",
      poids: 35,
      motsCles: "comptabilite generale = comptabilite analytique, ecritures comptables, saisie comptable\nrapprochement bancaire = rapprochements bancaires\netats financiers = etat financier, bilan, compte de resultat, balance generale\nsyscohada = ohada, syscoa\nmanuel de procedure = manuel de procedures, procedures comptables, procedures de gestion, procedures, procedure",
    },
    {
      nom: "Fiscalité & déclarations",
      poids: 25,
      motsCles: "fiscalite = fiscal, fiscale, fiscales, fiscaux\ntva\ndeclaration fiscale = declarations fiscales, declaration d'impots\ncnps = charges sociales, cotisations sociales",
    },
    {
      nom: "Outils",
      poids: 20,
      motsCles: "sage = saari, sage 100\nexcel = tableur\nerp = sap, dynamics, odoo, tompro, oracle",
    },
    {
      nom: "Expérience",
      poids: 20,
      motsCles: "comptable\nchef comptable = comptable senior, responsable comptable, directeur financier\ncabinet = cabinet comptable, cabinet d'expertise\naudit = controle de gestion, controle interne, commissariat aux comptes",
    },
  ],
  "Assistant administratif": [
    {
      nom: "Administration",
      poids: 30,
      motsCles: "gestion administrative\ncourrier\narchivage\nagenda = planning",
    },
    {
      nom: "Ressources humaines",
      poids: 30,
      motsCles: "recrutement\npaie = salaire, payroll\ncontrat de travail\ndossier du personnel",
    },
    {
      nom: "Bureautique",
      poids: 20,
      motsCles: "word\nexcel\npowerpoint\noutlook",
    },
    {
      nom: "Qualités & langues",
      poids: 20,
      motsCles: "anglais\nredaction\norganisation",
    },
  ],
  "Commercial terrain": [
    {
      nom: "Développement commercial",
      poids: 35,
      motsCles: "prospection\nnegociation\nportefeuille client\nchiffre d'affaires",
    },
    {
      nom: "Relation client",
      poids: 25,
      motsCles: "relation client = service client\nfidelisation\nreclamation",
    },
    {
      nom: "Outils",
      poids: 15,
      motsCles: "crm\nsalesforce\nexcel\nreporting",
    },
    {
      nom: "Expérience",
      poids: 25,
      motsCles: "commercial\ncharge de clientele\nterrain",
    },
  ],
  "Logistique": [
    {
      nom: "Gestion des flux",
      poids: 35,
      motsCles: "approvisionnement\nstock = inventaire\ntransit\ndouane",
    },
    {
      nom: "Transport",
      poids: 25,
      motsCles: "transport\nfret\nimport = export\nincoterms",
    },
    {
      nom: "Outils",
      poids: 20,
      motsCles: "erp\nsap\nexcel\nwms",
    },
    {
      nom: "Expérience",
      poids: 20,
      motsCles: "logistique\nsupply chain\nmagasinier",
    },
  ],
};

// Ce que la liste des modèles affiche en premier, avant tout choix.
export const LIBELLE_AUCUN_MODELE = "— Choisir un modèle —";

/** Les intitulés des modèles, dans l'ordre d'affichage. */
export function nomsDesModeles() {
  return Object.keys(MODELES);
}

/**
 * Rend les critères d'un modèle, prêts pour le scorer ET pour l'affichage.
 *
 * Chaque critère rendu porte :
 *   - `nom`, `poids`, `type` ;
 *   - `motsCles`, le texte à afficher dans la zone de saisie ;
 *   - `groupes`, la structure que consomme `scorerCandidat`.
 *
 * Les objets rendus sont des COPIES. Sans cela, l'interface modifierait
 * MODELES en place et le modèle suivant serait servi altéré — un défaut
 * déroutant, parce que rien dans le code n'aurait l'air d'écrire dans la
 * constante. En JavaScript le piège est le même qu'en Python : une variable
 * ne contient pas l'objet, mais une référence vers lui.
 *
 * Lève une erreur si le modèle n'existe pas : c'est une faute de
 * programmation, pas une saisie utilisateur, et elle doit être bruyante.
 */
export function chargerModele(nomDuModele) {
  const criteres = MODELES[nomDuModele];
  if (!criteres) throw new Error(`Modèle inconnu : ${nomDuModele}`);

  return criteres.map((critere) => ({
    nom: critere.nom,
    poids: critere.poids,
    type: "requis",
    motsCles: critere.motsCles,
    groupes: analyserMotsCles(critere.motsCles),
  }));
}

/** Somme des poids d'un modèle. Doit valoir 100 pour les cinq. */
export function totalDesPoidsDuModele(nomDuModele) {
  return totalDesPoids(chargerModele(nomDuModele));
}
