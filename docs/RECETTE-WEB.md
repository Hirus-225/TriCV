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

| # | Point de contrôle (§12) | Comment | Local — 17/11/2026 | Publié — 17/11/2026 |
|---|---|---|---|---|
| 1 | Un mot-clé d'une lettre (`R`, `C`) ne correspond pas à l'intérieur d'un autre mot | Automatique — groupe 5 de la page de tests | ✅ | ✅ |
| 2 | « développeur » dans le CV est trouvé par le mot-clé « developpeur », et réciproquement | Automatique — groupe 5 | ✅ | ✅ |
| 3 | La somme des poids, quelle qu'elle soit, produit un score sur 100 cohérent | Automatique — groupe 5 | ✅ | ✅ |
| 4 | Un CV scanné apparaît dans « À examiner manuellement », et non en dernière position du classement | Automatique — groupe 7 — **et** parcours au navigateur | ✅ | ✅ |
| 5 | Un CV Word construit en tableaux est correctement extrait | Automatique — groupe 7, qui couvre aussi les zones de texte flottantes | ✅ | ✅ |
| 6 | Un critère d'exclusion déclenché ne retire pas le candidat du classement | Automatique — groupe 5 — **et** parcours au navigateur | ✅ | ✅ |
| 7 | **Aucune requête ne sort du site** *(remplace « aucune écriture disque »)* | Onglet Réseau, puis l'épreuve ci-dessous | ✅ | ✅ |
| 8 | Le récapitulatif Excel se télécharge sans qu'aucun serveur soit sollicité | Parcours au navigateur, onglet Réseau | ✅ | ✅ |
| 9 | « Effacer la session » ramène à l'écran initial, sans résidu | Manuel, au navigateur | ✅ | ✅ |
| 10 | La notice de confidentialité est visible sans avoir à faire défiler la page | Manuel, au navigateur | ✅ | ✅ |

## Les trois points propres à la version navigateur

| # | Point de contrôle | Comment | Local — 17/11/2026 | Publié — 17/11/2026 |
|---|---|---|---|---|
| 11 | L'application est utilisable sur un téléphone | Réduire la fenêtre à 375 px de large | ✅ | ✅ |
| 12 | Tout est atteignable au clavier seul | Tabulation, de haut en bas | ✅ | ✅ |
| 13 | Le manuel s'affiche et le bouton Retour fait ce qu'on attend | Manuel, au navigateur | ✅ | ✅ |

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

## Le passage sur le site publié — 17/11/2026

Adresse : **https://charleszogoue.ci/TriCV/**

Les treize points ont été repassés en ligne, sur le site réellement servi par
GitHub Pages, et non sur une copie locale.

**Le point 7, celui qui comptait le plus.** En local le serveur est
`python3 -m http.server` ; en ligne c'est GitHub Pages, qui ajoute ses propres
en-têtes. La question était de savoir si la balise de politique de sécurité
s'applique quand même. Elle s'applique : l'appel extérieur provoqué depuis la
console est **refusé**, et l'onglet Réseau ne montre aucune requête sortante.
Sur l'ensemble du parcours — chargement, tri de dix CV, export — **22 requêtes
au chargement, toutes vers le site lui-même, et aucune vers l'extérieur**.

**Les polices et PDF.js arrivent.** Bricolage Grotesque et Manrope sont
chargées depuis `vendor/`, et les accents s'affichent — une police absente se
serait remplacée en silence par celle du système, sans erreur visible. La
console est vide.

**Le tri donne le même résultat qu'en local et qu'en Python.** Dix CV, modèle
« Comptable », **2,4 secondes** : neuf classés de 69 à 0 dans le même ordre,
`03_CV_Traore_Aminata.pdf` à part avec sa raison, compteurs 10 / 9 / 1 / 0.
L'export produit un classeur de 11 262 octets. Avec une règle d'exclusion, les
deux candidats signalés gardent leur rang **et** leur score, et la jauge reste
à 100 / 100.

**Le reste.** « Effacer la session » ne laisse ni classement, ni critère, ni
nom de fichier. Le manuel s'affiche (12 374 caractères) et le bouton Retour
ramène au tri sans rien perdre. À 375 px, aucun élément ne déborde et le
tableau devient une liste de cartes.

**Les points automatiques tournent aussi en ligne** : la page de tests affiche
1 007 cas, aucun écart. *C'est un effet de la configuration actuelle de Pages,
décrite ci-dessous, et cela cessera quand elle sera corrigée — c'est voulu.*

---

## Le réglage de Pages — corrigé le 17/11/2026

**Ce qui n'allait pas.** Le dépôt était réglé en mode *legacy* : `Source =
branche main, dossier /`. GitHub publiait donc **la racine du dépôt entier**,
et non le dossier `web/` empaqueté par `.github/workflows/pages.yml`. Le
workflow s'exécutait pourtant et réussissait, mais le constructeur *legacy*
passait après lui et c'était son résultat qui était servi.

Le symptôme : le bouton « Visit site » de GitHub ouvrait
`https://charleszogoue.ci/TriCV/`, qui affichait le `README.md` converti en
page web par Jekyll — pas l'application. Celle-ci n'était atteignable qu'à
`…/TriCV/web/index.html`.

**Ce qui a été fait.** Le réglage est passé à `build_type: workflow`, soit
*Settings → Pages → Build and deployment → Source : GitHub Actions*, puis la
publication a été relancée par le bouton **Run workflow**.

**Ce qui est servi maintenant**, vérifié adresse par adresse :

| Adresse | Avant | Après |
|---|---|---|
| `/TriCV/` | le README, 16 172 o | **l'application**, 13 470 o |
| `/TriCV/manuel.md` | 404 | 200 |
| `/TriCV/web/index.html` | 200 | **404** |
| `/TriCV/web/tests/tests.html` | 200 | **404** |
| `/TriCV/tests/corpus/CVBR.pdf` | 200 | **404** |
| `/TriCV/app.py` | 200 | **404** |
| `/TriCV/docs/MIGRATION-JS.md` | 200 | **404** |

Repassé sur la nouvelle adresse : titre « TriCV Facile », les deux polices
chargées depuis `vendor/`, 22 requêtes **toutes locales**, l'appel extérieur
provoqué **refusé** par la politique de sécurité, les six choix de modèle, et
le manuel qui s'affiche (12 374 caractères).

> **Une conséquence à connaître pour les recettes suivantes.** Le corpus de
> `tests/corpus/` n'est plus publié — c'était l'intention. Le parcours en
> ligne du 17/11/2026 avait pu s'en servir parce que tout le dépôt était
> publié ; ce ne sera plus possible. Les prochaines vérifications en ligne se
> font en déposant des fichiers depuis sa propre machine, ce qui est de toute
> façon plus proche de l'usage réel.

> **Et une autre, pour qui vérifie.** Le navigateur garde en cache la page
> `/TriCV/`. Après une bascule de ce genre, il faut forcer le rechargement —
> sans quoi on continue de voir l'ancienne page et on croit que rien n'a
> changé.

---

## Le gros lot — mesuré le 17/11/2026

La décision D1 a supprimé le plafond de quarante fichiers ; restait à savoir
ce que donne un lot qui le dépasse.

**45 CV analysés en 3,6 secondes**, soit environ 80 ms par CV, pour 23 Mo de
mémoire occupée par la page. L'export du récapitulatif prend 177 ms de plus.
Un fichier de 6 Mo était du lot : il est accepté — c'est ce que la décision D1
a changé — et ressort dans « À examiner manuellement », faute de texte à y
lire.

> **Ce que cette mesure ne dit pas.** Le lot était fait de copies d'un même
> `.docx`, qui est le format le plus rapide à lire. Sur des PDF, compter
> plutôt 150 ms par CV — c'est ce qu'ont donné les dix CV du corpus, mélange
> de PDF et de Word, en 1,5 seconde en local et 2,4 secondes en ligne. Un lot
> de quarante PDF devrait donc prendre de l'ordre de six secondes. Reste à
> l'éprouver sur un vrai lot, sur une machine ordinaire.

---

## Ce que cette recette ne couvre pas

**Les PDF en colonnes.** Le corpus est fabriqué, et ses PDF sont écrits ligne à
ligne, sur une seule colonne. Le risque décrit au §3 de
`docs/MIGRATION-JS.md` — où l'ordre de lecture peut s'entrelacer — n'est donc
ni confirmé ni infirmé. Il ne le sera que sur de vrais CV, ceux de
l'échantillon conservé hors du dépôt. **C'est le contrôle à faire avant de
considérer la lecture comme acquise.**

**Le « œ ».** Le défaut n°8 du §4 de `docs/MIGRATION-JS.md` **est corrigé**
depuis le 17/11/2026, dans les deux versions à la fois (décision D5). Les
scores du corpus sont inchangés, et un cas de non-régression vérifie que le
même CV écrit « œuvre » ou « oeuvre » obtient le même score.
