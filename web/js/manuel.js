// La page « Manuel de procédure ».
//
// REMPLACE `afficher_manuel` (app.py), qui lisait docs/MANUEL-PROCEDURE.md et
// le confiait à `st.markdown`.
//
// LE MANUEL EST UN FICHIER, PAS DU TEXTE DANS LE CODE. `web/manuel.md` est la
// seule source de la page affichée. Recopier son contenu dans une constante
// JavaScript créerait deux versions du même document, qui divergeraient à la
// première correction — et ce serait la version affichée à l'utilisateur qui
// serait la périmée, puisque c'est l'autre qu'on relit en écrivant.
//
// POURQUOI UN MANUEL PROPRE AU SITE. `docs/MANUEL-PROCEDURE.md` décrit
// l'application Streamlit, encore en ligne, dont le §7 explique que les
// fichiers transitent par un serveur aux États-Unis. Ce n'est plus vrai ici :
// les deux applications ne se valent pas sur le point le plus important du
// produit, et un seul document ne peut pas décrire les deux sans mentir à
// propos de l'une. `web/manuel.md` est donc dérivé du premier, avec ses
// différences assumées ; le jour où la version Streamlit sera retirée,
// `docs/MANUEL-PROCEDURE.md` pourra l'être aussi.
//
// LE RENDU EST FAIT PAR `marked`, servi depuis vendor/. Le HTML produit est
// inséré avec `innerHTML`, ce qui est sans danger ici : le document rendu est
// un fichier du site, écrit par nous, et non un texte fourni par le visiteur.
// La politique de sécurité de la page interdit de toute façon l'exécution de
// tout script qui ne viendrait pas du site.

// `marked` est chargé À LA DEMANDE, au premier affichage du manuel : un
// `import()` entre parenthèses, et non en tête de fichier. Celui qui ne va
// jamais au manuel ne le télécharge pas — même raisonnement que pour la
// bibliothèque d'export. C'est le seul endroit où cette écriture sert : les
// autres modules sont nécessaires dès la première analyse.
const CHEMIN_DE_MARKED = new URL("../vendor/marked/marked.esm.js", import.meta.url);

const CHEMIN_DU_MANUEL = new URL("../manuel.md", import.meta.url);

let charge = false;

/**
 * Charge et affiche le manuel, une seule fois.
 *
 * Le fichier n'est demandé qu'au premier affichage de la page : celui qui ne
 * va jamais au manuel ne le télécharge jamais.
 */
export async function afficher() {
  if (charge) return;

  const zone = document.getElementById("page-manuel");

  try {
    const reponse = await fetch(CHEMIN_DU_MANUEL);
    // `fetch` ne lève pas d'erreur sur un 404 : il faut tester `ok` soi-même.
    // C'est le piège classique, et il donnerait ici une page de manuel
    // affichant « Not Found » mis en forme en Markdown.
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);

    const markdown = await reponse.text();
    const { marked } = await import(CHEMIN_DE_MARKED);
    const article = document.createElement("article");
    article.className = "manuel";
    article.innerHTML = marked.parse(markdown);
    zone.replaceChildren(article);
    charge = true;
  } catch {
    const erreur = document.createElement("p");
    erreur.className = "alerte alerte--erreur";
    erreur.textContent =
      "Le manuel de procédure est introuvable. Le fichier « manuel.md » doit " +
      "être livré avec l'application.";
    zone.replaceChildren(erreur);
  }
}
