// Point d'entrée de l'application. C'est le seul fichier que `index.html`
// charge ; tous les autres sont amenés par des `import`.
//
// CORRESPONDANCE AVEC PYTHON. Ce fichier tient le rôle de `app.py` : il
// assemble, il ne calcule rien. La logique est dans les modules voisins,
// transposés un pour un de `core/` :
//
//     core/normalisation.py  ->  js/normalisation.js
//     core/criteres.py       ->  js/criteres.js
//     core/scorer.py         ->  js/scorer.js
//     core/modeles.py        ->  js/modeles.js
//     core/parser.py         ->  js/parser.js + pdf-texte.js + docx-texte.js
//     core/export.py         ->  js/export.js          (étape E6)
//
// CE QUI REMPLACE LE FONCTIONNEMENT DE STREAMLIT. Streamlit rejoue tout le
// script à chaque clic, de haut en bas, et c'est ce qui rend sa logique
// simple à écrire et son interface lente à réagir. Ici, rien n'est rejoué :
// chaque vue sait se redessiner, et ce fichier les relie entre elles. Quand
// les critères changent, le bouton « Lancer l'analyse » doit le savoir —
// c'est tout ce que ces branchements expriment.
//
// LES CINQ RÈGLES DE CONFIDENTIALITÉ DU §5 S'APPLIQUENT ICI INTÉGRALEMENT, et
// deux d'entre elles sont devenues structurelles plutôt que disciplinaires :
//
//   1. Aucune écriture disque — une page web n'en a pas le moyen.
//   2. Aucun cache partagé entre sessions — il n'y a plus de serveur.
//   3. Le texte brut est libéré dès le score calculé (voir vue-depot.js).
//   4. Aucun appel réseau sortant — la politique de sécurité de index.html
//      le garantit, et le navigateur l'applique.
//   5. Aucun message d'erreur contenant du texte extrait ou un nom.

import { effacerLaSession } from "./etat.js";
import * as vueCriteres from "./vue-criteres.js";
import * as vueDepot from "./vue-depot.js";
import * as vueClassement from "./vue-classement.js";

/**
 * Garde-fou : la page doit être servie par HTTP, pas ouverte par double-clic.
 *
 * Un fichier ouvert par double-clic arrive au navigateur avec l'adresse
 * `file:///…`. Dans ce mode, le navigateur refuse les modules JavaScript et
 * le chargement des bibliothèques de `vendor/` : la page s'affiche, mais rien
 * ne fonctionne, et les messages d'erreur ne désignent pas la cause.
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

/** Affiche un message de session, ou l'efface si le texte est vide. */
function messageDeSession(texte, classe = "alerte alerte--succes") {
  const zone = document.getElementById("messages-session");
  zone.replaceChildren();
  if (!texte) return;
  const message = document.createElement("p");
  message.className = classe;
  message.textContent = texte;
  zone.append(message);
}

function demarrer() {
  if (!verifierLeMode()) return;

  // Quand les critères changent, seul le bloc de lancement est concerné :
  // c'est lui qui sait si l'analyse est possible et pourquoi elle ne l'est
  // pas. Redessiner davantage ferait sauter le curseur des champs de saisie.
  vueCriteres.brancher(() => {
    messageDeSession("");
    vueDepot.rafraichir();
    // Le classement affiché a peut-être été calculé avec d'autres critères :
    // c'est au moment où l'on touche au formulaire qu'il faut le dire.
    vueClassement.rafraichirBandeauPerime();
  });

  vueDepot.brancher(
    () => messageDeSession(""),
    () => {
      vueClassement.dessiner();
      // On amène l'utilisateur au résultat : il vient d'attendre, et le
      // classement est plus bas que ce qu'il a sous les yeux.
      document.getElementById("classement").scrollIntoView({ behavior: "smooth", block: "start" });
    },
  );

  vueClassement.brancher(() => {
    effacerLaSession();
    vueCriteres.dessiner();
    vueDepot.dessiner();
    vueClassement.dessiner();
    document.getElementById("analyse").hidden = true;
    messageDeSession(
      "Session effacée. Les CV et leurs scores ont été supprimés de la " +
        "mémoire vive. Aucune copie n'a été conservée.",
    );
    document.getElementById("criteres").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", demarrer);
} else {
  demarrer();
}
