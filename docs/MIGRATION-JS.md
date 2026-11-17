# Migration de TriCV vers un site statique JavaScript — étape 1 : inventaire

Document d'étude. **Aucun code n'est écrit à ce stade.** Il recense ce que
l'application Streamlit fait aujourd'hui, ce qu'il faut pour le refaire dans
un navigateur, ce qui risque de mal se passer, les défauts du code actuel, et
le plan de travail proposé.

Branche : `migration-js`. Le code Python reste en place et n'est pas modifié :
c'est lui qui servira de référence pour vérifier la version JavaScript.

---

## Avant tout : ce qui change de nature

Streamlit et un site statique ne sont pas deux façons d'écrire la même chose.
La différence tient en une phrase :

> **Streamlit exécute le code sur un serveur. Un site statique l'exécute dans
> le navigateur du visiteur.**

Trois conséquences qui traversent tout le reste de ce document.

**1. La promesse de confidentialité change de statut.** Aujourd'hui les CV
montent chez Streamlit (serveurs aux États-Unis) le temps de l'analyse, et la
notice le dit. Demain ils ne quittent pas l'ordinateur : GitHub Pages envoie
des fichiers au navigateur, il n'en reçoit jamais. On passe d'un « rien n'est
conservé » à un « rien n'est envoyé ». C'est plus fort, et plusieurs textes de
l'interface deviennent faux et doivent être réécrits (§1.5).

**2. Le modèle d'exécution change.** Streamlit rejoue **tout le script** à
chaque clic, du haut vers le bas ; l'état survit dans `st.session_state`. En
JavaScript, rien ne se rejoue : on écrit des fonctions qui réagissent à des
événements (« quand on clique sur ce bouton, fais ceci »), et qui modifient la
page. L'état est simplement une variable du module.

| Python / Streamlit | JavaScript / navigateur |
|---|---|
| le script est rejoué à chaque interaction | rien n'est rejoué, on branche des fonctions sur des événements |
| `st.session_state["criteres"]` | `export const etat = { criteres: [] }` dans un module |
| `st.rerun()` | on appelle soi-même la fonction qui redessine la zone concernée |
| `st.text_input(...)` crée le champ **et** rend sa valeur | le champ est écrit en HTML ; on lit `champ.value` quand on en a besoin |

**3. La lecture d'un fichier devient asynchrone.** En Python,
`pdfplumber.open(fichier)` rend le résultat tout de suite : la ligne suivante
l'utilise. Dans un navigateur, lire un fichier ou décoder un PDF prend du
temps et ne doit pas geler la page ; ces fonctions rendent donc une
**promesse** (`Promise`), et on écrit `await` devant l'appel pour attendre le
résultat. C'est la seule nouveauté de syntaxe vraiment inédite par rapport à
Python :

```js
// Python : texte = extraire_texte_pdf(fichier)
const texte = await extraireTextePdf(octets);   // await = « attends le résultat »
```

Une fonction qui contient un `await` doit être déclarée `async`. C'est tout.

---

## 1. Inventaire des fonctionnalités

### 1.1 Lecture des CV (`core/parser.py`)

| Fonction | Ce qu'elle fait | Détail à ne pas perdre |
|---|---|---|
| `extraire_texte_pdf` | `pdfplumber.open()` puis `page.extract_text()` page par page, jointes par `\n` | une page sans texte rend `None` et est ignorée ; toute erreur de lecture rend `""` (un document abîmé n'interrompt pas le lot) ; **l'exception n'est jamais journalisée** (règle n°5) |
| `extraire_texte_docx` | descend dans l'arbre XML de `word/document.xml` et ramasse **tous** les paragraphes | voit les tableaux, les tableaux imbriqués et les **zones de texte flottantes** ; saute les sous-arbres `mc:Fallback` (sinon tout est compté deux fois) ; sépare le texte propre d'un paragraphe de ses paragraphes imbriqués |
| `nettoyer_texte` | recomposition NFC, retrait de la ponctuation en début de ligne, réduction des espaces | les lignes vides sont **conservées** (elles séparent les sections) ; la classe d'espaces est exactement `[ \t ]+` — espace, tabulation, **espace insécable** |
| `est_lisible` | `len(normaliser(texte)) >= 100` | la mesure se fait **après** normalisation, pas sur le texte brut |
| `extraire_nom` | heuristique sur le texte, puis repli sur le nom du fichier, puis `None` | **si le document est illisible, on ne regarde pas le texte du tout** : on va directement au nom du fichier |
| `extraire_nom_depuis_texte` | les 5 premières lignes non vides ; retient la première qui « ressemble à un nom » | la ligne est rendue **telle que le candidat l'a écrite** |
| `_ressemble_a_un_nom` | 2 à 4 mots ; ≤ 60 caractères ; chaque mot composé de lettres, traits d'union ou apostrophes ; aucun mot de la liste `_MOTS_DE_SECTION` ; capitales initiales | `isalpha()` est **Unicode** (« Désiré » passe) ; les particules (`de`, `van`, `ben`…) échappent à la règle des capitales |
| `extraire_nom_depuis_fichier` | découpe sur `_ - . espace`, écarte les fragments avec chiffre, les mots administratifs, les fragments < 3 lettres | **n'accepte qu'entre 2 et 4 fragments** : en dehors, rend `None` plutôt qu'un nom inventé |
| `extraire_email` | première adresse trouvée, point final retiré | |
| `extraire_telephone` | premier numéro ivoirien (préfixe `01/05/07/25/27`, indicatif `+225` facultatif) | `(?<!\d)` / `(?!\d)` empêchent d'attraper une tranche au milieu d'un nombre plus long |

`parser_cv` rend `{fichier, lisible, nom, email, telephone, texte}`.

### 1.2 Normalisation (`core/normalisation.py`)

Cinq opérations, dans cet ordre, appliquées **des deux côtés** de la
comparaison (au CV **et** à chaque mot-clé) :

1. recomposition NFC ;
2. passage en minuscules ;
3. suppression des accents (décomposition NFD, puis retrait des marques de
   catégorie Unicode `Mn`) ;
4. toute ponctuation remplacée par **une espace** (et non par rien :
   « C++/Python » doit donner « c python », pas « cpython ») ;
5. espaces multiples réduits, puis `strip()`.

### 1.3 Critères et calcul du score

**Syntaxe de saisie** (`core/criteres.py`) — une seule règle :

> le signe `=` est la seule chose qui crée un groupe de synonymes.

```
python, javascript          ->  [python]  [javascript]
react = vue, angular        ->  [react, vue, angular]
```

Lecture volontairement tolérante : espaces superflus, lignes vides, virgules
en trop et **groupes en double** sont absorbés sans message d'erreur. On coupe
sur le **premier** `=` seulement.

**Calcul** (`core/scorer.py`) :

| Étape | Règle |
|---|---|
| présence d'un terme | `\bterme\b` sur le texte normalisé — **jamais** `terme in texte` (sinon « R » est dans « recrutement ») |
| groupe trouvé | au moins un de ses termes est présent |
| points d'un critère | `points_exacts = (trouvés / nombre de groupes) × poids` ; `points = round(points_exacts)` pour l'affichage |
| critère sans aucun groupe | ratio `0.0`, traité explicitement (pas de division par zéro) |
| score final | `round(somme des points_exacts / somme des poids × 100)` |
| somme des poids nulle | score `0` |
| critères d'exclusion | **aucun effet sur le score**, ne retirent jamais personne ; produisent un signalement `{critere, declencheurs}` |

Deux points de méthode à conserver tels quels :

- la somme se fait sur les points **non arrondis**, et on arrondit **une seule
  fois** à la fin ; en contrepartie les points affichés peuvent ne pas
  totaliser exactement le score (un point d'écart au plus) ;
- le score est un **pourcentage du maximum atteignable** : des poids
  totalisant 150 donnent le même classement que les mêmes proportions sur 100.

**Les cinq modèles** (`core/modeles.py`) : Développeur web, Comptable,
Assistant administratif, Commercial terrain, Logistique. Les mots-clés sont
stockés **sous la forme exacte affichée dans le champ**, et convertis en
groupes à l'usage : ce qui est affiché est ce qui est scoré. Le modèle
Comptable porte le recalibrage du 16/09/2026 (concepts + écritures usuelles au
lieu d'expressions exactes mortes).

Indicateurs dérivés : `total_des_poids` (critères requis seulement) et
`criteres_incomplets` (critères avec un poids mais aucun mot-clé).

### 1.4 Classement, exports, session

- tri par score décroissant, **tri stable** (à score égal, l'ordre de dépôt
  est conservé) ;
- les illisibles sont **sortis du classement**, dans une section à part, sans
  score — jamais en dernière position avec un 0 ;
- quatre compteurs : CV reçus / Analysés et classés / À examiner manuellement
  / Signalements ;
- tableau : Rang, Candidat, Email, Téléphone, Score / 100, Signalements,
  Fichier. Bandes de couleur : **vert ≥ 70, ambre 40 à 70, rouge < 40** ;
- un volet dépliable par candidat : par critère, `points / poids`, une barre,
  la liste des **TROUVÉS** et des **ABSENTS** (termes principaux, tels que
  saisis), puis les signalements d'exclusion ;
- export `.xlsx` en trois feuilles — **Résumé** (en-tête indigo, 6 lignes
  d'information, avertissement, bloc confidentialité), **Classement** (une
  colonne de points par critère requis, mots-clés trouvés et absents, bandes
  de couleur, lignes alternées, puis le bloc « À examiner manuellement »),
  **Critères** (nom, type, poids, mots-clés) ; nom de fichier volontairement
  neutre : `tricv_recapitulatif_AAAA-MM-JJ.xlsx` ;
- « Effacer la session » : dialogue de confirmation, puis remise à zéro
  complète — y compris **les noms de fichiers dans la zone de dépôt** ;
- deux pages : l'outil et le manuel de procédure, lu depuis
  `docs/MANUEL-PROCEDURE.md`.

### 1.5 Messages à reprendre mot pour mot

**Ces textes sont repris sans la moindre retouche.** Ils ont été pesés ; les
réécrire « un peu mieux » est le meilleur moyen d'affaiblir les garde-fous.

**En-tête**

- `OUTIL INTERNE RH`
- `Déposez un lot de CV, définissez vos critères pondérés, obtenez un classement expliqué que vous pouvez exporter en Excel.`
- `**Aucune donnée conservée.** Les CV sont analysés en mémoire vive pendant la session, puis effacés. Aucun fichier, aucun nom et aucun score n'est enregistré sur un serveur.`
- `Traitement éphémère — aucune conservation`
- `1. CRITÈRES → 2. DÉPÔT → 3. ANALYSE → 4. CLASSEMENT`
- `Session effacée. Les CV et leurs scores ont été supprimés de la mémoire vive. Aucune copie n'a été conservée.`

**Étape 1**

- `Étape 1 — Critères de sélection` · `Modèle de poste` · `— Choisir un modèle —`
- `Le modèle propose des critères et des mots-clés que vous pouvez ensuite modifier librement.`
- `Charger le modèle` · `Partir d'une page blanche`
- `Choisissez un modèle ci-dessus, ou partez d'une page blanche pour définir vos propres critères.`
- `Poids attribués` · `{total} / 100`
- `Il reste {n} points à attribuer.`
- `Vous avez attribué {n} points de trop. Le score reste calculé sur 100 : les poids sont ramenés à leur proportion.`
- `Tous les points sont attribués.`
- `Nom du critère` (exemple : `Langages & frameworks`) · `Poids` · `Supprimer ce critère`
- `Mots-clés recherchés` (exemple : `python` / `react = vue, angular`)
- `Un mot-clé par ligne ou séparé par une virgule. Le signe « = » crée un groupe de synonymes : « react = vue, angular » est trouvé si l'un des trois apparaît. Recherche insensible à la casse et aux accents.`
- `{n} groupe de recherche` / `{n} groupes de recherche`
- `＋ Ajouter un critère` · `＋ Ajouter une règle d'exclusion`
- `Critères d'exclusion — signalement seulement` (et `— {n} règle(s) ·` quand il y en a)
- `Un critère d'exclusion n'élimine jamais un candidat et ne modifie jamais son score. Il pose un signalement visible dans le classement ; c'est à vous de trancher.`

**Étape 2**

- `Étape 2 — Dépôt des CV` · `Glissez vos CV ici, ou parcourez vos fichiers`
- `{n} fichier déposé` / `{n} fichiers déposés` · `{x} Mo au total`
- `Ce critère a un poids mais aucun mot-clé, et abaisse donc tous les scores sans rien pouvoir rapporter : « {nom} »`
- `Ces critères ont un poids mais aucun mot-clé, et abaissent donc tous les scores sans rien pouvoir rapporter : {noms}`
- `critère sans nom` (quand le critère incomplet n'a pas de nom)
- `Définissez au moins un critère avec un poids à l'étape 1 pour activer l'analyse.`
- `Lancer l'analyse` / `Lancer l'analyse des {n} CV`

**Étape 3**

- `Étape 3 — Analyse`
- `L'analyse dure quelques secondes. Ne fermez pas cet onglet : les fichiers sont en mémoire vive et seraient perdus.`
- `Préparation…` · `Extraction du texte · {fichier}  ({i} sur {n})` · `Analyse terminée — {n} CV traités`
- `Fichier illisible ou endommagé` · `Document scanné, aucun texte lisible`

**Étape 4**

- `Étape 4 — Classement`
- `Un score faible signifie que les mots-clés recherchés sont absents du CV, pas que le candidat est moins qualifié.`
- `Le score mesure la correspondance aux mots-clés que vous avez définis. Il ne mesure ni la qualité d'un candidat ni son adéquation au poste. Ouvrez le détail par critère et lisez les CV avant toute décision.`
- `CV reçus` · `Analysés et classés` · `À examiner manuellement` · `Signalements`
- `Rang` · `Candidat` · `Email` · `Téléphone` · `Score / 100` · `Signalements` · `Fichier` · `Taille` · `Raison`
- `— (non extrait)` et `—` pour toute valeur absente
- `{n} candidat classé` / `{n} candidats classés` · `vert au-dessus de 70, ambre de 40 à 70, rouge en dessous de 40 — ces teintes qualifient la correspondance aux mots-clés, pas le candidat.`
- `Détail du score par candidat` · `{rang}. {nom} — {score} / 100` · `{critère} — {points} / {poids} pts`
- `TROUVÉS` · `ABSENTS` · `aucun`
- `Règle d'exclusion déclenchée — {critère} : « {terme} »` puis `Le signalement n'écarte pas la candidature et ne modifie pas le score. Le candidat garde son rang ; c'est à vous de trancher.`
- `Un mot-clé absent signifie seulement qu'il n'apparaît pas dans le document. Le candidat peut maîtriser la compétence sans l'avoir écrite.`
- `Aucun CV n'a pu être analysé. Voir la section ci-dessous.`
- `À examiner manuellement`
- `1 CV n'a pas pu être analysé. Il est scanné en image : aucun texte n'en est extractible. Il ne reçoit pas de score et n'est pas classé. Ouvrez-le directement.`
- `{n} CV n'ont pas pu être analysés. Ils sont scannés en image : aucun texte n'en est extractible. Ils ne reçoivent pas de score et ne sont pas classés. Ouvrez-les directement.`
- `Télécharger le récapitulatif (.xlsx)` · `Effacer la session`
- `Le fichier Excel contient le classement, le détail par critère et les mots-clés trouvés pour chaque candidat.`
- `Effacer la session supprime les {n} CV, leurs scores et vos critères. Téléchargez le récapitulatif Excel avant de continuer : rien ne pourra être récupéré.` (au singulier : `le CV déposé, son score`)
- `Oui, effacer la session` · `Annuler`

**Export Excel** — repris intégralement : `TriCV — Récapitulatif de tri`,
`Généré le JJ/MM/AAAA`, `Modèle de poste`, `Critères personnalisés`,
`Critères de sélection`, l'avertissement et la note de lecture,
`Traitement éphémère — aucune conservation`, `Les CV analysés pour produire ce
récapitulatif n'ont jamais été enregistrés sur un disque ni transmis à un
tiers. Ce fichier est la seule trace qui subsiste.`,
`Ces CV n'ont pas pu être analysés : ils sont scannés en image, aucun texte
n'en est extractible. Ils ne reçoivent pas de score et ne sont pas classés.
Ouvrez-les directement.`, `Un groupe de synonymes est écrit « terme principal
= synonyme, synonyme ». Le groupe compte pour trouvé si au moins un de ses
termes figure dans le CV.`, `Requis` / `Exclusion`.

#### Les messages qui doivent changer — et pourquoi

Quatre textes deviennent **faux** sur un site statique. Les garder serait pire
que les réécrire.

| Texte actuel | Problème | Proposition |
|---|---|---|
| `L'application est hébergée sur Streamlit Community Cloud, dont les serveurs sont situés aux États-Unis : les fichiers y transitent le temps de l'analyse.` | Faux : il n'y a plus de serveur d'application, et aucun fichier ne transite | `L'application est un site statique : votre navigateur télécharge la page, puis travaille seul. Les CV que vous déposez ne sont envoyés à aucun serveur, ni pendant l'analyse, ni après.` |
| `Vos données disparaissent à la fin de votre session` | Vrai mais incomplet : elles n'ont jamais quitté l'appareil | `Vos données ne quittent pas votre appareil. Elles disparaissent quand vous fermez l'onglet, ou immédiatement si vous cliquez sur « Effacer la session ».` |
| `Le maximum est de 40 par session, pour que l'application reste disponible pour les autres utilisateurs.` | Faux : il n'y a plus de mémoire partagée entre utilisateurs | voir la décision D1 ci-dessous |
| `Le fichier `docs/MANUEL-PROCEDURE.md` doit être livré avec l'application.` | Le chemin change (`web/manuel.md`) | adapter le chemin |

**Décision D1 à trancher — les plafonds.** Les limites « 40 fichiers » et
« 5 Mo par fichier » venaient du gigaoctet de RAM partagé de Streamlit. Sur un
site statique, la limite est celle de l'ordinateur du visiteur, et elle est
bien plus haute. Trois options :

- **(a) les garder telles quelles** : aucun texte à changer sauf la
  justification ; on bride l'outil sans raison technique ;
- **(b) les relever** (par exemple 100 fichiers / 15 Mo) : plus honnête, mais
  il faut avoir essayé un gros lot avant de l'annoncer ;
- **(c) les transformer en avertissement, sans blocage** : « au-delà de 40 CV,
  l'analyse peut prendre plus d'une minute ». *Recommandé* — c'est la vérité,
  et plus rien ne justifie un refus.

**Décision D2 — l'avertissement « Ne fermez pas cet onglet »** reste vrai, et
même davantage : fermer l'onglet interrompt le calcul lui-même.

---

## 2. Équivalents JavaScript des dépendances Python

### 2.1 Bibliothèques à placer dans `web/vendor/`

| Besoin Python | Équivalent JS retenu | Licence | Pourquoi celui-là |
|---|---|---|---|
| `pdfplumber` (texte des PDF) | **PDF.js** 6.4.299 (Mozilla) | Apache-2.0 | déjà figé dans `RapprochementBancaire/web/vendor/pdfjs/` — **à recopier tel quel**, avec `cmaps/` et `standard_fonts/` |
| `python-docx` (texte des .docx) | **fflate** (décompression zip) + `DOMParser` **du navigateur** | MIT | voir ci-dessous : mammoth.js ne convient pas |
| `openpyxl` (écriture Excel **mise en forme**) | **ExcelJS** | MIT | voir ci-dessous : SheetJS ne convient pas |
| `st.markdown` (manuel) | **marked** 18.1.2 | MIT | déjà figé dans `RapprochementBancaire/web/vendor/marked/` |
| `unicodedata`, `re`, `round` | **rien** — le navigateur suffit | — | §2.2 |
| `pandas` (bandes de couleur du tableau) | **rien** — un tableau HTML et des classes CSS | — | pandas ne servait qu'à colorer des cellules |
| polices | **Bricolage Grotesque + Manrope** (woff2, sous-ensemble latin) | OFL-1.1 | à recopier de `RapprochementBancaire/web/vendor/fonts/` |

**Pourquoi pas mammoth.js pour les .docx.** Mammoth convertit un document
Word en HTML, en *interprétant* la mise en forme. Deux problèmes
rédhibitoires ici. D'abord il **ignore les zones de texte flottantes** : or
c'est précisément le cas découvert le 16/09/2026, un CV entier en zones de
texte qui ressortait à zéro caractère, et que `_collecter_paragraphes` a été
écrit pour rattraper. Ensuite il produit du HTML, qu'il faudrait reconvertir
en texte — une seconde traduction, avec ses propres écarts, là où le code
Python lit directement le XML.

La transposition fidèle est plus simple qu'elle n'en a l'air. Un `.docx` est
une archive zip ; `word/document.xml` est du XML. On a donc besoin de
décompresser (fflate, ~30 Ko) puis de lire du XML — et pour ça le navigateur
fournit `DOMParser`, sans aucune bibliothèque. Le parcours d'arbre est ensuite
la traduction ligne pour ligne de `_collecter_paragraphes`.

**Pourquoi pas SheetJS pour l'export.** SheetJS Community Edition **n'écrit
pas les styles de cellule** (c'est réservé à sa version payante). Or l'export
de TriCV est entièrement mis en forme : en-têtes indigo, bandes de couleur sur
les scores, lignes alternées, cellules fusionnées, hauteurs de ligne, filets.
Avec SheetJS on obtiendrait trois feuilles de données brutes — pas le même
livrable. ExcelJS écrit tout cela (`fill`, `font`, `border`, `alignment`,
`mergeCells`, `columns[].width`, `row.height`), ce qui en fait l'équivalent
direct d'openpyxl.

> À vérifier à l'étape du vendor : le poids d'ExcelJS (≈ 1 Mo minifié) et le
> fait que son bundle navigateur fonctionne sans outil de construction. Si ce
> point résiste, le repli est d'écrire le `.xlsx` à la main — un `.xlsx` est
> un zip de fichiers XML, et fflate est déjà là. C'est faisable mais c'est
> plusieurs centaines de lignes : à ne faire qu'en dernier recours.

### 2.2 Ce que le navigateur sait déjà faire — sans bibliothèque

| Python | JavaScript | Piège |
|---|---|---|
| `unicodedata.normalize("NFC", t)` | `t.normalize("NFC")` | aucun |
| retrait des accents | `t.normalize("NFD").replace(/\p{Mn}/gu, "")` | le drapeau `u` est **obligatoire** pour que `\p{Mn}` soit reconnu |
| `re.compile(r"\bmot\b")` | `new RegExp("\\b" + mot + "\\b")` | en JS, `\b` ne connaît **que** l'ASCII. Ici ce n'est pas un problème : la normalisation a déjà retiré accents et ponctuation, il ne reste que `a-z0-9` et des espaces. **Mais la normalisation doit impérativement être appliquée avant.** |
| `re.escape(terme)` | pas d'équivalent natif : 3 lignes à écrire | `terme.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")` |
| `str.isalpha()` (Unicode) | `/^\p{L}+$/u.test(mot)` | **ne pas** écrire `/^[a-zA-Z]+$/` : « Désiré » serait rejeté |
| `str.capitalize()` | à écrire : première lettre en majuscule, **le reste en minuscules** | `capitalize()` rabaisse le reste (`KABORE` → `Kabore`) ; `mot[0].toUpperCase() + mot.slice(1)` ne le fait pas |
| `sorted(l, key=f, reverse=True)` | `[...l].sort((a, b) => f(b) - f(a))` | `sort` modifie le tableau sur place — d'où la copie `[...l]` ; le tri est stable dans les deux langages, donc les ex æquo gardent l'ordre de dépôt |
| `f"{n} sur {t}"` | `` `${n} sur ${t}` `` | guillemets obliques, pas des apostrophes |
| `None` | `null` | `null`, `undefined`, `0` et `""` sont tous « faux » en JS : tester `if (nom)` sur un nom vide se comporte comme en Python |
| dictionnaire | objet `{}` | les clés d'un objet JS sont toujours des chaînes ; pour autre chose, `Map` |
| `[x for x in l if c]` | `l.filter(c).map(x => ...)` | |
| `"\n".join(l)` | `l.join("\n")` | l'ordre est inversé : c'est la liste qui porte la méthode |

### 2.3 Le piège qui fausserait les scores : `round`

**Python et JavaScript n'arrondissent pas pareil**, et c'est vérifié :

| Valeur | `round()` Python | `Math.round()` JS |
|---|---|---|
| `12.5` | **12** | 13 |
| `17.5` | 18 | 18 |
| `72.5` | **72** | 73 |

Python applique l'« arrondi du banquier » : à exactement `,5`, il va vers
l'entier **pair**. JavaScript arrondit toujours vers le haut. Ce n'est pas une
curiosité théorique — le cas se produit avec des poids ordinaires :

> un critère de **poids 25** dont **1 groupe sur 2** est trouvé vaut
> `12,5 points`. L'application affiche aujourd'hui **12**. Une version
> JavaScript naïve afficherait **13**.

Et sur le score global : critère A de poids 5 avec 1 groupe sur 2 trouvé,
critère B de poids 15 sans rien → `12,5 %` → Python **12**, JS **13**.

**Conséquence pratique :** il faut écrire une fonction `arrondirCommePython`
(une dizaine de lignes) et l'utiliser partout où le code Python écrit
`round()`. Sans elle, les tests de référence échoueront sur des cas isolés et,
surtout, **deux candidats pourraient changer de place dans le classement**.

### 2.4 Ce qui disparaît sans remplacement

- **Streamlit** : remplacé par du HTML écrit à la main et quelques fonctions
  qui redessinent des zones de la page.
- **`st.session_state`** : un objet dans un module `etat.js`.
- **`@st.cache_data` / `@st.cache_resource`** : la règle n°2 du §5 du cadrage
  devient sans objet — il n'y a plus de cache serveur partagé entre
  utilisateurs. La règle **n'est pas supprimée du document**, elle est notée
  comme devenue structurellement impossible.
- **`requirements.txt`** côté application : plus aucune dépendance installée à
  l'exécution. Le Python survivant (le script de référence) garde le sien.

---

## 3. Les CV qui risquent de mal se lire

Le tableau donne, pour chaque cas, ce que fait l'application **aujourd'hui**
et ce qu'elle **doit afficher** demain.

| Cas | Aujourd'hui (Python) | En JavaScript | Ce qui doit s'afficher |
|---|---|---|---|
| **PDF scanné** (image sans couche texte) | aucun texte, seuil de 100 caractères non atteint | PDF.js se comporte pareil | `À examiner manuellement` + `Document scanné, aucun texte lisible`. **Jamais un score de 0.** |
| **PDF scanné avec un peu de texte parasite** (tampon, en-tête) | sous le seuil → illisible, et le nom est pris **dans le nom du fichier** | identique | même chose. C'est la correction du cas « MARIE SANS / ENFANT EN CHARGE » : sur un illisible, on ne pêche pas de nom dans le texte |
| **PDF en colonnes** | `extract_text` de pdfplumber **range les mots par position** : les colonnes ressortent dans un ordre lisible | **différence réelle** : `getTextContent()` de PDF.js rend les morceaux dans l'ordre du flux de dessin, qui peut entrelacer les colonnes | sans effet sur le **score** (seule compte la présence des mots) ; mais l'**extraction du nom** raisonne sur les 5 premières lignes et peut échouer → repli sur le nom du fichier. **Parade : regrouper les morceaux par ordonnée (Y) puis trier par abscisse (X) avant de former les lignes.** C'est ce que fait déjà `RapprochementBancaire/web/js/pdf-mots.js` |
| **PDF avec tableaux** | le texte des cellules est du texte comme un autre | identique | rien de particulier |
| **PDF protégé par mot de passe** | `pdfplumber` lève une exception → texte vide → classé illisible, raison `Document scanné, aucun texte lisible` — **message faux** | PDF.js lève une `PasswordException`, qu'on peut distinguer | **à améliorer** : nouvelle raison `Document protégé par mot de passe` |
| **PDF aux polices non incorporées / texte vectorisé** | rend parfois des caractères illisibles qui **passent** le seuil de 100 → score calculé sur du charabia | identique, et `cmaps/` + `standard_fonts/` aident | risque commun aux deux versions. Voir défaut n°7 au §4 |
| **.docx en tableaux** | correctement extrait (parcours XML) | identique si l'on transpose fidèlement | rien de particulier |
| **.docx en zones de texte flottantes** (Canva, modèles graphiques) | correctement extrait depuis le 16/09/2026 ; **l'ordre des lignes peut ne pas être l'ordre de lecture** | identique | sans effet sur le score ; l'extraction du nom peut échouer → repli nom de fichier |
| **.doc (ancien format binaire Word)** | `extraire_texte` lève `ValueError`, **mais** le message affiché est `Fichier illisible ou endommagé` — trompeur. En pratique Streamlit filtrait en amont | **aucune bibliothèque JS ne lit le .doc binaire**, et en HTML l'attribut `accept` n'est qu'une suggestion : un glisser-déposer passe outre | **à écrire** : `Format non pris en charge : .doc. Enregistrez le document en .docx depuis Word, ou exportez-le en PDF.` |
| **Fichier renommé** (un `.doc` appelé `.docx`, un `.pages`, un `.odt`) | `Document()` échoue → texte vide → illisible | la lecture du zip échoue | **à écrire** : `Fichier illisible ou endommagé` (message existant, ici exact) |
| **PDF de 40 pages** | lent, mais côté serveur | lent **dans l'onglet du visiteur** | la barre de progression doit nommer le fichier en cours et rendre la main à l'affichage entre deux CV (§6, étape E5) |
| **CV en anglais ou en langue non latine** | la normalisation réduit tout ce qui n'est ni `a-z` ni `0-9` à des espaces | identique | hors périmètre, comportement inchangé |

---

## 4. Défauts cachés repérés dans le code Python

Classés par gravité. Les trois premiers sont **vérifiés par exécution**, pas
déduits de la lecture.

### 1. L'export Excel est faux quand deux critères portent le même nom — *vérifié*

`core/export.py` indexe le détail par **nom de critère** :

```python
detail = {ligne["critere"]: ligne for ligne in candidat.get("detail", [])}
```

Deux critères de même nom s'écrasent dans ce dictionnaire. Or
« ＋ Ajouter un critère » crée un critère **sans nom** : deux critères non
nommés suffisent. Résultat mesuré sur un candidat à 50/100, « python » trouvé
et « excel » absent :

| En-tête | ` (pts)` | ` (pts)` | Mots-clés trouvés | Mots-clés absents |
|---|---|---|---|---|
| valeur écrite | `0 / 50` | `0 / 50` | `—` | `excel, excel` |

Le classeur annonce donc **zéro point sur les deux critères** et **aucun
mot-clé trouvé**, pour un candidat qui a 50. L'affichage à l'écran, lui, est
correct : `afficher_details` parcourt la liste dans l'ordre au lieu de
l'indexer par nom. **L'écran et l'export se contredisent.**

*Correction :* indexer par **position**, pas par nom. En JavaScript, parcourir
`detail` dans l'ordre des critères requis.

### 2. Un critère d'exclusion s'affiche comme un critère normal, avec un champ « Poids » qui ne sert à rien

`afficher_etape_criteres` boucle sur **tous** les critères et appelle
`afficher_un_critere` pour chacun. Rien ne distingue un critère d'exclusion :
il reçoit la même carte, avec un champ `Poids` de 0 à 100. Ce poids est
ensuite **ignoré** par `total_des_poids` (qui ne compte que les requis). Un
utilisateur qui met 20 dans ce champ voit « Poids attribués : 80 / 100 » et ne
peut pas comprendre pourquoi.

Pire : le volet « Critères d'exclusion » ne contient **que le bouton d'ajout**.
La règle créée apparaît ailleurs, dans la liste des critères normaux, sans
mention de son type.

*Correction :* dans la refonte, les règles d'exclusion vivent **dans leur
propre bloc**, avec un nom et des mots-clés, **sans champ de poids**.

### 3. Le classement affiché peut correspondre à d'anciens critères

`st.session_state.resultats` est remis à `None` lorsqu'on charge un modèle,
part d'une page blanche, ajoute ou supprime un critère (lignes 275, 282, 400,
405, 438). **Pas** lorsqu'on modifie le nom, le poids ou les mots-clés d'un
critère existant.

Conséquence : on analyse 10 CV, on corrige un mot-clé à l'étape 1 — le
classement de l'étape 4 reste à l'écran, calculé avec l'ancien mot-clé, sans
rien qui le signale. L'export Excel, lui, utilise `criteres_analyse` et reste
cohérent avec les scores : c'est donc **l'écran** qui ment.

*Correction :* comparer les critères saisis aux critères analysés et afficher
un bandeau du genre `Les critères ont changé depuis cette analyse. Relancez
pour mettre le classement à jour.` — plutôt que d'effacer le classement, ce
qui ferait perdre le travail au moindre ajustement.

### 4. Le plafond de 5 Mo par fichier n'est vérifié nulle part dans le code

`MAX_MO_PAR_FICHIER = 5` ne sert qu'à **écrire le message**. Le contrôle réel
est fait par `server.maxUploadSize` dans `.streamlit/config.toml`, c'est-à-dire
par l'hébergeur. Sur un site statique, **cet hébergeur disparaît** : si l'on
garde la limite, il faut la programmer (`fichier.size > 5 * 1024 * 1024`).
À relier à la décision D1.

### 5. Le message d'un format non pris en charge est trompeur

`extraire_texte` lève `ValueError("Format non pris en charge : .doc")`, mais
`analyser_les_cv` attrape **toutes** les exceptions et affiche
`Fichier illisible ou endommagé`. L'utilisateur qui dépose un `.doc` croit son
fichier abîmé alors qu'il suffit de l'enregistrer en `.docx`. Invisible
aujourd'hui (Streamlit filtre en amont), **inévitable demain**.

### 6. Le classeur Excel est reconstruit à chaque interaction

`generer_classeur` est appelé dans `afficher_actions_finales`, donc à **chaque
réexécution du script** — chaque clic, chaque frappe. On fabrique un classeur
complet pour un bouton sur lequel personne n'a cliqué. Sans gravité sur le
serveur, mais à ne pas reproduire : en JavaScript, on construit le fichier
**dans le gestionnaire du clic**.

### 7. Un texte extrait mais illisible passe pour du contenu valable

`est_lisible` ne mesure qu'une **longueur**. Un PDF dont les polices rendent
du charabia (`cid:12`, lettres permutées) peut dépasser 100 caractères et être
scoré : tous les mots-clés seront absents, le candidat finira dernier avec un
score bas — exactement l'issue que le §7.5 cherche à éviter pour les scans.

*Piste, à ne pas traiter dans cette migration :* mesurer la proportion de mots
du texte normalisé qui font 2 lettres ou moins, ou qui n'apparaissent dans
aucun dictionnaire sommaire. À noter comme limite connue plutôt qu'à corriger
à l'aveugle.

### 8. Petites choses

- **`afficher_un_critere(critere, indice)`** : le paramètre `indice` n'est
  jamais utilisé.
- **Le texte des limites est écrit deux fois** dans l'étape 2 : une fois en
  `help=` de la zone de dépôt, une fois en `st.caption` juste en dessous.
- **`Étape 3 — Analyse`** et son avertissement sont dessinés **dans**
  `analyser_les_cv`, suivi d'un `st.rerun()` : ils apparaissent puis
  disparaissent. Dans la version JS, l'état d'analyse doit être une zone
  stable de la page.
- **Deux fichiers de même nom** dans un lot ne sont pas signalés : deux lignes
  identiques dans le classement, sans moyen de les distinguer.
- **`.streamlit/config.toml`** note lui-même que la maquette annonce « 10 Mo »
  alors que la limite appliquée est 5 Mo. À trancher avec D1.

### Ce qu'on en fait

**La migration reproduit le comportement actuel, défauts compris**, pour que
les tests de référence puissent être verts. Les défauts 1 à 5 sont corrigés
**dans une étape séparée** (E7), après validation du socle — un défaut corrigé
pendant le portage, c'est un écart dont on ne sait plus dire s'il est une
correction ou une erreur de traduction.

Seule exception : **l'arrondi (§2.3)**. Il ne s'agit pas d'un défaut mais d'une
différence entre les deux langages, et il faut le régler dès le portage du
moteur, sans quoi aucun test n'est fiable.

---

## 5. Proposition d'interface

### 5.1 Ce qui est repris de `charleszogoue.ci` et de Rapprochement Facile

Les deux dépôts partagent déjà une identité. On la reprend **à l'identique**,
sans inventer de variante : c'est l'intérêt d'avoir une famille d'outils.

**Jetons de couleur** (de `RapprochementBancaire/web/css/style.css`, repris du
portfolio) :

| Jeton | Valeur | Emploi dans TriCV |
|---|---|---|
| `--navy` | `#123249` | bandeau, pied, titres de section |
| `--navy-deep` | `#0b2233` | aplats du pied |
| `--sky` | `#2c668f` | liens secondaires, puces d'information |
| `--amber` | `#f2a31b` | filet de 8 px sous le bandeau, soulignement des liens d'action, contour de focus |
| `--amber-pale` | `#fbe3b3` | survol des liens d'action |
| `--paper` / `--mist` | `#ffffff` / `#edf2f6` | fonds |
| `--rule` | `#d3dde6` | filets, contours de cartes |
| `--ink` / `--muted` | `#14222d` / `#566776` | texte, texte secondaire |
| `--ok` / `--alert` | `#1d7a4f` / `#b23a2e` | états |
| `--amber-wash` / `--alert-wash` | `#fdf3df` / `#f9e7e4` | fonds d'avertissement et d'erreur |

**Important :** l'indigo `#4F46E5` du thème Streamlit actuel **n'est pas** la
couleur de la famille — c'est un choix propre à la maquette TriCV. Il
disparaît de l'interface. Il **reste** dans l'export Excel, où il est la
couleur d'en-tête héritée de RecrutPro (`core/export.py`), sauf décision
contraire.

> **Décision D3 à trancher :** aligner aussi l'export Excel sur le marine
> `#123249` (famille cohérente jusque dans le livrable), ou garder l'indigo
> (continuité avec les classeurs déjà produits). Je recommande l'alignement,
> le classeur étant ce qui circule le plus.

**Polices** : `Bricolage Grotesque` pour les titres, `Manrope` pour le texte,
en woff2 local — jamais Google Fonts. Les chiffres en `tabular-nums`, ce qui
compte pour un tableau de scores.

**Signature visuelle reprise** : bandeau marine quadrillé fermé par un filet
ambre de 8 px ; aucune ombre portée ; filets marine de 3 px au-dessus des
blocs ; liens d'action soulignés d'ambre (`.go`) ; puces à coins de 8 px
(`.puce`) ; colonne centrée de 1160 px (`.cadre`) ; contour de focus ambre de
3 px.

**Composants déjà écrits, à reprendre** : `.bandeau`, `.cadre`, `.section`,
`.section__tete`, `.go`, `.puce`, `.bloc` (compteur), `.alerte` et ses
variantes, `.depot` (zone de dépôt), `.btn--lancer`, `.progression`,
`.table-wrap`, `.pied`, `.manuel`.

### 5.2 Ce qu'on abandonne de Streamlit

- **la barre latérale** : la navigation passe dans le bandeau, comme sur le
  site (`Tri des CV` · `Manuel de procédure` · `charleszogoue.ci`) ;
- **le `number_input` à flèches** pour les poids : remplacé par un champ
  numérique large, au clavier, avec sa jauge ;
- **l'empilement vertical d'étapes séparées par des filets** : remplacé par de
  vraies sections titrées, atteignables depuis le bandeau ;
- **le tableau `st.dataframe`** : remplacé par un tableau HTML, lisible sans
  barre de défilement horizontale, et qui **devient une liste de cartes sur
  téléphone**.

### 5.3 Les écrans

**Écran 1 — Bandeau (haut de toutes les pages)**

```
┌──────────────────────────────────────────────────────────────┐
│ TriCV Facile          Tri des CV · Manuel · charleszogoue.ci │  marine
│                                                              │  quadrillé
│  Tri de CV                                                   │  h1 ~5rem
│                                                              │
│  Vos critères d'un côté,          ┃ Rien ne quitte votre     │
│  le lot de CV de l'autre.         ┃ ordinateur.              │
│  Déposez vos CV, pondérez vos     ┃ Les CV sont lus dans ce  │
│  critères, obtenez un classement  ┃ navigateur et ne sont    │
│  expliqué, exportable en Excel.   ┃ envoyés nulle part.      │
└══════════════════════════════════════════════════════════════┘  filet ambre 8px
```

La notice courte (`Aucune donnée conservée…`) se trouve donc **dans le
bandeau**, visible sans défilement : le point 10 de la recette est tenu par la
structure même de la page, et non par un réglage de hauteur. Le texte complet
reste dans un `<details>` juste en dessous.

**Écran 2 — Section « Critères »**

- en tête de section : titre + une ligne d'explication, et à droite la **jauge
  de poids** (`Poids attribués 85 / 100`, barre ambre, message « Il reste 15
  points à attribuer. ») ;
- choix du modèle : **cinq puces cliquables** (`Développeur web`,
  `Comptable`, `Assistant administratif`, `Commercial terrain`, `Logistique`)
  plus `Page blanche` — au lieu d'une liste déroulante suivie d'un bouton
  « Charger ». Un clic charge. C'est plus court, et utilisable au pouce ;
- une **carte par critère**, filet marine de 3 px en haut : nom à gauche,
  poids à droite, zone de mots-clés en dessous, et sous le champ la ligne
  vivante `4 groupes de recherche : python · javascript · django · react (+2)` ;
- `＋ Ajouter un critère` en lien d'action souligné d'ambre ;
- **bloc « Règles d'exclusion »** séparé, replié par défaut, en fond brume,
  avec sa phrase d'avertissement. Les cartes y ont un nom et des mots-clés,
  **pas de poids** (défaut n°2 corrigé).

**Écran 3 — Section « CV »**

- zone de dépôt pleine largeur, pointillés marine, qui réagit au survol et au
  glisser ; les limites sont annoncées **une seule fois** ;
- la liste des fichiers déposés en puces, chacune avec son nom, sa taille et
  une croix pour la retirer ;
- un message d'erreur par fichier refusé (format, taille), **au niveau du
  fichier** et non en bloc ;
- le bouton `Lancer l'analyse des 10 CV`, large, marine, désactivé tant qu'il
  manque un critère pondéré ou un fichier — avec, en dessous, la raison
  exacte.

**Écran 4 — Analyse (zone stable, pas un écran qui passe)**

Barre de progression ambre, `Extraction du texte · 03_CV_Traore_Aminata.pdf
(3 sur 10)`, et l'avertissement `Ne fermez pas cet onglet…`. La zone reste en
place et devient le résumé de l'analyse une fois terminée.

**Écran 5 — Section « Classement »**

```
┌─ avertissement permanent, fond ambre pâle, non repliable ────┐
│ Un score faible signifie que les mots-clés recherchés sont   │
│ absents du CV, pas que le candidat est moins qualifié.       │
└──────────────────────────────────────────────────────────────┘

 ┏━━━━━━━━━┓ ┏━━━━━━━━━┓ ┏━━━━━━━━━┓ ┏━━━━━━━━━┓
 ┃   10    ┃ ┃    8    ┃ ┃    2    ┃ ┃    1    ┃   4 blocs .bloc
 ┃CV reçus ┃ ┃ classés ┃ ┃à examiner┃ ┃signalés┃
 ┗━━━━━━━━━┛ ┗━━━━━━━━━┛ ┗━━━━━━━━━┛ ┗━━━━━━━━━┛

 Rang │ Candidat          │ Email        │ Tél.  │ Score │ Signal.
 ─────┼───────────────────┼──────────────┼───────┼───────┼─────────
   1  │ KONE Hamed        │ k@mail.ci    │ 07 …  │  86   │   —        vert
   2  │ Traoré Aminata    │ a@mail.ci    │ 05 …  │  71   │ Intérim    vert + puce ambre
   3  │ Yao Emmanuel      │ —            │ 27 …  │  52   │   —        ambre
 ▸ chaque ligne se déplie sur le détail par critère
```

Le détail dépliable est un `<details>` natif du navigateur : par critère, le
nom, `points / poids`, une barre, puis `TROUVÉS` et `ABSENTS`. Aucun
JavaScript nécessaire pour l'ouverture et la fermeture.

Puis le bloc **« À examiner manuellement »**, fond brume, nettement séparé —
jamais une ligne du tableau. Puis les deux actions : `Télécharger le
récapitulatif (.xlsx)` en bouton marine, `Effacer la session` en lien d'action
discret, avec son dialogue de confirmation (`<dialog>`, également natif).

**Écran 6 — Téléphone (≤ 700 px)**

C'est le point que Streamlit ne traitait pas. Trois changements :

- bandeau réduit : titre plus petit, accroche en une colonne ;
- les cartes de critère passent en une colonne, le poids sous le nom ;
- **le tableau devient une liste de cartes** : une carte par candidat, avec
  le rang et le score en gros, le nom, puis email et téléphone en liens
  cliquables (`tel:`, `mailto:`), et le détail dépliable. Un tableau à sept
  colonnes sur 375 px n'est pas lisible, et le faire défiler latéralement est
  une fausse solution.

**Écran 7 — Manuel de procédure**

Même bandeau, en version réduite. Le contenu de `web/manuel.md` rendu par
`marked`, dans une colonne de lecture étroite (~72 caractères).

---

## 6. Plan de fichiers et d'étapes

### 6.1 Arborescence cible

```
TriCV/
├── app.py                      ← inchangé (version Streamlit conservée)
├── core/                       ← inchangé, devient la RÉFÉRENCE
├── docs/
│   ├── MIGRATION-JS.md         ← ce document
│   └── …
├── tests/
│   ├── verifier_moteur.py      ← inchangé
│   ├── corpus/                 ← les 10 CV, inchangés
│   └── generer_reference_js.py ← NOUVEAU : écrit les résultats attendus en JSON
└── web/                        ← NOUVEAU, c'est ce que GitHub Pages publie
    ├── index.html
    ├── manuel.md               ← copie de docs/MANUEL-PROCEDURE.md
    ├── favicon.svg
    ├── css/
    │   └── style.css
    ├── js/
    │   ├── main.js             ← assemblage, branchement des événements
    │   ├── etat.js             ← remplace st.session_state
    │   ├── outils.js           ← arrondirCommePython, accorder, nombreFrancais, tailles
    │   ├── normalisation.js    ← core/normalisation.py
    │   ├── criteres.js         ← core/criteres.py
    │   ├── modeles.js          ← core/modeles.py
    │   ├── scorer.js           ← core/scorer.py
    │   ├── pdf-texte.js        ← extraire_texte_pdf
    │   ├── docx-texte.js       ← extraire_texte_docx
    │   ├── parser.js           ← nettoyer_texte, est_lisible, nom/email/téléphone
    │   ├── export.js           ← core/export.py (ExcelJS)
    │   ├── manuel.js           ← rendu Markdown
    │   └── vue-criteres.js, vue-depot.js, vue-classement.js
    ├── tests/
    │   ├── tests.html
    │   ├── tests.js            ← compare le JS aux JSON de référence
    │   └── tests.css
    └── vendor/
        ├── LISEZMOI.md         ← tableau des versions et des licences
        ├── pdfjs/              (+ cmaps/, standard_fonts/, LICENSE)
        ├── fflate/             (+ LICENSE)
        ├── exceljs/            (+ LICENSE)
        ├── marked/             (+ LICENSE)
        └── fonts/              (woff2 + polices.css + LICENCE-*.txt)
```

**Un module par fichier Python**, même nom, même découpage : quand une règle
change, on sait exactement où aller dans les deux versions. Les trois fichiers
`vue-*.js` n'ont pas d'équivalent Python — ils remplacent ce que Streamlit
faisait tout seul.

### 6.2 Les étapes, et comment chacune se valide

Un commit par étape validée. **Aucune étape ne commence avant que la
précédente soit validée.**

| # | Étape | Contenu | Validation — ce qu'on regarde |
|---|---|---|---|
| **E1** | **Inventaire** *(fait)* | ce document | vous l'avez lu et vous tranchez D1, D2, D3 |
| **E2** | **Socle et bibliothèques** | `web/` ; `index.html` avec la politique de sécurité ; `vendor/` rempli avec les licences et `LISEZMOI.md` ; polices ; `style.css` avec les jetons et le bandeau | `python3 -m http.server` à la racine, ouvrir `/web/index.html` : le bandeau s'affiche aux bonnes couleurs et polices, **la console est vide**, et l'onglet Réseau ne montre **aucune requête hors du site** |
| **E3** | **Moteur pur** | `normalisation.js`, `criteres.js`, `scorer.js`, `modeles.js`, `outils.js` (dont `arrondirCommePython`) ; `generer_reference_js.py` pour la partie moteur ; `tests.html` | la page de tests est **verte sur toutes les lignes** : les 101 vérifications de `verifier_moteur.py` transposées, le total des poids des 5 modèles à 100, et **les cas d'arrondi du §2.3** |
| **E4** | **Lecture des CV** | `pdf-texte.js`, `docx-texte.js`, `parser.js` ; référence étendue aux 10 CV du corpus | pour chacun des 10 CV : **texte extrait identique** à celui de Python (comparaison caractère par caractère), et **même `lisible`, `nom`, `email`, `telephone`** — soit, aujourd'hui, **9 lisibles et 1 illisible** (`03_CV_Traore_Aminata.pdf`), le nom de `CVBR.pdf` restant **vide** et celui de `02_CV_Kouassi_Guy_Desire.pdf` ressortant bien `Kouassi Guy-Désiré`, accent recomposé. Les écarts de découpage en lignes des PDF en colonnes sont tracés ici, pas plus tard |
| **E5** | **Interface** | `index.html` complet, `vue-*.js`, `main.js`, `etat.js` ; pas encore d'export | parcours complet sur les 10 CV du corpus dans le navigateur : **le classement est rang pour rang celui de Python** (avec le modèle Comptable : 9 classés de 69 à 0, et `03_CV_Traore_Aminata.pdf` à part) ; la progression nomme les fichiers ; relecture à 375 px de large (le tableau est en cartes) ; au clavier seul, on peut tout faire |
| **E6** | **Export Excel** | `export.js` | ouvrir le `.xlsx` produit **et** celui de Python côte à côte : trois feuilles, mêmes intitulés, mêmes colonnes, mêmes bandes de couleur, mêmes textes d'avertissement. Vérifier aussi un lot **sans aucun illisible** et un lot **sans aucun classé** |
| **E7** | **Correction des défauts** | défauts 1 à 5 du §4, plus les textes réécrits du §1.5 | la référence Python est **mise à jour pour les défauts corrigés** (le cas « deux critères de même nom » doit maintenant **différer** de Python, et la raison est écrite dans le test) ; `.doc` déposé → le bon message ; critères modifiés après analyse → le bandeau apparaît |
| **E8** | **Manuel et navigation** | `manuel.md`, `manuel.js`, navigation par ancre (`#tri`, `#manuel`), `favicon.svg` | le manuel s'affiche, les liens du bandeau fonctionnent, le bouton Retour du navigateur fait ce qu'on attend |
| **E9** | **Recette et mise en ligne** | `RECETTE.md` adapté, publication GitHub Pages | les 10 points de la recette, **revus pour le navigateur** (le point 7 « aucune écriture disque » devient « aucune requête réseau sortante », vérifiable dans l'onglet Réseau), cochés sur **le site publié**, pas seulement en local |

### 6.3 Le script de référence, en deux mots

C'est la pièce qui rend la migration vérifiable au lieu de « ça a l'air de
marcher ».

`tests/generer_reference_js.py` importe `core/` — le code actuel, celui qui
tourne en production — le fait tourner sur les 10 CV de `tests/corpus/` et
écrit, dans un dossier JSON, **tout ce que la version JavaScript doit
reproduire** : le texte extrait de chaque fichier, le texte normalisé, les
groupes issus de chaque saisie, le détail par critère, les scores, le
classement. Modèle : `RapprochementBancaire/script_reference_js.py`, qui fait
exactement cela pour l'autre outil.

La page `web/tests/tests.html` charge ces JSON, rejoue les mêmes calculs en
JavaScript, et affiche une ligne verte ou rouge par comparaison. Une ligne
rouge est soit un défaut de traduction, soit un écart assumé — et dans ce
second cas, **la raison est écrite dans le test**.

Le corpus de `tests/corpus/` ne contient pas de données réelles — il est
fabriqué par `tests/generer_corpus.py` — et peut donc rester dans le dépôt.
Il couvre bien les cas qui comptent : dix fichiers, dont un PDF scanné
(illisible), des `.docx` en tableaux et en zones de texte, un nom accentué
recomposé en NFC, et `CVBR.pdf` dont le nom de fichier ne permet **pas** de
deviner un nom de candidat. Les scores, eux, dépendent du modèle de critères
choisi : la référence doit donc enregistrer **le modèle utilisé** à côté des
résultats attendus.

Si vous ajoutez un jour de vrais CV, ils vont dans un dossier exclu de git,
comme `data_entree/` chez Rapprochement.

---

## Ce qui attend votre arbitrage

| | Décision | Ma recommandation |
|---|---|---|
| **D1** | les plafonds (40 fichiers, 5 Mo) : garder, relever, ou transformer en simple avertissement | **avertissement sans blocage** — plus rien ne justifie un refus, et le texte actuel donne une raison devenue fausse |
| **D2** | la notice de confidentialité réécrite (§1.5) | adopter les deux formulations proposées |
| **D3** | l'export Excel : marine `#123249` ou indigo `#4F46E5` | **marine**, pour que le classeur qui circule porte la même identité que le reste |
| **D4** | corriger les défauts 1 à 5 en E7, ou les laisser | **corriger en E7**, après validation du socle |
