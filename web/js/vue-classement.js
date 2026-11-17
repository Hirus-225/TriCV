// La section « Classement » : avertissement, compteurs, tableau, détail par
// candidat, CV à examiner manuellement, et les actions finales.
//
// REMPLACE `afficher_etape_classement` et ses voisines (app.py).
//
// LES GARDE-FOUS DU §4 DU CADRAGE SE JOUENT ICI, et ce sont eux qui
// distinguent un assistant de lecture d'un filtre automatique :
//
//   n°2 — AUCUN CANDIDAT N'EST MASQUÉ. Les scores faibles sont en bas du
//         tableau, jamais repliés ni filtrés.
//   n°3 — L'AVERTISSEMENT EST PERMANENT, au-dessus du classement, ni
//         repliable ni masquable.
//   n°4 — UN SIGNALEMENT D'EXCLUSION NE RETIRE PERSONNE : le candidat garde
//         son rang et son score.

import { etat } from "./etat.js";
import { accorder, bandeDuScore, SEUIL_AMBRE, SEUIL_VERT } from "./outils.js";
// L'avertissement du §4 est défini dans export.js et repris ici, exactement
// comme app.py l'importe de core/export.py : le texte qui doit voyager avec
// les chiffres n'a qu'une seule source.
import {
  AVERTISSEMENT,
  genererClasseur,
  nomDuFichierExport,
  telecharger,
} from "./export.js";
import { criteresPrets } from "./vue-depot.js";

let surEffacement = () => {};

function element(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

/** Une cellule de tableau qui porte son intitulé, pour l'affichage en cartes. */
function cellule(intitule, contenu, classe) {
  const td = element("td", classe);
  // Sur écran étroit, le tableau devient une liste de cartes et la CSS
  // réaffiche cet intitulé devant la valeur : sans lui, on lirait une suite
  // de valeurs sans savoir ce qu'elles désignent.
  td.dataset.intitule = intitule;
  if (typeof contenu === "string") td.textContent = contenu;
  else td.append(contenu);
  return td;
}

/** Un lien cliquable pour un email ou un téléphone, ou un tiret. */
function lien(valeur, protocole) {
  if (!valeur) return "—";
  const a = element("a", "lien-contact", valeur);
  a.href = `${protocole}:${valeur.replace(/\s/g, "")}`;
  return a;
}

// ---------------------------------------------------------------------------
// Le bandeau des critères périmés
// ---------------------------------------------------------------------------

/**
 * La forme d'un critère qui compte pour le calcul : son nom, son poids, son
 * type, ses groupes. Un identifiant de carte ou un texte de saisie reformulé
 * sans changement de sens ne doivent PAS déclencher le bandeau.
 */
const empreinteDesCriteres = (criteres) =>
  JSON.stringify(
    criteres.map((critere) => ({
      nom: critere.nom ?? "",
      poids: critere.poids ?? 0,
      type: critere.type ?? "requis",
      groupes: critere.groupes ?? [],
    })),
  );

/**
 * Prévient que le classement affiché ne correspond plus au formulaire.
 *
 * C'EST LA CORRECTION DU DÉFAUT N°3 DU §4 de docs/MIGRATION-JS.md. Dans la
 * version Streamlit, `st.session_state.resultats` était remis à None quand on
 * chargeait un modèle, partait d'une page blanche, ajoutait ou supprimait un
 * critère — mais PAS quand on modifiait le nom, le poids ou les mots-clés d'un
 * critère existant. On analysait dix CV, on corrigeait un mot-clé, et le
 * classement restait à l'écran, calculé avec l'ancien mot-clé, sans que rien
 * ne le signale. L'export, lui, restait cohérent avec les scores : c'était
 * donc l'ÉCRAN qui mentait.
 *
 * POURQUOI UN BANDEAU ET NON UN EFFACEMENT. Effacer le classement au moindre
 * ajustement ferait perdre le résultat d'une analyse qui a pris du temps, et
 * pour une correction que l'utilisateur voulait peut-être seulement essayer.
 * On garde donc le classement, en disant ce qu'il vaut.
 */
export function rafraichirBandeauPerime() {
  const zone = document.getElementById("bandeau-perime");
  zone.replaceChildren();

  if (etat.resultats === null || etat.criteresAnalyse === null) return;
  if (empreinteDesCriteres(criteresPrets()) === empreinteDesCriteres(etat.criteresAnalyse)) return;

  const bandeau = element("div", "alerte alerte--avertissement");
  bandeau.append(
    element(
      "p",
      null,
      "Les critères ont changé depuis cette analyse. Le classement ci-dessous " +
        "a été calculé avec les critères précédents.",
    ),
  );
  bandeau.append(
    element(
      "p",
      null,
      "Relancez l'analyse pour le mettre à jour. Le récapitulatif Excel, lui, " +
        "reste cohérent avec les scores affichés : il porte les critères qui " +
        "ont servi à les calculer.",
    ),
  );
  zone.append(bandeau);
}

// ---------------------------------------------------------------------------
// Compteurs
// ---------------------------------------------------------------------------

function dessinerCompteurs(resultats, classes, illisibles) {
  const blocs = element("div", "blocs");
  const chiffres = [
    [resultats.length, "CV reçus"],
    [classes.length, "Analysés et classés"],
    [illisibles.length, "À examiner manuellement"],
    [classes.filter((r) => r.signalements.length).length, "Signalements"],
  ];
  for (const [nombre, intitule] of chiffres) {
    const bloc = element("div", "bloc");
    bloc.append(element("p", "bloc__nombre", String(nombre)));
    bloc.append(element("p", "bloc__titre", intitule));
    blocs.append(bloc);
  }
  return blocs;
}

// ---------------------------------------------------------------------------
// Le tableau
// ---------------------------------------------------------------------------

function dessinerTableau(classes) {
  const enveloppe = element("div", "table-wrap");
  const table = element("table", "classement");

  const entete = element("thead");
  const ligneEntete = element("tr");
  for (const intitule of [
    "Rang", "Candidat", "Email", "Téléphone", "Score / 100", "Signalements", "Fichier",
  ]) {
    ligneEntete.append(element("th", null, intitule));
  }
  entete.append(ligneEntete);
  table.append(entete);

  const corps = element("tbody");
  classes.forEach((resultat, index) => {
    const ligne = element("tr");
    ligne.append(cellule("Rang", String(index + 1), "classement__rang"));
    ligne.append(cellule("Candidat", resultat.nom || "— (non extrait)", "classement__nom"));
    ligne.append(cellule("Email", lien(resultat.email, "mailto")));
    ligne.append(cellule("Téléphone", lien(resultat.telephone, "tel")));

    const score = element("span", `score score--${bandeDuScore(resultat.score)}`, String(resultat.score));
    ligne.append(cellule("Score / 100", score, "classement__score"));

    const signalements = resultat.signalements.map((s) => s.critere).join(", ");
    if (signalements) {
      ligne.append(cellule("Signalements", element("span", "puce puce--ambre", signalements)));
    } else {
      ligne.append(cellule("Signalements", "—"));
    }

    ligne.append(cellule("Fichier", resultat.fichier, "classement__fichier"));
    corps.append(ligne);
  });
  table.append(corps);

  enveloppe.append(table);
  return enveloppe;
}

// ---------------------------------------------------------------------------
// Le détail par candidat
// ---------------------------------------------------------------------------

function dessinerDetail(classes) {
  const bloc = element("div", "details");
  bloc.append(element("h3", "details__titre", "Détail du score par candidat"));

  classes.forEach((resultat, index) => {
    const volet = element("details", "candidat");
    const titre = element(
      "summary",
      "candidat__tete",
      `${index + 1}. ${resultat.nom || resultat.fichier} — ${resultat.score} / 100`,
    );
    volet.append(titre);

    const corps = element("div", "candidat__corps");
    corps.append(element("p", "aide", `${resultat.fichier} · ${resultat.taille}`));

    for (const ligne of resultat.detail) {
      const critere = element("div", "critere-detail");
      critere.append(
        element("p", "critere-detail__tete", `${ligne.critere} — ${ligne.points} / ${ligne.poids} pts`),
      );

      const progression = element("div", "progression");
      const barre = element("div", "progression__barre");
      // Même garde qu'en Python : un critère de poids nul ne doit pas
      // provoquer de division par zéro.
      const part = ligne.poids ? Math.min(1, ligne.points / ligne.poids) : 0;
      barre.style.width = `${part * 100}%`;
      progression.append(barre);
      critere.append(progression);

      critere.append(
        element("p", "critere-detail__mots", `TROUVÉS  ${ligne.trouves.join(", ") || "aucun"}`),
      );
      critere.append(
        element("p", "critere-detail__mots", `ABSENTS  ${ligne.absents.join(", ") || "aucun"}`),
      );
      corps.append(critere);
    }

    for (const signalement of resultat.signalements) {
      const termes = signalement.declencheurs.map((t) => `« ${t} »`).join(", ");
      const alerte = element("div", "alerte alerte--avertissement");
      alerte.append(
        element("p", null, `Règle d'exclusion déclenchée — ${signalement.critere} : ${termes}`),
      );
      alerte.append(
        element(
          "p",
          null,
          "Le signalement n'écarte pas la candidature et ne modifie pas le score. " +
            "Le candidat garde son rang ; c'est à vous de trancher.",
        ),
      );
      corps.append(alerte);
    }

    corps.append(
      element(
        "p",
        "aide",
        "Un mot-clé absent signifie seulement qu'il n'apparaît pas dans le " +
          "document. Le candidat peut maîtriser la compétence sans l'avoir écrite.",
      ),
    );

    volet.append(corps);
    bloc.append(volet);
  });

  return bloc;
}

// ---------------------------------------------------------------------------
// Les CV à examiner manuellement
// ---------------------------------------------------------------------------

/**
 * Section DISTINCTE du classement, jamais en fin de tableau avec un score de
 * 0 (§7.5). Un CV illisible n'a pas démérité : on n'a simplement pas pu le
 * lire, et lui donner 0 affirmerait à tort qu'il ne correspond pas au poste.
 */
function dessinerIllisibles(illisibles) {
  const bloc = element("section", "illisibles");
  bloc.append(element("h3", "illisibles__titre", "À examiner manuellement"));

  bloc.append(
    element(
      "p",
      "alerte",
      illisibles.length === 1
        ? "1 CV n'a pas pu être analysé. Il est scanné en image : aucun texte " +
          "n'en est extractible. Il ne reçoit pas de score et n'est pas classé. " +
          "Ouvrez-le directement."
        : `${illisibles.length} CV n'ont pas pu être analysés. Ils sont scannés ` +
          "en image : aucun texte n'en est extractible. Ils ne reçoivent pas de " +
          "score et ne sont pas classés. Ouvrez-les directement.",
    ),
  );

  const enveloppe = element("div", "table-wrap");
  const table = element("table", "classement");
  const entete = element("thead");
  const ligneEntete = element("tr");
  for (const intitule of ["Fichier", "Taille", "Raison", "Score / 100"]) {
    ligneEntete.append(element("th", null, intitule));
  }
  entete.append(ligneEntete);
  table.append(entete);

  const corps = element("tbody");
  for (const resultat of illisibles) {
    const ligne = element("tr");
    ligne.append(cellule("Fichier", resultat.fichier));
    ligne.append(cellule("Taille", resultat.taille));
    ligne.append(cellule("Raison", resultat.raison || "Document scanné, aucun texte lisible"));
    ligne.append(cellule("Score / 100", "—"));
    corps.append(ligne);
  }
  table.append(corps);
  enveloppe.append(table);
  bloc.append(enveloppe);

  return bloc;
}

// ---------------------------------------------------------------------------
// Actions finales
// ---------------------------------------------------------------------------

function dessinerActions(resultats) {
  const bloc = element("div", "actions-finales");

  const exporter = element("button", "btn btn--marine", "Télécharger le récapitulatif (.xlsx)");
  exporter.type = "button";
  exporter.addEventListener("click", async () => {
    // Le classeur est construit AU CLIC, et non à l'affichage du bouton. La
    // version Python le reconstruisait à chaque réexécution du script, donc à
    // chaque frappe, pour un bouton sur lequel personne n'avait cliqué : c'est
    // le défaut n°6 du §4 de docs/MIGRATION-JS.md.
    const intitule = exporter.textContent;
    exporter.disabled = true;
    exporter.textContent = "Préparation du fichier…";
    try {
      const octets = await genererClasseur(
        resultats,
        etat.criteresAnalyse ?? [],
        etat.modeleActif,
      );
      telecharger(octets, nomDuFichierExport());
    } catch {
      // Le message d'erreur n'est pas journalisé et ne contient aucun nom de
      // candidat : il ne parle que de la bibliothèque qui n'a pas chargé.
      const erreur = element(
        "p",
        "alerte alerte--erreur",
        "Le récapitulatif n'a pas pu être produit. Rechargez la page et " +
          "réessayez ; vos critères et le classement sont perdus au " +
          "rechargement, mais rien n'a été enregistré.",
      );
      bloc.after(erreur);
    } finally {
      exporter.disabled = false;
      exporter.textContent = intitule;
    }
  });
  bloc.append(exporter);

  const effacer = element("button", "go", "Effacer la session");
  effacer.type = "button";
  effacer.addEventListener("click", () => {
    const nombre = resultats.length;
    document.getElementById("texte-effacer").textContent =
      `Effacer la session supprime ${
        nombre === 1 ? "le CV déposé, son score" : `les ${nombre} CV, leurs scores`
      } et vos critères. Téléchargez le récapitulatif Excel avant de continuer : ` +
      "rien ne pourra être récupéré.";
    document.getElementById("dialogue-effacer").showModal();
  });

  bloc.append(effacer);

  const note = element(
    "p",
    "aide actions-finales__note",
    "Le fichier Excel contient le classement, le détail par critère et les " +
      "mots-clés trouvés pour chaque candidat.",
  );

  const enveloppe = element("div");
  enveloppe.append(bloc, note);
  return enveloppe;
}

// ---------------------------------------------------------------------------
// Assemblage
// ---------------------------------------------------------------------------

export function dessiner() {
  const section = document.getElementById("classement");
  const corps = document.getElementById("corps-classement");
  corps.replaceChildren();

  const resultats = etat.resultats;
  section.hidden = resultats === null;
  rafraichirBandeauPerime();
  if (resultats === null) return;

  // Tri par score décroissant. Le tri de JavaScript est STABLE, comme celui
  // de Python : à score égal, les candidats restent dans l'ordre de dépôt.
  const classes = resultats.filter((r) => r.lisible).sort((a, b) => b.score - a.score);
  const illisibles = resultats.filter((r) => !r.lisible);

  corps.append(element("p", "alerte alerte--avertissement", AVERTISSEMENT));
  corps.append(
    element(
      "p",
      "aide",
      "Le score mesure la correspondance aux mots-clés que vous avez définis. " +
        "Il ne mesure ni la qualité d'un candidat ni son adéquation au poste. " +
        "Ouvrez le détail par critère et lisez les CV avant toute décision.",
    ),
  );

  corps.append(dessinerCompteurs(resultats, classes, illisibles));

  if (classes.length) {
    corps.append(dessinerTableau(classes));
    corps.append(
      element(
        "p",
        "aide",
        accorder(classes.length, "candidat classé", "candidats classés") +
          ` · vert au-dessus de ${SEUIL_VERT}, ambre de ${SEUIL_AMBRE} à ${SEUIL_VERT}, ` +
          `rouge en dessous de ${SEUIL_AMBRE} — ces teintes qualifient la ` +
          "correspondance aux mots-clés, pas le candidat.",
      ),
    );
    corps.append(dessinerDetail(classes));
  } else {
    corps.append(element("p", "alerte", "Aucun CV n'a pu être analysé. Voir la section ci-dessous."));
  }

  if (illisibles.length) corps.append(dessinerIllisibles(illisibles));

  corps.append(dessinerActions(resultats));
}

export function brancher(quandEffacement) {
  surEffacement = quandEffacement;

  const dialogue = document.getElementById("dialogue-effacer");
  document.getElementById("confirmer-effacer").addEventListener("click", () => {
    dialogue.close();
    surEffacement();
  });
  document.getElementById("annuler-effacer").addEventListener("click", () => dialogue.close());

  dessiner();
}
