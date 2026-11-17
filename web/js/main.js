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
import * as vueManuel from "./manuel.js";

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

// ---------------------------------------------------------------------------
// Navigation entre les deux pages
// ---------------------------------------------------------------------------
//
// REMPLACE LA BARRE LATÉRALE DE STREAMLIT, où un `st.radio` à deux entrées
// servait de navigation. Ici les deux entrées sont dans le bandeau, comme sur
// charleszogoue.ci, et la page affichée se lit dans l'adresse : « #manuel »
// ou rien.
//
// POURQUOI L'ADRESSE ET NON UNE SIMPLE VARIABLE. Parce que le bouton Retour du
// navigateur doit marcher, et parce qu'un lien vers le manuel doit pouvoir
// être envoyé à quelqu'un. L'événement `hashchange` se déclenche aussi bien
// quand on clique un lien que quand on revient en arrière : les deux cas sont
// donc traités par le même code, sans rien à synchroniser.

let pageCourante = null;

const pageDemandee = () => (location.hash === "#manuel" ? "manuel" : "tri");

async function afficherLaPage() {
  const page = pageDemandee();
  const changement = page !== pageCourante;
  pageCourante = page;

  document.body.dataset.page = page;
  document.getElementById("page-tri").hidden = page !== "tri";
  document.getElementById("page-manuel").hidden = page !== "manuel";
  document.getElementById("titre-tri").hidden = page !== "tri";
  document.getElementById("titre-manuel").hidden = page !== "manuel";
  document.getElementById("accroche").hidden = page !== "tri";

  for (const lien of document.querySelectorAll(".navigation a[data-page]")) {
    if (lien.dataset.page === page) lien.setAttribute("aria-current", "page");
    else lien.removeAttribute("aria-current");
  }

  if (page === "manuel") await vueManuel.afficher();

  // On revient en haut quand on CHANGE de page, et seulement alors : arriver
  // au milieu du manuel parce qu'on lisait le bas du classement serait
  // déroutant. Un simple rafraîchissement, lui, ne doit rien déplacer.
  if (changement) window.scrollTo({ top: 0, behavior: "instant" });
}

function demarrer() {
  if (!verifierLeMode()) return;

  window.addEventListener("hashchange", afficherLaPage);
  afficherLaPage();

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
