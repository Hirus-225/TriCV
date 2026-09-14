# TriCV — Processus de travail

**Version** 1.0 — 13 septembre 2026
**Projet** TriCV
**Document complémentaire** `CADRAGE-TriCV.md`

---

## 0. Objet de ce document

Deux documents, deux rôles. Ne pas les confondre évite de réouvrir sans cesse les mêmes débats.

| Document | Répond à la question |
|---|---|
| `CADRAGE-TriCV.md` | **Quoi ?** Ce que le produit est, ce qu'il fait, comment le moteur calcule |
| `PROCESS-TriCV.md` (ce fichier) | **Comment et dans quel ordre ?** La méthode, la séquence, les points de contrôle |

Le cadrage est la spécification. Celui-ci est la feuille de route et la règle du jeu.

---

## 1. D'où vient TriCV

Le projet n'est pas né d'une page blanche. Il est le résultat d'un enchaînement qu'il faut garder en mémoire, parce qu'il explique pourquoi les décisions sont ce qu'elles sont.

**Point de départ.** RecrutPro existe : une application Flask locale de 1 840 lignes, fonctionnelle, avec base SQLite, kanban et export Excel. Question initiale : peut-on la déployer via Streamlit ?

**Premier verdict : non.** Deux blocages. Streamlit ne peut pas héberger Flask (ce sont deux serveurs web concurrents, l'un ne tourne pas dans l'autre). Et surtout, le système de fichiers de Streamlit Community Cloud est éphémère : la base SQLite et le dossier `uploads/` seraient effacés à chaque redémarrage. Coût estimé pour contourner : 3 à 5 jours et deux services externes (PostgreSQL managé, stockage objet), plus une authentification.

**Le retournement.** L'intention réelle était différente : un outil communautaire gratuit, où le RH utilise, obtient son classement, télécharge son Excel, et où **rien n'est conservé**.

Ce qui était le blocage principal devient la fonctionnalité. Plus de base, plus de fichiers, plus de comptes, plus de secrets. Le coût tombe à 1 à 2 jours et zéro dépendance externe.

**Conséquence.** TriCV n'est pas RecrutPro déployé. C'est un produit distinct, dérivé du même moteur d'analyse. RecrutPro reste l'outil interne complet avec son suivi ; TriCV fait une seule chose, une seule fois.

---

## 2. Les décisions structurantes

Actées. À ne rouvrir que si un signal de la section 6 se déclenche.

| # | Décision | Raison |
|---|---|---|
| D1 | Produit séparé de RecrutPro, nommé **TriCV** | Sans persistance, le suivi (projets, kanban, notes) n'a plus de sens. Ce n'est pas une version bridée, c'est un autre usage. |
| D2 | **Streamlit**, pas Flask | Le modèle sans état de Streamlit correspond exactement à la promesse de non-conservation. Flask aurait imposé de tout reconstruire pour obtenir la même garantie. |
| D3 | **Aucune persistance**, par construction | Rien n'est écrit sur disque, donc il n'y a rien à supprimer. Une garantie structurelle vaut mieux qu'une procédure de nettoyage. |
| D4 | Formats **PDF + Word (.docx)** | Une part importante des CV arrive en Word. `python-docx` est léger. |
| D5 | CV scannés **signalés à part, sans score** | Un CV illisible scorerait 0 et serait classé dernier à tort. Pas d'OCR en V1 : trop lourd pour 1 Go de RAM. |
| D6 | Scoring **fiabilisé + synonymes + exclusions** | Les frontières de mots et les accents corrigent des bugs réels. Les synonymes sont ce qui distingue l'outil d'un Ctrl+F pondéré. |
| D7 | **Aucun appel à une IA générative** | Envoyer les CV à une API tierce ruinerait l'argument central du produit. |
| D8 | Interface en **français uniquement** | Public visé : RH francophones, Afrique de l'Ouest. |

---

## 3. La méthode de travail

### 3.1 Le principe directeur

> **Cadrer → moteur → interface → déploiement. Jamais dans l'autre sens.**

La raison est concrète. Le moteur d'analyse (normalisation, scoring, extraction) est la partie difficile, testable en ligne de commande, et réutilisable telle quelle si l'interface change un jour. L'interface Streamlit est la partie facile et la plus jetable.

Construire l'interface d'abord, c'est se retrouver à déboguer une règle de scoring à travers une page web qui se recharge à chaque clic — c'est-à-dire ajouter une couche d'incertitude à un problème qui n'en avait pas besoin.

L'analogie côté système : on ne configure pas Hyprland avant d'avoir vérifié que le serveur Wayland démarre. On valide la couche basse, puis on empile.

### 3.2 La règle des lots

Chaque lot se termine par un **critère de sortie vérifiable**. Tant qu'il n'est pas atteint, on ne passe pas au suivant.

Pas de « je finirai ça plus tard, j'avance sur la suite ». Un lot à moitié fait qui sert de fondation à trois autres est la façon la plus efficace de perdre une journée.

### 3.3 Conventions de code

Reprises de RecrutPro, pour que les deux projets restent lisibles ensemble :

- **Tout en français** : noms de fonctions, de variables, commentaires, interface. `scorer_candidat`, pas `score_candidate`.
- **Fonctions pures dans `core/`** : aucune entrée-sortie, aucun état global, aucun accès réseau. Mêmes entrées, mêmes sorties, toujours.
- **Aucun import de `streamlit` dans `core/`.** C'est la garantie que le moteur reste testable sans interface et réutilisable ailleurs — y compris dans RecrutPro.
- Un module = une responsabilité. Pas de fichier fourre-tout de 640 lignes comme l'`app.py` de RecrutPro.

### 3.4 Git

- Un dépôt **séparé** de RecrutPro.
- Un commit par lot terminé, message en français, à l'impératif : « Ajout du moteur de normalisation ».
- `.gitignore` dès le premier commit : `venv/`, `__pycache__/`, `.env`, et **tout CV de test**.

### 3.5 Mode de collaboration

- Les corrections et ajouts sont livrés en **fichiers complets** ou en blocs de remplacement clairement délimités — pas en fragments à recoller.
- Chaque bloc de code s'accompagne de l'explication du concept sous-jacent. L'objectif n'est pas d'obtenir un dépôt qui marche, c'est de pouvoir le maintenir seul dans six mois.
- Les commandes shell sont à **saisir à la main**, pas à copier-coller depuis une conversation : les guillemets typographiques s'y glissent et cassent la commande.
- Un doute sur une décision se traite avant d'écrire le code, pas après.

---

## 4. La séquence des lots

Cette section affine le §11 du cadrage : l'export Excel passe **avant** l'interface, puisque l'interface le consomme.

### Lot 0 — Initialisation du dépôt

**Contenu** : créer `~/Projets/tricv`, l'arborescence, l'environnement virtuel, `requirements.txt`, `.gitignore`, premier commit. Déplacer `CADRAGE-TriCV.md` et `PROCESS-TriCV.md` dans `tricv/docs/`.

**Dépendances** : `streamlit`, `pdfplumber`, `python-docx`, `openpyxl`. Rien d'autre.

**Critère de sortie** : `python -c "import streamlit, pdfplumber, docx, openpyxl"` ne renvoie rien.

**Charge** : 30 minutes.

---

### Lot 0 bis — Corpus de test

**Contenu** : construire le corpus synthétique décrit en 5.1.1 sous `tests/corpus/`, et réunir l'échantillon réel décrit en 5.1.2 hors du dépôt.

**Pourquoi ici** : sans jeu de test, les lots 1 et 2 ne sont pas vérifiables et la porte P1 ne peut pas être franchie. Ce lot conditionne tous les suivants.

**Critère de sortie** : les neuf cas du tableau 5.1.1 existent sous `tests/corpus/` et sont commités ; l'échantillon réel compte au moins dix CV, hors dépôt.

**Charge** : ~1 heure, plus la collecte de l'échantillon réel.

---

### Lot 1 — Moteur de normalisation et de scoring

**Contenu** : `core/normalisation.py` et `core/scorer.py`, conformes au §7 du cadrage. Fonctions pures, aucune dépendance à Streamlit.

C'est le cœur de valeur du produit. Trois corrections de fond par rapport à RecrutPro :

1. **Frontières de mots.** `mot in texte` devient une recherche de motif `\bmot\b`. Sans cela, un mot-clé « R » apparaît dans tous les CV et « go » dans « algorithme », « Congo », « Angola ».
2. **Suppression des accents** des deux côtés de la comparaison, pour que « developpeur » trouve « Développeur ».
3. **Normalisation par le total des poids.** Le `min(score, 100)` de RecrutPro écrase les scores dès que la somme des poids dépasse 100 et fait perdre sa finesse au classement. Diviser par `total_poids` donne un score sur 100 quelle que soit la saisie.

**Critère de sortie** : un petit script de vérification, exécuté en ligne de commande sur du texte écrit à la main, démontre les trois points ci-dessus. Aucune interface nécessaire.

**Charge** : ~3 heures.

---

### Lot 2 — Parser PDF et Word

**Contenu** : `core/parser.py`. Extraction depuis un **objet mémoire**, jamais depuis un chemin de fichier.

Deux pièges identifiés, à traiter dès l'écriture :

- **Les tableaux Word.** Beaucoup de CV `.docx` sont entièrement construits dans des tableaux. Ne lire que `document.paragraphs` renverrait un texte quasi vide et classerait ces CV comme illisibles à tort. Il faut parcourir paragraphes **et** tableaux.
- **Le repli sur le nom du fichier.** Si l'heuristique d'extraction du nom échoue, dériver depuis `CV_Kouassi_Jean.pdf` plutôt que d'afficher « Nom inconnu ». En pratique les candidats nomment presque toujours leur fichier ainsi.

**Critère de sortie** : sur le jeu de test réel (section 5.1), le parser extrait un texte non vide pour tous les CV lisibles, identifie correctement les illisibles, et trouve email et téléphone dans la majorité des cas.

**Charge** : ~3 heures.

---

### Lot 3 — Modèles de critères

**Contenu** : `core/modeles.py`, les cinq modèles du §8 du cadrage (développeur web, comptable, commercial, assistant administratif/RH, logistique).

**Point de vigilance** : ces modèles ont été rédigés de l'extérieur. Ils doivent être relus par un œil de recruteur exerçant sur le marché visé avant publication — en particulier le modèle comptable (SYSCOHADA, CNPS, déclarations locales).

**Critère de sortie** : chaque modèle totalise exactement 100 points et a été relu.

**Charge** : ~1 heure.

---

### Lot 4 — Export Excel

**Contenu** : `core/export.py`. Reprise du bloc `export_rapport` de RecrutPro, avec deux changements : l'alimentation se fait par une liste de dictionnaires au lieu de requêtes SQL, et le classeur est écrit dans un tampon mémoire rendu à l'appelant — jamais sur disque.

La mise en forme (trois feuilles, palette indigo/ardoise) est reprise à l'identique.

**Critère de sortie** : un classeur généré depuis des données factices s'ouvre correctement et contient les trois feuilles attendues.

**Charge** : ~2 heures.

---

### Lot 5 — Interface Streamlit

**Contenu** : `app.py`, les quatre étapes du §3 du cadrage, et les garde-fous méthodologiques du §4.

Les cinq règles de confidentialité du §5 du cadrage s'appliquent ici intégralement. La plus facile à enfreindre par réflexe d'optimisation : **ne jamais poser `@st.cache_data` sur du contenu de CV.** Le cache Streamlit est partagé entre toutes les sessions et leur survit — ce serait recréer exactement la base de données qu'on veut éviter.

**Critère de sortie** : parcours complet réalisé en local, du choix du modèle au téléchargement de l'Excel, sur le jeu de test réel.

**Charge** : ~5 heures.

---

### Lot 6 — Notice, README et déploiement

**Contenu** : notice de confidentialité (texte fixé au §5 du cadrage), `README.md`, déploiement sur Streamlit Community Cloud, vérification de la recette complète.

**Critère de sortie** : les dix points de la section 12 du cadrage sont cochés sur l'application déployée, pas seulement en local.

**Charge** : ~3 heures.

---

**Charge totale estimée : 1 à 2 jours de travail effectif.**

---

## 5. Points de contrôle

### 5.1 Le jeu de test

**Situation au 14/09/2026 : les 22 CV réels de `recrutement/uploads/` ont été supprimés.** Le dossier est vide. Seules subsistent les 22 lignes correspondantes dans `recrutement.db` (noms extraits, noms de fichiers, scores). Elles ne permettent pas de rejouer le parser, mais gardent une valeur documentaire (voir 5.1.3).

Le jeu de test se compose désormais de deux ensembles aux rôles distincts.

#### 5.1.1 Corpus de référence — synthétique, versionné

Des CV entièrement fabriqués, sans aucune donnée personnelle réelle, **commités dans le dépôt** sous `tests/corpus/`. C'est le jeu reproductible : il tourne à chaque modification du moteur et garantit qu'une correction n'en casse pas une autre.

Neuf cas au minimum :

| Cas | Ce qu'il vérifie |
|---|---|
| PDF texte standard | Le chemin nominal |
| PDF avec accents et prénoms composés | La normalisation des deux côtés de la comparaison |
| PDF scanné, image sans couche texte | La détection des illisibles |
| DOCX construit en tableaux | Le piège du lot 2 |
| DOCX en paragraphes simples | Le chemin nominal Word |
| CV rédigé en anglais | Le comportement sur une langue non prévue |
| Fichier nommé `CVBR.pdf` | Le repli sur le nom de fichier quand il échoue |
| Fichier nommé `CV_Prenom_Nom_2026.pdf` | Le repli sur le nom de fichier quand il réussit |
| CV sans email ni téléphone | Les champs manquants |

Ce corpus étant fictif, il n'y a aucune raison de l'exclure du dépôt — sa présence est ce qui rend les tests rejouables.

#### 5.1.2 Échantillon réel — local, jamais versionné

Une dizaine de CV authentiques conservés **hors du dépôt** (par exemple `~/Projets/tricv-echantillon/`), servant à vérifier avant chaque livraison que le classement reste crédible sur de vrais documents.

**Ces fichiers ne doivent jamais entrer dans le dépôt.** Le `.gitignore` du lot 0 exclut `*.pdf` et `*.docx` **sauf** sous `tests/corpus/`.

#### 5.1.3 Ce que les 22 lignes survivantes documentent

Trois défauts réels du parser de RecrutPro, à corriger au lot 2 :

- **Mojibake sur les accents.** Un nom extrait s'était retrouvé sous la forme `— Kouassi Guy-De´sire´` : accents décomposés non recomposés, tiret cadratin parasite en tête. Le parser doit appliquer une recomposition Unicode (NFC) et nettoyer la ponctuation de début de ligne.
- **Trois scores à zéro sur vingt-deux.** Sans les fichiers, impossible de trancher entre « CV scanné » et « aucun mot-clé trouvé » — précisément la confusion que la détection des illisibles doit lever.
- **Les noms de fichiers réels** valident le repli du lot 2 et en montrent la limite. `CV_Rubben_Lago_2026_RH.pdf` donne un nom exploitable ; `CVBR.pdf`, `cv de MOHAMED.pdf` et `Fatogoma_cv.DEC2025.pdf` non. Le repli doit échouer proprement plutôt que produire un nom absurde.

### 5.2 Les trois portes

| Porte | Quand | Ce qu'on vérifie |
|---|---|---|
| **P1 — Moteur** | Fin du lot 2 | Le corpus synthétique passe intégralement, et le classement reste crédible sur l'échantillon réel, en ligne de commande. Si le classement paraît absurde ici, l'interface n'y changera rien. |
| **P2 — Parcours** | Fin du lot 5 | Le parcours complet fonctionne en local, garde-fous compris. |
| **P3 — Recette** | Avant annonce publique | Les dix critères du §12 du cadrage passent sur l'application **déployée**. Notamment : aucune écriture disque, aucun cache sur les CV. |

Une porte non franchie arrête l'avancement. Elle ne se contourne pas.

---

## 6. Ce qui rouvrirait une décision

Trois signaux, et ce qu'ils impliqueraient :

| Signal observé | Décision rouverte | Piste |
|---|---|---|
| L'application redémarre régulièrement pour dépassement mémoire | D2 (hébergement) | Comparer Hugging Face Spaces, plus généreux en RAM et compatible Streamlit nativement. Abaisser le plafond de fichiers. |
| Une part importante des CV déposés arrive en « À examiner manuellement » | D5 (pas d'OCR) | Réévaluer Tesseract, en mesurant d'abord le coût mémoire réel. |
| Des retours indiquent des classements incohérents sur de vrais lots | D6 (moteur) | Enrichir les dictionnaires de synonymes avant toute complexification du calcul. |

En dehors de ces signaux, les décisions de la section 2 tiennent.

---

## 7. État d'avancement

- [x] Analyse de RecrutPro (code, base, architecture)
- [x] Étude de faisabilité Streamlit — premier verdict et retournement
- [x] Clarification de l'intention : outil communautaire sans conservation
- [x] Décisions structurantes D1 à D8
- [x] Cadrage produit rédigé (`CADRAGE-TriCV.md`)
- [x] Processus de travail rédigé (ce document)
- [ ] Relecture des modèles de critères par un œil de recruteur
- [ ] Lot 0 — initialisation du dépôt
- [ ] Lot 0 bis — corpus de test synthétique + échantillon réel
- [ ] Lot 1 — moteur de normalisation et de scoring
- [ ] Lot 2 — parser PDF et Word
- [ ] **Porte P1**
- [ ] Lot 3 — modèles de critères
- [ ] Lot 4 — export Excel
- [ ] Lot 5 — interface Streamlit
- [ ] **Porte P2**
- [ ] Lot 6 — notice, README, déploiement
- [ ] **Porte P3**

**Prochaine action** : relecture des cinq modèles de critères (§8 du cadrage), puis lots 1 et 2.

---

## 8. Journal des décisions

| Date | Décision | Motif |
|---|---|---|
| 13/09/2026 | Déploiement Streamlit de RecrutPro jugé non réalisable en l'état | Incompatibilité Flask/Streamlit ; système de fichiers éphémère incompatible avec la persistance SQLite |
| 13/09/2026 | Création d'un produit distinct, sans persistance | L'intention réelle était un outil communautaire sans conservation de données — le blocage devient la fonctionnalité |
| 13/09/2026 | Nom retenu : TriCV | Court, descriptif, immédiatement compris par un RH francophone |
| 13/09/2026 | PDF + Word, pas d'OCR en V1 | Couverture réelle des formats reçus ; OCR trop coûteux pour 1 Go de RAM |
| 13/09/2026 | Scoring avec synonymes et exclusions | Le matching lexical strict défavorise les candidats qui formulent autrement |
| 13/09/2026 | Export Excel déplacé avant l'interface dans la séquence | L'interface consomme l'export ; l'inverse créait une dépendance dans le mauvais sens |
| 14/09/2026 | Jeu de test scindé : corpus synthétique versionné + échantillon réel hors dépôt | Les 22 CV réels ont été supprimés. Un corpus fictif commité rend les tests rejouables et supprime le risque de versionner des données personnelles ; l'échantillon réel garde le contrôle de réalisme |
| 14/09/2026 | Ajout du lot 0 bis (corpus de test) avant le lot 1 | Sans jeu de test, les lots 1 et 2 ne sont pas vérifiables et la porte P1 ne peut pas être franchie |

*Toute décision ultérieure qui modifie le cadrage s'ajoute ici, avec sa date et son motif.*
