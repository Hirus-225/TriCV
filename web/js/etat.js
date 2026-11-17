// L'état de la session : ce que l'application sait à un instant donné.
//
// REMPLACE `st.session_state`. Streamlit rejoue tout le script à chaque clic,
// et `session_state` est le dictionnaire qui survit d'une exécution à l'autre.
// Ici rien n'est rejoué : l'état est simplement un objet de module, et les
// fonctions qui le modifient sont rassemblées dans ce fichier plutôt que
// dispersées dans les vues.
//
// CE QU'ON Y MET, ET CE QU'ON N'Y MET JAMAIS. Les critères saisis et les
// RÉSULTATS. Jamais le texte des CV (règle n°3 du §5 du cadrage), jamais le
// contenu des fichiers. Les fichiers déposés y figurent sous la forme d'objets
// `File` du navigateur, qui ne sont que des RENVOIS vers un fichier du disque :
// tant qu'on ne les lit pas, rien n'est chargé en mémoire. On les lit un par
// un pendant l'analyse, et on libère aussitôt.
//
// L'état ne survit pas à la fermeture de l'onglet, et n'est écrit nulle part :
// ni cookie, ni stockage local, ni serveur.

export const etat = {
  criteres: [],
  prochainId: 0,
  fichiers: [],
  resultats: null,
  criteresAnalyse: null,
  modeleActif: null,
  analyseEnCours: false,
};

/**
 * Un critère neuf. `id` sert à retrouver sa carte dans la page ; il n'a pas
 * d'autre rôle et ne figure nulle part dans les résultats.
 */
export function nouveauCritere({ nom = "", motsCles = "", poids = 0, type = "requis" } = {}) {
  return { id: etat.prochainId++, nom, motsCles, poids, type };
}

/** Un fichier déposé. `erreur` est renseignée si on refuse de le lire. */
export function nouveauFichier(fichier, erreur = null) {
  return { id: etat.prochainId++, fichier, nom: fichier.name, taille: fichier.size, erreur };
}

/**
 * Vide l'état et revient à l'écran initial (§3, étape 4).
 *
 * On efface tout, y compris les critères : le bouton promet « supprime les CV,
 * leurs scores et vos critères ». Une promesse à moitié tenue vaut moins que
 * pas de promesse.
 *
 * Les objets `File` sont retirés de la liste, donc plus rien ne renvoie aux
 * fichiers du disque. En Python il fallait en plus forcer la zone de dépôt à
 * se recréer, faute de quoi elle réaffichait les noms de fichiers au moment
 * même où l'on promettait de les avoir effacés ; ici, la liste affichée est
 * dessinée à partir de cet état, donc la vider suffit.
 */
export function effacerLaSession() {
  etat.criteres = [];
  etat.fichiers = [];
  etat.resultats = null;
  etat.criteresAnalyse = null;
  etat.modeleActif = null;
  etat.analyseEnCours = false;
}
