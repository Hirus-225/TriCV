// Moteur de scoring.
//
// Transposition de `core/scorer.py`. Conforme aux §7.2 à §7.6 du cadrage.
// Fonctions pures : les critères arrivent en argument, rien n'est lu, rien
// n'est écrit, aucun accès à la page.
//
// Structure d'un critère attendue en entrée (§7.2) :
//
//     {
//       nom: "Langages & frameworks",
//       poids: 35,
//       type: "requis",            // ou "exclusion"
//       groupes: [
//         ["python"],
//         ["sql", "postgresql", "mysql", "base de donnees"],
//         ["git", "github"],
//       ],
//     }
//
// Un GROUPE correspond à une ligne saisie par l'utilisateur. Son premier
// terme est le terme principal, les suivants sont ses synonymes. Le groupe
// compte pour trouvé si AU MOINS UN de ses termes apparaît dans le CV.

import { normaliser } from "./normalisation.js";
import { arrondirCommePython, echapperRegExp } from "./outils.js";

export const TYPE_REQUIS = "requis";
export const TYPE_EXCLUSION = "exclusion";

/**
 * Cherche un terme dans un texte déjà normalisé, en respectant les frontières
 * de mots.
 *
 * C'EST LA CORRECTION DU BUG PRINCIPAL DE RECRUTPRO (§7.3 du cadrage).
 *
 * RecrutPro écrivait `terme in texte`. Cette écriture cherche une sous-chaîne
 * n'importe où, y compris au milieu d'un autre mot :
 *
 *     "r"  dans "recrutement"   -> vrai   (le langage R dans tous les CV)
 *     "go" dans "algorithme"    -> vrai
 *     "go" dans "congo"         -> vrai
 *
 * Le motif \bterme\b corrige cela. \b est une « frontière de mot » : une
 * position où l'on passe d'un caractère de mot (lettre, chiffre, souligné) à
 * autre chose, ou l'inverse. En l'encadrant des deux côtés, on exige que le
 * terme soit un mot entier.
 *
 * ATTENTION, DIFFÉRENCE AVEC PYTHON. En JavaScript, \b ne connaît QUE
 * l'ASCII : il considère « é » comme une frontière, alors que Python y voit
 * une lettre. Ici ce n'est pas un problème, mais ce n'est pas un hasard : la
 * normalisation a déjà retiré accents et ponctuation des deux côtés, et il ne
 * reste que a-z, 0-9 et des espaces. C'est pourquoi `normaliser` est appliqué
 * au terme ici aussi, exactement comme en Python — la symétrie du §7.1 n'est
 * pas une élégance, c'est ce qui rend \b utilisable.
 *
 * Rend vrai ou faux. Un terme vide après normalisation rend faux.
 */
export function termePresent(terme, texteNormalise) {
  const termeNormalise = normaliser(terme);
  if (!termeNormalise) return false;

  const motif = new RegExp(`\\b${echapperRegExp(termeNormalise)}\\b`);
  return motif.test(texteNormalise);
}

/**
 * Un groupe est trouvé si au moins un de ses termes est présent.
 *
 * C'est ce qui règle le problème des candidats qui formulent autrement :
 * « développeur », « developer » et « ingénieur logiciel » comptent pour la
 * même chose.
 */
export function groupeTrouve(groupe, texteNormalise) {
  return groupe.some((terme) => termePresent(terme, texteNormalise));
}

/**
 * Évalue un seul critère et rend son détail :
 *
 *     {
 *       critere: "Langages & frameworks",
 *       poids: 35,
 *       points: 21,            // arrondi, pour l'affichage
 *       pointsExacts: 21.25,   // non arrondi, pour le calcul du score
 *       trouves: ["python", "git"],
 *       absents: ["sql"],
 *     }
 *
 * `trouves` et `absents` contiennent le TERME PRINCIPAL de chaque groupe (son
 * premier terme), tel que l'utilisateur l'a saisi, accents compris. C'est ce
 * qu'il reconnaîtra dans le détail dépliable.
 */
export function evaluerCritere(critere, texteNormalise) {
  const groupes = (critere.groupes ?? []).filter((groupe) => groupe && groupe.length);
  const poids = critere.poids ?? 0;

  const trouves = [];
  const absents = [];

  for (const groupe of groupes) {
    if (groupeTrouve(groupe, texteNormalise)) {
      trouves.push(groupe[0]);
    } else {
      absents.push(groupe[0]);
    }
  }

  // Un critère sans aucun groupe ne peut rien rapporter. On le traite
  // explicitement plutôt que de laisser une division par zéro se produire.
  const ratio = groupes.length ? trouves.length / groupes.length : 0;
  const pointsExacts = ratio * poids;

  return {
    critere: critere.nom ?? "",
    poids,
    points: arrondirCommePython(pointsExacts),
    pointsExacts,
    trouves,
    absents,
  };
}

/**
 * Calcule le score d'un candidat sur 100 et le détail par critère.
 *
 * `texteBrut` est le texte extrait du CV. `criteres` est la liste des
 * critères, structurés comme au §7.2. Rend :
 *
 *     {
 *       score: 72,
 *       signalements: [{ critere: "Intérim", declencheurs: ["interim"] }],
 *       detail: [ ... un objet par critère requis ... ],
 *     }
 *
 * LA NORMALISATION PAR LE TOTAL DES POIDS (§7.4).
 *
 * C'est la troisième correction par rapport à RecrutPro, qui terminait par
 * `min(score_total, 100)`. Ce plafond a deux défauts. D'abord il écrase
 * l'information : si l'utilisateur saisit des poids totalisant 150, tous les
 * bons candidats sont ramenés à 100 et deviennent indistinguables — le
 * classement perd sa finesse exactement là où elle compte le plus. Ensuite il
 * rend le score dépendant d'un détail de saisie : le même CV, avec les mêmes
 * critères dans les mêmes proportions, obtient un score différent selon que
 * les poids ont été écrits sur 50, sur 100 ou sur 200.
 *
 * Diviser par le total des poids règle les deux : le score est un
 * POURCENTAGE DU MAXIMUM ATTEIGNABLE, donc toujours sur 100.
 *
 * Détail d'implémentation : la somme se fait sur les points NON arrondis,
 * puis on arrondit une seule fois à la fin. Arrondir chaque critère avant de
 * sommer accumulerait les erreurs. En contrepartie, les points affichés dans
 * le détail peuvent ne pas totaliser exactement le score — un écart d'un
 * point au plus, sans conséquence sur le classement.
 *
 * LES CRITÈRES D'EXCLUSION n'ont aucun effet sur le score et ne retirent
 * jamais un candidat du classement (garde-fou n°4 du §4). Ils produisent un
 * signalement visible portant le nom du critère, et rien d'autre.
 */
export function scorerCandidat(texteBrut, criteres) {
  const texteNormalise = normaliser(texteBrut);

  const detail = [];
  const signalements = [];
  let totalPoids = 0;
  let totalPoints = 0;

  for (const critere of criteres) {
    const typeCritere = critere.type ?? TYPE_REQUIS;

    if (typeCritere === TYPE_EXCLUSION) {
      const groupes = (critere.groupes ?? []).filter((groupe) => groupe && groupe.length);
      // On retient QUELS groupes ont sonné, pas seulement le fait qu'un d'eux
      // ait sonné. Savoir lequel a déclenché le signalement évite au RH de
      // rouvrir le CV pour une information qu'on avait sous la main.
      //
      // Ces termes viennent de la SAISIE DE L'UTILISATEUR, pas du CV. Les
      // afficher ne conserve donc aucun texte de candidat (décision C4).
      const declencheurs = groupes
        .filter((groupe) => groupeTrouve(groupe, texteNormalise))
        .map((groupe) => groupe[0]);
      if (declencheurs.length) {
        signalements.push({ critere: critere.nom ?? "", declencheurs });
      }
      continue;
    }

    const evaluation = evaluerCritere(critere, texteNormalise);
    detail.push(evaluation);
    totalPoids += evaluation.poids;
    totalPoints += evaluation.pointsExacts;
  }

  // Aucun critère requis, ou tous de poids nul : il n'y a pas de maximum
  // atteignable, donc pas de pourcentage calculable. On rend 0 plutôt que de
  // laisser une division par zéro remonter jusqu'à l'interface.
  const score = totalPoids <= 0 ? 0 : arrondirCommePython((totalPoints / totalPoids) * 100);

  return { score, signalements, detail };
}
