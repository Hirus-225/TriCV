// La section « Critères » : modèles, jauge de poids, cartes de critère,
// règles d'exclusion.
//
// REMPLACE `afficher_etape_criteres` et ses voisines (app.py).
//
// COMMENT CETTE VUE SE REDESSINE, ET POURQUOI PAS ENTIÈREMENT. Streamlit
// reconstruit toute la page à chaque frappe. Ici, ce serait hostile : à chaque
// lettre tapée dans une zone de mots-clés, le champ serait recréé et le
// curseur sauterait au début. On distingue donc deux choses :
//
//   - la LISTE des cartes, redessinée quand elle change (modèle chargé,
//     critère ajouté ou supprimé) ;
//   - le CONTENU d'une carte, qui appartient aux champs eux-mêmes ; quand on
//     y tape, on met à jour l'état et les deux petits affichages qui en
//     dépendent — l'aperçu des groupes et la jauge — sans toucher au reste.

import { analyserMotsCles, totalDesPoids } from "./criteres.js";
import { chargerModele, nomsDesModeles } from "./modeles.js";
import { etat, nouveauCritere } from "./etat.js";
import { accorder } from "./outils.js";

const PAGE_BLANCHE = "Page blanche";

let auChangement = () => {};

/** Raccourci : crée un élément, avec sa classe et son texte. */
function element(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

// ---------------------------------------------------------------------------
// Les modèles de poste
// ---------------------------------------------------------------------------

/**
 * Cinq puces cliquables, plus « Page blanche ».
 *
 * La version Streamlit demandait une liste déroulante PUIS un bouton
 * « Charger le modèle » : deux gestes pour un choix. Ici un clic suffit, et
 * les cinq intitulés sont lisibles d'un coup d'œil — y compris au pouce, sur
 * un téléphone, où une liste déroulante ouvre un sélecteur plein écran.
 */
function dessinerModeles() {
  const liste = document.getElementById("liste-modeles");
  liste.replaceChildren();

  for (const nom of [...nomsDesModeles(), PAGE_BLANCHE]) {
    const puce = element("button", "puce puce--choix", nom);
    puce.type = "button";
    puce.dataset.modele = nom;
    if (nom === PAGE_BLANCHE) puce.classList.add("puce--neutre");
    puce.setAttribute("aria-pressed", String(etat.modeleActif === nom));
    if (etat.modeleActif === nom) puce.classList.add("puce--active");

    puce.addEventListener("click", () => {
      if (nom === PAGE_BLANCHE) {
        etat.criteres = [nouveauCritere({ poids: 50 })];
        etat.modeleActif = null;
      } else {
        etat.criteres = chargerModele(nom).map((critere) =>
          nouveauCritere({ nom: critere.nom, motsCles: critere.motsCles, poids: critere.poids }),
        );
        etat.modeleActif = nom;
      }
      // Changer de modèle invalide l'analyse précédente : les scores
      // affichés ne correspondraient plus à ce que montre le formulaire.
      etat.resultats = null;
      etat.criteresAnalyse = null;
      dessiner();
      auChangement();
    });

    liste.append(puce);
  }
}

// ---------------------------------------------------------------------------
// La jauge de poids
// ---------------------------------------------------------------------------

/**
 * « Poids attribués : 85 / 100 — il reste 15 points à attribuer. »
 *
 * Règle le défaut de pondération À LA SAISIE plutôt que dans le calcul : le
 * score reste de toute façon un pourcentage du maximum atteignable, mais
 * l'utilisateur, lui, raisonne sur cent points et doit voir où il en est.
 */
export function rafraichirJauge() {
  const jauge = document.getElementById("jauge");
  const requis = etat.criteres.filter((c) => c.type === "requis");
  jauge.hidden = requis.length === 0;
  if (jauge.hidden) return;

  const total = totalDesPoids(etat.criteres);
  const reste = 100 - total;

  document.getElementById("jauge-valeur").textContent = `${total} / 100`;
  const barre = document.getElementById("jauge-barre");
  barre.style.width = `${Math.min(100, total)}%`;
  barre.classList.toggle("progression__barre--trop", total > 100);

  const note = document.getElementById("jauge-note");
  if (reste > 0) {
    note.textContent = `Il reste ${reste} points à attribuer.`;
  } else if (reste < 0) {
    note.textContent =
      `Vous avez attribué ${-reste} points de trop. Le score reste calculé ` +
      "sur 100 : les poids sont ramenés à leur proportion.";
  } else {
    note.textContent = "Tous les points sont attribués.";
  }
}

// ---------------------------------------------------------------------------
// Une carte de critère
// ---------------------------------------------------------------------------

/** L'aperçu sous la zone de saisie : « 4 groupes : python · react (+2) ». */
function texteDesGroupes(motsCles) {
  const groupes = analyserMotsCles(motsCles);
  if (!groupes.length) return "";
  const apercu = groupes
    .map((g) => (g.length === 1 ? g[0] : `${g[0]} (+${g.length - 1})`))
    .join(" · ");
  return `${accorder(groupes.length, "groupe de recherche", "groupes de recherche")} : ${apercu}`;
}

function dessinerCarte(critere) {
  const exclusion = critere.type === "exclusion";
  const carte = element("article", "critere");

  const tete = element("div", "critere__tete");

  const champNom = element("input", "critere__nom");
  champNom.type = "text";
  champNom.value = critere.nom;
  champNom.placeholder = exclusion ? "Intérim" : "Langages & frameworks";
  champNom.setAttribute("aria-label", exclusion ? "Nom de la règle" : "Nom du critère");
  champNom.addEventListener("input", () => {
    critere.nom = champNom.value;
    auChangement();
  });
  tete.append(champNom);

  // Une règle d'exclusion n'a pas de poids : elle ne rapporte aucun point.
  if (!exclusion) {
    const bloc = element("div", "critere__poids");
    const etiquette = element("label", "critere__etiquette", "Poids");
    const champPoids = element("input");
    champPoids.type = "number";
    champPoids.min = "0";
    champPoids.max = "100";
    champPoids.step = "5";
    champPoids.value = String(critere.poids);
    champPoids.id = `poids-${critere.id}`;
    etiquette.htmlFor = champPoids.id;
    champPoids.addEventListener("input", () => {
      // Un champ vidé rend "" : on retient 0 plutôt que NaN, qui
      // contaminerait toute la somme des poids.
      const valeur = Number.parseInt(champPoids.value, 10);
      critere.poids = Number.isNaN(valeur) ? 0 : valeur;
      rafraichirJauge();
      auChangement();
    });
    bloc.append(etiquette, champPoids);
    tete.append(bloc);
  }

  const supprimer = element("button", "critere__supprimer", "✕");
  supprimer.type = "button";
  supprimer.title = exclusion ? "Supprimer cette règle" : "Supprimer ce critère";
  supprimer.setAttribute("aria-label", supprimer.title);
  supprimer.addEventListener("click", () => {
    etat.criteres = etat.criteres.filter((c) => c.id !== critere.id);
    etat.resultats = null;
    etat.criteresAnalyse = null;
    dessiner();
    auChangement();
  });
  tete.append(supprimer);

  carte.append(tete);

  const champMots = element("textarea", "critere__mots");
  champMots.value = critere.motsCles;
  champMots.rows = 3;
  champMots.placeholder = exclusion ? "interim = mission temporaire" : "python\nreact = vue, angular";
  champMots.setAttribute("aria-label", "Mots-clés recherchés");
  carte.append(champMots);

  const aide = element(
    "p",
    "aide",
    "Un mot-clé par ligne ou séparé par une virgule. Le signe « = » crée un " +
      "groupe de synonymes : « react = vue, angular » est trouvé si l'un des " +
      "trois apparaît. Recherche insensible à la casse et aux accents.",
  );
  carte.append(aide);

  const apercu = element("p", "critere__apercu", texteDesGroupes(critere.motsCles));
  champMots.addEventListener("input", () => {
    critere.motsCles = champMots.value;
    apercu.textContent = texteDesGroupes(critere.motsCles);
    auChangement();
  });
  carte.append(apercu);

  return carte;
}

// ---------------------------------------------------------------------------
// Assemblage
// ---------------------------------------------------------------------------

/** Redessine la liste des cartes. À n'appeler que quand la LISTE change. */
export function dessiner() {
  dessinerModeles();

  const requis = etat.criteres.filter((c) => c.type === "requis");
  const exclusions = etat.criteres.filter((c) => c.type === "exclusion");

  document.getElementById("liste-criteres").replaceChildren(...requis.map(dessinerCarte));
  document.getElementById("liste-exclusions").replaceChildren(...exclusions.map(dessinerCarte));
  document.getElementById("criteres-vide").hidden = requis.length > 0;

  document.getElementById("exclusions-intitule").textContent = exclusions.length
    ? `Critères d'exclusion — ${accorder(exclusions.length, "règle")} · signalement seulement`
    : "Critères d'exclusion — signalement seulement";

  rafraichirJauge();
}

/** Branche les deux boutons d'ajout. `surChangement` prévient main.js. */
export function brancher(surChangement) {
  auChangement = surChangement;

  document.getElementById("ajouter-critere").addEventListener("click", () => {
    etat.criteres.push(nouveauCritere());
    etat.resultats = null;
    etat.criteresAnalyse = null;
    dessiner();
    auChangement();
  });

  document.getElementById("ajouter-exclusion").addEventListener("click", () => {
    etat.criteres.push(nouveauCritere({ type: "exclusion" }));
    etat.resultats = null;
    etat.criteresAnalyse = null;
    dessiner();
    auChangement();
    document.getElementById("exclusions").open = true;
  });

  dessiner();
}
