// Point d'entrée de l'application. C'est le seul fichier que `index.html`
// charge ; tous les autres sont amenés par des `import`.
//
// CORRESPONDANCE AVEC PYTHON. Ce fichier tient le rôle de `app.py` : il
// assemble, il ne calcule rien. La logique vivra dans les modules voisins,
// transposés un pour un de `core/` :
//
//     core/normalisation.py  ->  js/normalisation.js
//     core/criteres.py       ->  js/criteres.js
//     core/scorer.py         ->  js/scorer.js
//     core/modeles.py        ->  js/modeles.js
//     core/parser.py         ->  js/parser.js + pdf-texte.js + docx-texte.js
//     core/export.py         ->  js/export.js
//
// CE QUI REMPLACE LE FONCTIONNEMENT DE STREAMLIT. Streamlit rejoue tout le
// script à chaque clic, de haut en bas. Ici, rien n'est rejoué : on écrit des
// fonctions, on les branche sur des événements (« quand on clique, fais
// ceci »), et elles redessinent la zone de page concernée. L'état qui vivait
// dans `st.session_state` vivra dans `js/etat.js`.
//
// ÉTAT D'AVANCEMENT. Étape E2 : le socle. Ce fichier ne fait encore qu'une
// chose, le garde-fou ci-dessous. Les vues arrivent à l'étape E5.

/**
 * Garde-fou : la page doit être servie par HTTP, pas ouverte par double-clic.
 *
 * POURQUOI. Un fichier ouvert par double-clic arrive au navigateur avec
 * l'adresse `file:///…`. Dans ce mode, le navigateur refuse les modules
 * JavaScript (`import`) et le chargement des bibliothèques de `vendor/` : la
 * page s'affiche, mais rien ne fonctionne, et les messages d'erreur ne
 * désignent pas la cause. C'est l'erreur la plus facile à commettre et la
 * plus déroutante à diagnostiquer — d'où ce message explicite.
 *
 * Le code ne s'exécute d'ailleurs pas du tout en `file://` (le module est
 * refusé avant). Le contrôle sert donc aux cas limites — un fichier recopié
 * sur un partage réseau, par exemple — et documente la contrainte à l'endroit
 * où on la rencontre.
 */
function verifierLeMode() {
  if (location.protocol !== "file:") return true;

  const message = document.createElement("p");
  message.className = "alerte alerte--erreur";
  message.textContent =
    "Cette page doit être servie par un serveur web, pas ouverte directement " +
    "depuis le dossier. Lancez « python3 -m http.server » à la racine du " +
    "projet, puis ouvrez http://localhost:8000/web/index.html";
  document.querySelector("main").prepend(message);
  return false;
}

function demarrer() {
  if (!verifierLeMode()) return;

  // Étape E5 : branchement des vues (critères, dépôt, classement).
}

// `DOMContentLoaded` se déclenche quand la page est lue et que les éléments
// existent. Un script `type="module"` est de toute façon exécuté après la
// lecture de la page, mais on garde le contrôle : si le fichier était un jour
// chargé autrement, `document.querySelector` rendrait `null` sans ce garde.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", demarrer);
} else {
  demarrer();
}
