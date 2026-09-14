# TriCV — Correspondance maquette / Streamlit

**Source** « TriCV — 5 planches » (canvas Claude Design), export HTML du 14/09/2026
**Cible** `.streamlit/config.toml` et les composants Streamlit standards
**Version de Streamlit** 1.63.0

---

## 0. Principe

La maquette est une page HTML ; la cible est une application Streamlit. **Le
HTML et le CSS de la maquette ne sont pas repris.** Streamlit génère son propre
DOM : les feuilles du design system (`_ds_bundle.js`, `styles.css`,
`css/*.css`) ne s'y appliqueraient pas proprement et créeraient une dette
immédiate à chaque montée de version.

Ce qui est repris :

1. **les jetons** (`tokens/*.css`) → traduits en options de thème Streamlit ;
2. **les libellés français**, caractère pour caractère — ils sont validés ;
3. **la hiérarchie, l'ordre des sections et les états couverts** → traduits en
   composants Streamlit standards.

Ce qui n'est pas réalisable par le thème est listé en §4 comme écart assumé.
Aucun `st.markdown(unsafe_allow_html=True)` n'est employé pour recréer un
composant que Streamlit fournit déjà.

---

## 1. Quelle palette, et pourquoi

L'export contient **deux palettes concurrentes** :

| Palette | Où elle est définie | Ce qu'elle vaut |
|---|---|---|
| Teal `#0E7A63` | feuille de style propre aux planches TriCV | Neutres alignés sur ceux de Streamlit (`#F0F2F6`, `#31333F`), variante sombre complète |
| Indigo `#4F46E5` | `_ds/kit-rapprochement…/tokens/colors.css` | Palette du kit importé |

Le kit étant importé **après** la feuille des planches, son `:root` recouvre
celui des planches. Vérification faite dans un navigateur :
`getComputedStyle(document.documentElement).getPropertyValue('--accent')`
retourne `#4F46E5`. **Les planches s'affichent donc en indigo, et la palette
teal ne s'applique jamais.** La planche « Livrable » de la maquette déclare
elle-même `primaryColor = "#4F46E5"`, ce qui est cohérent avec le rendu.

**Décision (14/09/2026) : on retient l'indigo**, c'est-à-dire ce qui s'affiche
réellement et ce que la maquette déclare comme livrable.

> À savoir pour plus tard : l'indigo est la couleur du kit
> « rapprochement », pas une identité propre à TriCV, et cette palette n'a pas
> de variante sombre. Si tu veux un jour donner à TriCV sa couleur propre, la
> palette teal est déjà écrite dans la maquette et il suffira de la remonter
> dans `config.toml`.

---

## 2. Jetons → `config.toml`

### 2.1 Couleurs

| Jeton de la maquette | Valeur | Option Streamlit | Ce que ça peint |
|---|---|---|---|
| `--accent` | `#4F46E5` | `primaryColor` | boutons principaux, barre de progression, état actif |
| `--accent` | `#4F46E5` | `linkColor` | liens |
| `--bg` | `#FFFFFF` | `backgroundColor` | fond de page |
| `--surface` | `#F1F5F9` | `secondaryBackgroundColor` | zones en retrait, champs, zone de dépôt |
| `--text` | `#1E293B` | `textColor` | texte courant |
| `--border` | `#E2E8F0` | `borderColor` | filets et contours |
| `--text-muted` | `#64748B` | `grayColor`, `grayTextColor` | légendes et textes secondaires |
| `--surface-2` | `#F8FAFC` | `dataframeHeaderBackgroundColor` | en-tête du tableau de classement |
| `--surface-2` | `#F8FAFC` | `codeBackgroundColor` | blocs de code |
| `--border` | `#E2E8F0` | `dataframeBorderColor` | filets du tableau |

### 2.2 Couleurs sémantiques

Ces quatre familles alimentent `st.info`, `st.success`, `st.warning` et
`st.error`. Les renseigner évite de fabriquer des encarts colorés à la main :
l'avertissement méthodologique du §4 du cadrage et le message « Session
effacée » deviennent des composants standards.

| Jetons | Options Streamlit | Composant concerné |
|---|---|---|
| `--info` `#3730A3` / `--info-bg` `#EEF2FF` | `blueColor`, `blueBackgroundColor`, `blueTextColor` | `st.info` |
| `--success` `#15803D` / `--success-bg` `#F0FDF4` | `greenColor`, `greenBackgroundColor`, `greenTextColor` | `st.success` |
| `--warning` `#B45309` / `--warning-bg` `#FFFBEB` | `yellowColor`, `yellowBackgroundColor`, `yellowTextColor` | `st.warning` |
| `--danger` `#B91C1C` / `--danger-bg` `#FEF2F2` | `redColor`, `redBackgroundColor`, `redTextColor` | `st.error` |

Les jetons `--*-border` de la maquette n'ont pas d'équivalent : Streamlit
dérive la bordure de l'alerte de sa couleur de fond. Écart invisible.

### 2.3 Typographie

| Jeton | Valeur | Option Streamlit |
|---|---|---|
| `--font-sans` | `"IBM Plex Sans", -apple-system, …` | `font` |
| `--font-display` | `"Fraunces", Georgia, …` | `headingFont` |
| `--font-mono` | `"IBM Plex Mono", ui-monospace, …` | `codeFont` |
| `--text-base` | `16px` | `baseFontSize = 16` |
| `--text-3xl` … `--text-sm` | `36 / 28 / 22 / 18 / 16 / 14 px` | `headingFontSizes` (h1→h6, en rem) |

**Les polices ne sont pas téléchargées depuis un serveur tiers.** Streamlit
1.63 sait charger IBM Plex Sans et Fraunces via `[[theme.fontFaces]]`, mais
chaque visiteur émettrait alors une requête vers Google, qui verrait son
adresse IP — incompatible avec la règle n°4 du §5 du cadrage, et coûteux pour
l'argument central du produit au profit d'un gain purement esthétique.

Chaque pile se termine par une famille générique (`sans-serif`, `serif`,
`monospace`), donc la **hiérarchie** de la maquette (corps sans empattement,
titres à empattement, chiffres en chasse fixe) est conservée même quand les
polices ne sont pas installées. Voir l'écart E2.

### 2.4 Formes

| Jeton | Valeur | Option Streamlit |
|---|---|---|
| `--r-md` | `8px` | `baseRadius = "0.5rem"`, `buttonRadius = "0.5rem"` |
| `--r-lg` | `10px` | *(pas d'équivalent — voir E3)* |
| `--r-full` | `999px` | rendu nativement par `st.badge` |

Les champs de la maquette sont encadrés : `showWidgetBorder = true`.

### 2.5 Hors thème

| Réglage | Valeur | Motif |
|---|---|---|
| `server.maxUploadSize` | `5` | §3 du cadrage — **la maquette dit 10 Mo, voir la contradiction C1** |
| `browser.gatherUsageStats` | `false` | règle n°4 du §5 : aucune télémétrie |

L'échelle d'espacement `--sp-1` à `--sp-8` (4 → 64px) **n'a aucun équivalent**
dans le thème Streamlit, qui impose son propre rythme vertical. Voir E4.

---

## 3. Écrans → composants Streamlit

### Planche 1 — Écran d'accueil, état initial

| Élément de la maquette | Composant Streamlit |
|---|---|
| Surtitre « OUTIL INTERNE RH » | `st.caption` (voir E5) |
| Titre « TriCV » | `st.title` |
| Accroche « Déposez un lot de CV… » | `st.write` |
| Encart « Aucune donnée conservée. » | `st.info` |
| Fil « 1. Critères → 2. Dépôt → 3. Analyse → 4. Classement » | `st.caption` |
| « Étape 1 — Critères de sélection » | `st.subheader` |
| « Modèle de poste » + liste | `st.selectbox` |
| Aide « Le modèle propose des critères… » | `help=` du `selectbox` |
| « Charger le modèle » | `st.button(type="primary")` |
| « Partir d'une page blanche » | `st.button(type="secondary")` |
| « Étape 2 — Dépôt des CV » | `st.subheader` |
| Zone de dépôt | `st.file_uploader(accept_multiple_files=True, type=["pdf", "docx"])` |
| « Définissez au moins un critère… » | `st.caption` + `disabled=True` sur le bouton |
| « Lancer l'analyse » | `st.button(disabled=True)` |

### Planche 2 — Critères configurés, 12 CV déposés

| Élément | Composant |
|---|---|
| « Poids attribués 100 / 100 » | `st.metric` |
| Carte d'un critère | `st.container(border=True)` |
| Nom du critère | `st.text_input` |
| « Mots-clés recherchés » | `st.text_area` (voir la contradiction C3) |
| « Poids du critère » / « 35 pts » | `st.number_input` |
| « + Ajouter un critère » | `st.button` |
| « Critères d'exclusion · 2 règles · signalement seulement » | `st.expander` |
| « 12 fichiers déposés · 8,4 Mo au total » | `st.caption` |
| Liste des fichiers déposés | rendue nativement par `st.file_uploader` |
| « Lancer l'analyse des 12 CV » | `st.button(type="primary")` |

### Planche 3 — Analyse en cours

| Élément | Composant |
|---|---|
| « Analyse en cours — 7 CV sur 12 » + « 58 % » | `st.progress(valeur, text=…)` |
| « Extraction du texte · cv_amani_serge.pdf » | texte du `st.progress`, ou `st.status` |
| « Ne fermez pas cet onglet… » | `st.warning` |
| Rappel replié de l'étape 1 | `st.expander(expanded=False)` |

### Planche 4 — Résultats et détail du calcul

| Élément | Composant |
|---|---|
| « Étape 4 — Classement » | `st.subheader` |
| Avertissement méthodologique (§4 du cadrage) | `st.warning`, **jamais replié** |
| 4 compteurs (CV reçus / Analysés / À examiner / Signalements) | `st.columns(4)` + `st.metric` |
| Tableau de classement | `st.dataframe` + `st.column_config` |
| Teintes de score (vert > 70, ambre 40-70, rouge < 40) | `pandas.Styler.map` passé à `st.dataframe` — pas de HTML (voir E1) |
| « Détail du score — Ibrahim Traoré » | `st.expander`, un par candidat |
| « Langages & frameworks — 21 / 35 pts » | `st.progress` + `st.caption` |
| « TROUVÉS … / ABSENTS … » | `st.badge`, ou `st.caption` |
| « Un mot-clé absent signifie seulement… » | `st.caption` |
| « Télécharger le récapitulatif (.xlsx) » | `st.download_button(type="primary")` |
| « Effacer la session » | `st.button` |

### Planche 5 — Cas particuliers

| Élément | Composant |
|---|---|
| « À examiner manuellement » | `st.subheader` |
| « 2 CV n'ont pas pu être analysés… » | `st.info` |
| Tableau Fichier / Taille / Raison / Score | `st.dataframe` |
| Détail d'un signalement d'exclusion | `st.expander` + `st.warning` |
| « Extrait du CV : « … » » | **bloqué — voir la contradiction C4** |
| Erreurs au dépôt (taille, format) | `st.error`, une par fichier refusé |
| « Effacer la session — Confirmation demandée » | `st.dialog` |
| « Oui, effacer la session » / « Annuler » | `st.button` dans le `st.dialog` |
| « Session effacée. Les 12 CV… » | `st.success` |
| « Commencer un nouveau tri » | `st.button` |

Aucun écran ne demande de mise en page libre : la maquette se limite
explicitement au vocabulaire Streamlit (« une colonne centrale unique, des
composants standards, aucune mise en page libre »). **Aucun recours au HTML
n'est nécessaire.**

---

## 4. Écarts assumés

| # | Écart | Portée | Position retenue |
|---|---|---|---|
| **E1** | Les trois teintes de score ne sont pas des jetons du thème | Planche 4 | Appliquées via un `Styler` pandas, comme la maquette le prévoit elle-même. Pas de HTML. Voir E9. |
| **E2** | IBM Plex Sans et Fraunces ne sont pas chargées | Toutes | Pile de repli locale, aucune requête sortante. Un visiteur sans ces polices voit sa police système ; la hiérarchie est conservée. Décision du 14/09/2026. |
| **E3** | `--r-lg` (10px) sur les cartes et tableaux | Planches 2, 4, 5 | Streamlit n'a qu'un rayon de base. Tout est à 8px. Écart de 2px, invisible. |
| **E4** | L'échelle d'espacement `--sp-1…8` n'est pas exposée | Toutes | Le rythme vertical reste celui de Streamlit. Non contournable sans CSS. |
| **E5** | Surtitres en chasse fixe et petites capitales | Planches 1, 4 | `st.caption` rend dans la police du corps. La fonction est conservée, pas la forme. |
| **E6** | Pas de variante sombre pour la palette indigo | Toutes | Streamlit dérivera un thème sombre. La palette teal en fournissait une ; elle n'est pas retenue. |
| **E7** | Bordures d'alerte (`--*-border`) | Planches 1, 3, 5 | Streamlit dérive la bordure du fond de l'alerte. Écart invisible. |
| **E8** | **Libellés internes de Streamlit en anglais** | Planches 1, 2, 5 | **Non résolu — voir ci-dessous.** |
| **E9** | `pandas` ajouté à `requirements.txt` | Planche 4 | `app.py` l'importe directement pour le `Styler` des teintes de score. Ce n'est pas une dépendance de plus au déploiement : streamlit l'installe déjà. Le déclarer évite de dépendre en silence d'un paquet tiers. |

### E8 — Les libellés que Streamlit écrit lui-même

La décision D8 de PROCESS impose une interface **en français uniquement**.
Tous les textes que TriCV écrit le sont. Mais certains composants Streamlit
incrustent leurs propres libellés, non traduisibles et non configurables :

| Où | Ce qui s'affiche |
|---|---|
| `st.file_uploader` | « Upload », « Drag and drop files here », « Browse files », « 5MB per file » |
| `st.text_area` | « Press Ctrl+Enter to apply » |
| `st.dataframe` | l'infobulle de recherche et de téléchargement |

Streamlit 1.63 n'offre aucun mécanisme d'internationalisation. Les seules
façons de les remplacer passent par l'injection de CSS ou de JavaScript dans
le DOM de Streamlit — exactement ce que la consigne interdit, et une dette
qui casserait à la première montée de version, silencieusement.

Trois issues possibles, à trancher :

1. **Assumer l'écart.** Le reste de l'interface est en français ; ces
   fragments sont ceux d'un composant technique. C'est le choix par défaut
   tant qu'aucune décision n'est prise.
2. **Compenser par les libellés voisins.** Déjà fait en partie : la légende
   française « 40 fichiers maximum · 5 Mo par fichier · PDF, DOCX » est
   affichée juste sous la zone de dépôt, en doublon du texte anglais.
3. **Injecter du CSS.** Écarté, sauf demande explicite.

Le menu « Deploy » et les options de développement, eux, sont supprimés
proprement par `client.toolbarMode = "minimal"` dans `config.toml`.

---

## 5. Contradictions entre la maquette et le cadrage

Les cinq points relevés au lot design. **Quatre sont tranchés.**

| # | Sujet | Décision |
|---|---|---|
| **C1** | Taille par fichier — maquette 10 Mo, cadrage 5 Mo | **Cadrage.** `server.maxUploadSize = 5`. Streamlit affiche « 5MB per file », et `app.py` double la mention en français. Le libellé « 10 Mo » de la maquette est caduc. |
| **C2** | 4 modèles (maquette) ou 5 (cadrage) | **Cadrage — 5 modèles**, en gardant les intitulés courts de la maquette et en ajoutant « Logistique ». |
| **C3** | Syntaxe des mots-clés | **Règle mixte.** Le signe `=` est la seule chose qui crée un groupe de synonymes ; virgules et retours à la ligne séparent des mots-clés indépendants. La liste plate de la maquette fonctionne telle quelle, sans renoncer aux synonymes du cadrage. Implémentée dans `core/criteres.py`. |
| **C4** | « Extrait du CV » sous un signalement | **Supprimé.** On affiche « Règle d'exclusion déclenchée : « recherche un stage » ». Ce mot-clé vient de la saisie de l'utilisateur, pas du document : rien du CV n'est conservé, et la règle n°3 du §5 reste intacte. `signalements` porte désormais le terme déclencheur (écart documenté avec le §7.6). |
| **C5** | La planche « Livrable » déclare 4 options | Informatif. `config.toml` va plus loin ; les 4 options qu'elle déclare sont reprises à l'identique. |

---

## 6. Journal

| Date | Décision | Motif |
|---|---|---|
| 14/09/2026 | Palette indigo `#4F46E5` retenue | C'est ce que les planches affichent réellement et ce que leur planche « Livrable » déclare. La palette teal est recouverte par le kit importé et ne s'applique jamais. |
| 14/09/2026 | Aucune police chargée depuis un tiers | La fidélité typographique ne vaut pas l'affaiblissement de la règle n°4 du §5 du cadrage. |
| 14/09/2026 | Le CSS du design system n'est pas porté | Streamlit génère son propre DOM ; ces feuilles créeraient une dette immédiate. |
| 14/09/2026 | C2 tranchée : 5 modèles | Le cadrage fait autorité et le modèle logistique est déjà rédigé. |
| 14/09/2026 | C3 tranchée : le `=` crée le groupe | Concilie la liste plate de la maquette et les groupes du cadrage sans rien perdre. |
| 14/09/2026 | C4 tranchée : la règle, pas l'extrait | Le mot-clé vient de la saisie, pas du CV : on reste explicite sans conserver de texte de candidat. |
| 14/09/2026 | `pandas` déclaré dans `requirements.txt` | `app.py` l'importe directement ; streamlit l'installait déjà, le déploiement ne change pas. |
| 14/09/2026 | E8 ouvert : libellés internes de Streamlit en anglais | Aucun mécanisme d'i18n en 1.63 ; les contournements passent tous par du CSS injecté, écarté par consigne. |
