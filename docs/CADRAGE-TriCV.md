# [[TriCV]] — Document de cadrage

**Version** 1.0 — 13 septembre 2026
**Auteur** Nathan
**Statut** Cadrage validé, prêt pour réalisation

---

## 1. Objet

**TriCV** est un outil web public et gratuit permettant à tout professionnel RH de classer un lot de CV selon des critères qu'il définit lui-même, puis d'exporter un récapitulatif Excel.

Principe fondateur : **aucune donnée n'est conservée.** Les CV sont analysés en mémoire vive et disparaissent à la fin de la session. Pas de compte, pas de base de données, pas d'historique.

### Positionnement par rapport à RecrutPro

TriCV n'est **pas** RecrutPro déployé. Ce sont deux produits distincts qui partagent un moteur d'analyse.

| | RecrutPro | TriCV |
|---|---|---|
| Usage | Interne, Nathan | Public, communautaire |
| Persistance | SQLite + fichiers | Aucune |
| Portée | Suivi complet (projets, kanban, notes) | Triage one-shot |
| Authentification | Aucune (local) | Aucune (rien à protéger) |
| Hébergement | Local, port 5001 | Streamlit Community Cloud |

RecrutPro conserve le pipeline, le kanban et les notes. TriCV ne fait qu'une chose : classer un lot de CV, une fois.

---

## 2. Décisions actées

| Sujet | Décision |
|---|---|
| Nom du produit | **TriCV** |
| Formats acceptés | PDF et Word (.docx) |
| CV non lisibles (scannés) | Signalés à part, **sans score**, hors classement. Pas d'OCR en V1. |
| Moteur de scoring | Fiabilisé (frontières de mots, accents, poids normalisés) + synonymes + critères d'exclusion |
| Langue de l'interface | Français uniquement |
| Hébergement cible | Streamlit Community Cloud |

---

## 3. Parcours utilisateur

Une page unique, quatre étapes visibles simultanément. Objectif : un résultat en moins de 5 minutes, sans tutoriel.

### Étape 1 — Décrire le poste

L'utilisateur choisit un **modèle pré-rempli** dans une liste déroulante, ou part de zéro.

Chaque critère comporte :
- un **nom** (ex. « Langages & frameworks ») ;
- des **mots-clés**, un par ligne, avec synonymes optionnels après un signe = ;
- un **poids** (nombre entier).

Syntaxe des mots-clés :

```
python
paie = salaire, payroll, rémunération
sql = postgresql, mysql, base de données
```

Une ligne = un groupe de recherche. Le groupe est considéré trouvé si **au moins un** de ses termes apparaît dans le CV. C'est ce qui règle le problème des candidats qui formulent autrement.

Un indicateur affiche en direct : « Poids attribués : 85 / 100 — il reste 15 points ». Cela règle le défaut de pondération à la saisie plutôt que dans le calcul.

L'utilisateur peut ajouter des **critères d'exclusion** : des termes dont la présence déclenche un signalement visible (ex. « intérim », « stage uniquement »). Un signalement **n'élimine jamais** un candidat du classement.

### Étape 2 — Déposer les CV

Zone de dépôt multiple. Limites affichées **avant** le dépôt :
- 40 fichiers maximum par session ;
- 5 Mo maximum par fichier ;
- formats `.pdf` et `.docx`.

### Étape 3 — Lire le classement

Un tableau trié par score décroissant : rang, nom, email, téléphone, score sur 100, signalements éventuels.

Sous chaque candidat, un volet dépliable donne **le détail par critère** :

> Langages & frameworks — 21 / 35 pts
> Trouvés : python, django, git
> Absents : react, docker

Cette transparence n'est pas décorative : elle est ce qui distingue un assistant de lecture d'un filtre automatique, et elle est la condition pour qu'un RH fasse confiance au résultat.

Une section distincte, **« À examiner manuellement »**, regroupe les CV dont le texte n'a pas pu être extrait (documents scannés). Ils n'ont pas de score et ne sont pas classés.

### Étape 4 — Exporter et effacer

- **Télécharger le récapitulatif Excel** (mêmes feuilles et mêmes couleurs que l'export RecrutPro actuel).
- **Effacer la session** : vide immédiatement l'état et revient à l'écran initial.

---

## 4. Garde-fous méthodologiques

Le risque principal de TriCV n'est pas technique, il est méthodologique : **le matching par mots-clés défavorise les candidats qui formulent autrement.** Les synonymes atténuent le problème sans le supprimer.

Règles non négociables dans l'interface :

1. **Aucun verdict binaire.** Jamais de « retenu / rejeté ». Un rang et un détail, rien de plus.
2. **Aucun candidat masqué.** Les scores faibles apparaissent en bas du tableau, jamais repliés ni filtrés par défaut.
3. **Avertissement permanent** au-dessus du classement :
   > Un score faible signifie que les mots-clés recherchés sont absents du CV, pas que le candidat est moins qualifié.
4. **Aucune exclusion automatique.** Les critères d'exclusion produisent un signalement visible, jamais un retrait.

---

## 5. Garanties de confidentialité — règles de code

Ces cinq règles sont ce qui rend la promesse vraie *par construction*. Toute entorse invalide le produit.

| # | Règle | Justification |
|---|---|---|
| 1 | **Jamais d'écriture disque.** `st.file_uploader` rend un objet mémoire ; `pdfplumber` et `python-docx` acceptent un objet fichier. Aucun `.save()`, aucun `open(..., 'w')`, aucun dossier `uploads/`. | Il n'y a rien à supprimer parce que rien n'a jamais été écrit. |
| 2 | **Jamais de `@st.cache_data` ni `@st.cache_resource` sur du contenu de CV.** Le cache Streamlit est partagé entre toutes les sessions et leur survit. | Un cache sur les CV recréerait exactement la base de données qu'on veut éviter. |
| 3 | **Ne conserver en session que le résultat.** Le texte brut est libéré dès le score calculé. On garde nom, email, téléphone, score, détail par critère. | Moins de données en mémoire = promesse plus tenable et moins de pression RAM. |
| 4 | **Aucun appel réseau sortant.** Pas d'API d'IA, pas d'analytics, pas de télémétrie. | Un envoi à un tiers ruinerait l'argument principal du produit. |
| 5 | **Aucun log applicatif contenant des données candidat.** Pas de `print()` de texte extrait, pas de nom dans les messages d'erreur. | Les logs de la plateforme sont persistants. |

### Texte de la mention publique

> **Traitement éphémère — aucune conservation**
>
> Les CV déposés sont analysés en mémoire vive. Ils ne sont jamais enregistrés sur un disque, ni transmis à un tiers, ni utilisés pour entraîner un modèle. Aucun compte, aucune base de données, aucun historique.
>
> Vos données disparaissent à la fin de votre session, ou immédiatement si vous cliquez sur « Effacer la session ».
>
> L'application est hébergée sur Streamlit Community Cloud, dont les serveurs sont situés aux États-Unis : les fichiers y transitent le temps de l'analyse.
>
> Le score est une aide à la lecture, pas une décision : il classe, il n'élimine pas.

Les deux derniers paragraphes sont ceux qu'on est tenté de retirer. Ils doivent rester : la transparence sur l'hébergement couvre l'obligation d'information (loi ivoirienne n° 2013-450 ; RGPD si un candidat est européen), et le dernier cadre l'usage.

---

## 6. Architecture technique

```
tricv/
├── app.py                  # ~200 lignes — page Streamlit unique
├── core/
│   ├── normalisation.py    # mise à plat du texte (accents, casse, ponctuation)
│   ├── parser.py           # extraction PDF + DOCX depuis un objet mémoire
│   ├── scorer.py           # moteur de scoring — fonctions pures
│   ├── modeles.py          # les 5 modèles de critères pré-remplis
│   └── export.py           # génération du classeur Excel
├── requirements.txt
└── README.md
```

Aucun équivalent de `core/database.py` : il n'y a pas de base.

### Réutilisation depuis RecrutPro

| Fichier RecrutPro | Devenir |
|---|---|
| `core/parser.py` | Repris, adapté pour lire un objet mémoire et gérer le .docx |
| `core/scorer.py` | Repris, **transformé en fonction pure** (les critères arrivent en argument, plus de requête SQL interne) |
| Bloc `export_rapport` de `app.py` | Extrait dans `core/export.py`, alimenté par une liste de dictionnaires |
| `core/database.py` | Supprimé |
| `templates/` | Supprimé |
| Routes Flask | Supprimées |

Le passage du scorer à une fonction pure n'est pas qu'une contrainte : c'est un meilleur découpage. La version RecrutPro cache une requête SQL au milieu d'une fonction de calcul, ce qui la rend intestable et non réutilisable.

### Dépendances

```
streamlit
pdfplumber
python-docx
openpyxl
```

Rien d'autre. Pas de base de données, pas de client HTTP, pas de framework d'authentification.

---

## 7. Spécification du moteur de scoring

### 7.1 Normalisation du texte

Appliquée au texte du CV **et** à chaque terme recherché, pour que la comparaison soit symétrique :

1. passage en minuscules ;
2. suppression des accents (décomposition Unicode NFD, retrait des marques combinantes) ;
3. remplacement de toute ponctuation par une espace ;
4. réduction des espaces multiples.

Ainsi « Développeur, Python. » et « developpeur python » deviennent comparables.

### 7.2 Structure d'un critère

```
{
  "nom": "Langages & frameworks",
  "poids": 35,
  "type": "requis",          # ou "exclusion"
  "groupes": [
      ["python"],
      ["sql", "postgresql", "mysql", "base de donnees"],
      ["git", "github"]
  ]
}
```

Chaque **groupe** correspond à une ligne saisie par l'utilisateur. Le premier terme est le terme principal, les suivants ses synonymes.

### 7.3 Règle de présence

Un terme est présent si la recherche du motif `\bterme\b` aboutit dans le texte normalisé.

**C'est la correction du bug principal de RecrutPro.** La version actuelle utilise `terme in texte` : un mot-clé « R » (le langage) apparaît alors dans *tous* les CV, et « go » apparaît dans « algorithme », « Congo » ou « Angola ». Les frontières de mots (`\b`) suppriment ces faux positifs.

Un **groupe** est trouvé si au moins un de ses termes est présent.

### 7.4 Calcul

Pour chaque critère de type `requis` :

```
ratio  = nombre de groupes trouvés / nombre total de groupes
points = ratio × poids
```

Score final :

```
total_poids = somme des poids des critères requis
score       = arrondi(somme des points / total_poids × 100)
```

La normalisation par `total_poids` garantit un score sur 100 **quelle que soit** la somme saisie par l'utilisateur. Elle remplace le `min(score, 100)` de RecrutPro, qui écrasait les scores et faisait perdre son sens au classement dès que la somme des poids dépassait 100.

Pour chaque critère de type `exclusion` : si un groupe est trouvé, le candidat reçoit un signalement portant le nom du critère. Aucun effet sur le score, aucun retrait du classement.

### 7.5 Détection des CV non lisibles

Si le texte extrait fait **moins de 100 caractères** après normalisation, le document est marqué `illisible`. Il ne reçoit pas de score et rejoint la section « À examiner manuellement ».

### 7.6 Sortie par candidat

```
{
  "nom": "...", "email": "...", "telephone": "...",
  "fichier": "CV_Kouassi.pdf",
  "lisible": true,
  "score": 72,
  "signalements": ["Intérim"],
  "detail": [
    {"critere": "Langages & frameworks", "points": 21, "poids": 35,
     "trouves": ["python", "git"], "absents": ["sql"]}
  ]
}
```

### 7.7 Extraction des informations candidat

Reprise de la logique RecrutPro (email par expression régulière, téléphone aux formats ivoiriens `+225` / `0[57]`, nom par heuristique sur les 5 premières lignes), avec un ajout :

**Repli sur le nom du fichier.** Si l'heuristique échoue, on dérive le nom depuis le nom du fichier (`CV_Kouassi_Jean.pdf` → « Kouassi Jean ») : en pratique les CV sont très souvent nommés ainsi, et c'est plus fiable que « Nom inconnu ».

### 7.8 Extraction Word

`python-docx` doit lire **les paragraphes et les tableaux**. Beaucoup de CV Word sont entièrement construits dans des tableaux ; ne lire que `document.paragraphs` renverrait un texte quasi vide et classerait ces CV comme illisibles.

---

## 8. Modèles de critères pré-remplis

Un formulaire vide fait fuir l'utilisateur. Cinq modèles couvrent l'essentiel du marché visé.

### Développeur web — poids total 100

| Critère | Groupes de mots-clés | Poids |
|---|---|---|
| Langages & frameworks | `python` / `javascript = js` / `django = flask` / `react = vue, angular` | 35 |
| Bases de données | `sql` / `postgresql = postgres` / `mysql` / `mongodb = nosql` | 20 |
| Outils & versioning | `git = github, gitlab` / `docker` / `linux` | 15 |
| Expérience terrain | `developpeur = developer, ingenieur logiciel` / `freelance` / `stage` | 20 |
| Formation | `licence = bachelor` / `master` / `informatique` | 10 |

### Comptable

| Critère | Groupes de mots-clés | Poids |
|---|---|---|
| Comptabilité générale | `comptabilite generale` / `grand livre` / `rapprochement bancaire` / `syscohada = ohada` | 35 |
| Fiscalité & déclarations | `fiscalite = impots` / `tva` / `declaration fiscale` / `cnps` | 25 |
| Outils | `sage` / `excel` / `erp` / `quickbooks` | 20 |
| Expérience | `comptable` / `aide comptable` / `cabinet` | 20 |

### Commercial / Chargé de clientèle

| Critère | Groupes de mots-clés | Poids |
|---|---|---|
| Développement commercial | `prospection` / `negociation` / `portefeuille client` / `chiffre d affaires` | 35 |
| Relation client | `relation client = service client` / `fidelisation` / `reclamation` | 25 |
| Outils | `crm` / `salesforce` / `excel` / `reporting` | 15 |
| Expérience | `commercial` / `chargé de clientele` / `terrain` | 25 |

### Assistant administratif / RH

| Critère | Groupes de mots-clés | Poids |
|---|---|---|
| Administration | `gestion administrative` / `courrier` / `archivage` / `agenda = planning` | 30 |
| Ressources humaines | `recrutement` / `paie = salaire, payroll` / `contrat de travail` / `dossier du personnel` | 30 |
| Bureautique | `word` / `excel` / `powerpoint` / `outlook` | 20 |
| Qualités & langues | `anglais` / `redaction` / `organisation` | 20 |

### Logistique / Supply chain

| Critère | Groupes de mots-clés | Poids |
|---|---|---|
| Gestion des flux | `approvisionnement` / `stock = inventaire` / `transit` / `douane` | 35 |
| Transport | `transport` / `fret` / `import = export` / `incoterms` | 25 |
| Outils | `erp` / `sap` / `excel` / `wms` | 20 |
| Expérience | `logistique` / `supply chain` / `magasinier` | 20 |

Les mots-clés sont écrits sans accents : la normalisation les traitera correctement dans les deux sens.

---

## 9. Limites connues et assumées

| Limite | Impact | Position retenue |
|---|---|---|
| **1 Go de RAM partagé** entre toutes les sessions simultanées | 4 utilisateurs traitant 40 CV chacun peuvent faire redémarrer l'app, et tout le monde perd sa session | Plafond de 40 fichiers et 5 Mo par fichier ; libération du texte brut dès le score calculé. Si l'usage croît, comparer Hugging Face Spaces. |
| **Mise en veille** après inactivité prolongée | Premier accès lent (quelques dizaines de secondes) | Accepté pour un outil gratuit. |
| **Suppression non instantanée** | La session est détruite peu après la déconnexion, pas à la seconde | Ne jamais écrire « suppression instantanée » dans l'interface. Le bouton « Effacer la session » donne le contrôle explicite. |
| **Hébergement aux États-Unis**, non configurable | Transit de données personnelles hors zone | Mentionné explicitement dans la notice de confidentialité. |
| **Pas d'OCR** | Les CV scannés ne sont pas analysés | Signalés à part, sans score. Réévaluable en V2. |
| **Matching lexical** | Un profil qui formule autrement est sous-évalué | Atténué par les synonymes, assumé par les garde-fous de la section 4. |

---

## 10. Hors périmètre V1

À ne pas construire maintenant, pour garder l'outil simple et livrable :

- comptes utilisateurs et sauvegarde de modèles personnalisés ;
- OCR des CV scannés ;
- détection du nombre d'années d'expérience ;
- comparaison de deux candidats côte à côte ;
- interface en anglais ;
- envoi d'emails aux candidats ;
- toute forme d'analyse par IA générative (incompatible avec la garantie de confidentialité).

---

## 11. Plan de réalisation

| Lot | Contenu | Dépend de |
|---|---|---|
| **1** | `core/normalisation.py` + `core/scorer.py` — moteur pur, vérifiable sans interface | — |
| **2** | `core/parser.py` — extraction PDF et DOCX depuis un objet mémoire, détection des illisibles | — |
| **3** | `core/modeles.py` — les 5 modèles de critères | Lot 1 |
| **4** | `app.py` — interface Streamlit, les 4 étapes, garde-fous de la section 4 | Lots 1-3 |
| **5** | `core/export.py` — classeur Excel | Lot 1 |
| **6** | Notice de confidentialité, README, déploiement | Tous |

Les lots 1 et 2 sont indépendants et constituent le cœur de valeur : ils peuvent être testés en ligne de commande avant toute interface.

Charge estimée : 1 à 2 jours de travail effectif.

---

## 12. Critères de recette

Avant déploiement public, vérifier :

- [ ] un mot-clé d'une lettre (`R`, `C`) ne matche pas à l'intérieur d'un autre mot ;
- [ ] « développeur » dans le CV est trouvé par le mot-clé « developpeur » et réciproquement ;
- [ ] la somme des poids saisis, quelle qu'elle soit, produit un score sur 100 cohérent ;
- [ ] un CV scanné apparaît dans « À examiner manuellement » et non en dernière position du classement ;
- [ ] un CV Word construit en tableaux est correctement extrait ;
- [ ] un critère d'exclusion déclenché ne retire pas le candidat du classement ;
- [ ] `grep -rn "\.save(\|open(.*'w'\|cache_data\|cache_resource" .` ne remonte rien sur du contenu de CV ;
- [ ] l'export Excel se télécharge sans qu'aucun fichier n'apparaisse sur le disque du serveur ;
- [ ] « Effacer la session » ramène bien à l'écran initial, sans résidu ;
- [ ] la notice de confidentialité est visible sans avoir à faire défiler la page.
