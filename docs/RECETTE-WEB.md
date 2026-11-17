# Fiche de recette — TriCV, version navigateur

Les dix points de contrôle du §12 du cadrage, **revus pour une application
qui tourne dans le navigateur**, plus trois points que la version Streamlit ne
pouvait pas avoir. Pour chacun : comment le vérifier, et l'état constaté.

Cette fiche remplace `docs/RECETTE.md` pour le site. Celle-là reste valable
pour l'application Streamlit tant qu'elle est en ligne.

**La colonne qui compte est la dernière.** Le critère de sortie est que ces
points soient cochés sur le site **publié**, pas seulement en local. Une
application qui passe la recette sur le poste du développeur et échoue en
ligne n'a pas passé la recette.

---

## Comment vérifier

**Les points automatiques** sont couverts par la page de tests, qui compare la
version JavaScript aux résultats du moteur Python. Deux commandes, dans cet
ordre :

```
./venv/bin/python tests/generer_reference_js.py
```

```
python3 -m http.server 8000
```

Puis `http://localhost:8000/web/tests/tests.html`. Le bandeau du haut doit
être **vert**.

**Les points manuels** demandent d'ouvrir l'application et de regarder :
`http://localhost:8000/web/index.html`.

---

## Les dix points du cadrage

| # | Point de contrôle (§12) | Comment | Local — 17/11/2026 | Publié |
|---|---|---|---|---|
| 1 | Un mot-clé d'une lettre (`R`, `C`) ne correspond pas à l'intérieur d'un autre mot | Automatique — groupe 5 de la page de tests | ✅ | ☐ |
| 2 | « développeur » dans le CV est trouvé par le mot-clé « developpeur », et réciproquement | Automatique — groupe 5 | ✅ | ☐ |
| 3 | La somme des poids, quelle qu'elle soit, produit un score sur 100 cohérent | Automatique — groupe 5 | ✅ | ☐ |
| 4 | Un CV scanné apparaît dans « À examiner manuellement », et non en dernière position du classement | Automatique — groupe 7 — **et** parcours au navigateur | ✅ | ☐ |
| 5 | Un CV Word construit en tableaux est correctement extrait | Automatique — groupe 7, qui couvre aussi les zones de texte flottantes | ✅ | ☐ |
| 6 | Un critère d'exclusion déclenché ne retire pas le candidat du classement | Automatique — groupe 5 — **et** parcours au navigateur | ✅ | ☐ |
| 7 | **Aucune requête ne sort du site** *(remplace « aucune écriture disque »)* | Onglet Réseau, puis l'épreuve ci-dessous | ✅ | ☐ |
| 8 | Le récapitulatif Excel se télécharge sans qu'aucun serveur soit sollicité | Parcours au navigateur, onglet Réseau | ✅ | ☐ |
| 9 | « Effacer la session » ramène à l'écran initial, sans résidu | Manuel, au navigateur | ✅ | ☐ |
| 10 | La notice de confidentialité est visible sans avoir à faire défiler la page | Manuel, au navigateur | ✅ | ☐ |

## Les trois points propres à la version navigateur

| # | Point de contrôle | Comment | Local — 17/11/2026 | Publié |
|---|---|---|---|---|
| 11 | L'application est utilisable sur un téléphone | Réduire la fenêtre à 375 px de large | ✅ | ☐ |
| 12 | Tout est atteignable au clavier seul | Tabulation, de haut en bas | ✅ | ☐ |
| 13 | Le manuel s'affiche et le bouton Retour fait ce qu'on attend | Manuel, au navigateur | ✅ | ☐ |

---

## Le point 7 a changé de nature, et c'est le cœur du produit

Dans la version Streamlit, le point 7 cherchait des écritures disque :

```
grep -rn "\.save(\|open(.*'w'\|cache_data\|cache_resource" app.py core/
```

La question n'a plus de sens : **une page web ne peut pas écrire sur le disque
du visiteur**, et il n'y a plus de serveur d'application sur lequel écrire
quoi que ce soit. La promesse à tenir n'est plus « rien n'est conservé », c'est
**« rien n'est envoyé »**. Elle se vérifie en deux temps.

**Premier temps — ce qui part.** Ouvrir l'onglet Réseau des outils de
développement, recharger, faire un tri complet, exporter. Toutes les lignes
doivent pointer vers le site lui-même. Constaté : **46 requêtes, toutes
locales, aucune vers l'extérieur** — la page, les modules, les polices, PDF.js
et ses tables de caractères, ExcelJS au moment de l'export.

**Second temps — ce qui ne POURRAIT pas partir.** Montrer qu'on n'appelle
personne ne prouve pas qu'on ne le pourrait pas. Dans la console, provoquer un
appel vers l'extérieur :

```js
const img = new Image();
img.src = "https://ceci-nexiste-pas.invalid/pixel.png";
```

Le navigateur doit répondre, dans la console :

> Loading the image 'https://ceci-nexiste-pas.invalid/pixel.png' violates the
> following Content Security Policy directive: "img-src 'self'". The action
> has been blocked.

**Et aucune requête ne doit figurer dans l'onglet Réseau.** Constaté : refus
immédiat, aucune requête émise.

> **Une précision pour qui regarde de près.** L'API de performance de la page
> (`performance.getEntriesByType("resource")`) garde bien une trace de la
> tentative, mais avec une durée de 0 ms, 0 octet transféré et aucun protocole
> réseau : c'est l'enregistrement d'un refus, pas d'un envoi. L'onglet Réseau,
> lui, ne montre rien, parce que rien n'est sorti.

C'est ce second temps qui fait la différence avec l'ancienne version : la
promesse ne repose plus sur la relecture du code, mais sur une règle que le
navigateur applique — y compris si une bibliothèque était un jour compromise.

**Un garde-fou supplémentaire tourne à la publication.** Le workflow
`.github/workflows/pages.yml` refuse de publier si une adresse distante s'est
glissée dans `web/js`, `web/css` ou les pages HTML. Il ne regarde pas
`vendor/`, dont le contenu est examiné une fois pour toutes au moment où on
l'y place et consigné dans `web/vendor/LISEZMOI.md`.

---

## Le détail du passage local du 17/11/2026

### Points automatiques

Page de tests : **1 007 cas, aucun écart**, dont 4 tolérés et documentés — les
cellules du classeur Excel où la version JavaScript corrige le défaut n°1 et
s'écarte donc volontairement de Python.

| Groupe | Cas |
|---|---|
| 1. Arrondi — `round()` de Python, pas `Math.round` | 24 |
| 2. Normalisation du texte | 75 |
| 3. Syntaxe des mots-clés | 76 |
| 4. Les cinq modèles | 23 |
| 5. Scoring | 57 |
| 6. Outils d'affichage | 43 |
| 7. Lecture des fichiers | 124 |
| 8. Le modèle « Comptable » sépare-t-il le métier ? | 4 |
| 9. Le classeur Excel | 581 |

Le moteur Python reste vert de son côté : `./venv/bin/python
tests/verifier_moteur.py` passe ses 101 vérifications.

### Parcours complet au navigateur

Dix CV du corpus fictif, modèle « Comptable », plus une règle d'exclusion
« Cabinet ». **Analyse en 1,5 seconde.**

- **Point 4.** Neuf CV classés de 69 à 0 ; `03_CV_Traore_Aminata.pdf`, qui est
  un scan, figure dans « À examiner manuellement » avec la raison « Document
  scanné, aucun texte lisible » et **pas** en bas du classement.
- **Point 5.** `10_CV_Brou_Akissi.docx`, dont le contenu est en tableaux,
  arrive premier avec 69 — donc son texte a bien été lu.
- **Point 6.** La règle d'exclusion n'a **pas** de champ de poids, la jauge
  reste à 100 / 100, et les trois candidats signalés gardent leur rang **et**
  leur score.
- **Point 8.** Le fichier proposé s'appelle
  `tricv_recapitulatif_2026-11-17.xlsx`, pèse 11 318 octets, porte le type
  MIME d'un classeur Excel — et **aucune requête vers un serveur** n'a été
  émise pour le produire.
- **Point 9.** Après confirmation : plus de classement, plus de critère, plus
  de règle d'exclusion, plus un nom de fichier, plus de jauge, plus de zone
  d'analyse. Le message « Session effacée… » s'affiche.
- **Point 10.** Le bloc « Aucune donnée conservée » se termine à 357 px du
  haut, sur un écran de 768 px : visible sans toucher à la molette.
- **Point 12.** 75 éléments atteignables au clavier, et la zone de dépôt —
  un `<label>` enveloppant un champ masqué — reçoit bien le focus.

### À 375 px de large

- La notice reste visible sans défiler.
- **Aucun élément ne déborde** de la page (376 px de contenu pour 375 px
  d'écran : un pixel d'arrondi, sans barre de défilement).
- Le tableau devient une **liste de cartes** : en-tête masqué, chaque ligne en
  bloc, et chaque valeur précédée de l'intitulé de sa colonne.
- Le manuel s'affiche (12 374 caractères), le bouton Retour ramène au tri, et
  **ni le classement ni les critères ne sont perdus** au passage.

---

## Ce qui reste à faire sur le site publié

La colonne « Publié » se coche après la mise en ligne. Trois points méritent
une attention particulière, parce qu'ils peuvent se comporter autrement en
ligne qu'en local.

**Le point 7.** En local, le serveur est `python3 -m http.server`. En ligne,
c'est GitHub Pages, qui ajoute ses propres en-têtes. Vérifier que la balise de
politique de sécurité est bien celle qui s'applique, et refaire l'épreuve de
l'appel extérieur **sur le site publié**.

**Le chargement des polices et de PDF.js.** Ce sont les plus gros fichiers du
site. Vérifier qu'ils arrivent bien, et que les caractères accentués
s'affichent — une police absente se remplace en silence par celle du système.

**Un lot complet.** Quarante CV est le maximum prévu. À éprouver une fois en
ligne, sur un vrai lot, pour mesurer le temps d'analyse sur une machine
ordinaire — c'est le visiteur qui calcule, désormais, et non un serveur.

---

## Ce que cette recette ne couvre pas

**Les PDF en colonnes.** Le corpus est fabriqué, et ses PDF sont écrits ligne à
ligne, sur une seule colonne. Le risque décrit au §3 de
`docs/MIGRATION-JS.md` — où l'ordre de lecture peut s'entrelacer — n'est donc
ni confirmé ni infirmé. Il ne le sera que sur de vrais CV, ceux de
l'échantillon conservé hors du dépôt. **C'est le contrôle à faire avant de
considérer la lecture comme acquise.**

**Le « œ ».** Le défaut n°8 du §4 de `docs/MIGRATION-JS.md` n'est pas corrigé :
il changerait les scores, et demande de modifier aussi le moteur Python. C'est
la décision D5.
