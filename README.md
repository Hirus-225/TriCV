# TriCV

Outil web gratuit de tri de CV pour les professionnels RH francophones.

Un lot de CV est déposé, classé selon des critères définis par l'utilisateur,
puis exporté en classeur Excel. **Aucune donnée n'est conservée** : les CV sont
analysés en mémoire vive et disparaissent à la fin de la session. Pas de
compte, pas de base de données, pas d'historique.

## Deux applications dans ce dépôt

Depuis novembre 2026, TriCV existe en deux versions, et c'est volontaire le
temps de la bascule.

| | Où | Ce qui tourne | Les CV |
|---|---|---|---|
| **Version Streamlit** | `app.py`, `core/` | sur un serveur | montent le temps de l'analyse |
| **Version navigateur** | `web/` | dans le navigateur du visiteur | **ne partent nulle part** |

La seconde est une **transposition vérifiée** de la première : une page de
tests compare les deux moteurs sur un millier de cas, et le classement est
identique rang pour rang. Le détail du travail, les décisions et les défauts
repérés en chemin sont dans `docs/MIGRATION-JS.md`.

Le code Python n'est pas abandonné : il est la **référence** de la version
JavaScript. C'est lui qui produit les résultats attendus que la page de tests
compare.

## État d'avancement

Voir `docs/PROCESS-TriCV.md` §7.

Les lots 0 à 5 sont faits : moteur, parser, modèles de critères, export Excel
et interface Streamlit. **Les portes P1 et P2 sont franchies** — le moteur a
été éprouvé sur un corpus fictif de dix cas et sur un lot réel de dix CV, et
le parcours complet a été rejoué au navigateur sur ce même lot réel.

Reste le **déploiement** sur Streamlit Community Cloud, puis la porte P3 : les
dix points de recette cochés sur l'application en ligne, et non seulement en
local. Voir `docs/RECETTE.md`.

**La migration vers le navigateur est faite**, des neuf étapes prévues au
`docs/MIGRATION-JS.md`. Il reste la mise en ligne elle-même, qui demande le
compte GitHub, et les points de recette à cocher sur le site publié. Voir
`docs/RECETTE-WEB.md`.

## Installation

```
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Lancer l'application en local

```
./venv/bin/streamlit run app.py
```

L'application s'ouvre sur http://localhost:8501. `Ctrl+C` arrête le serveur.
Le thème est lu dans `.streamlit/config.toml`, relativement au dossier depuis
lequel la commande est lancée.

## Lancer la version navigateur en local

Aucune installation, aucune étape de construction : le site est servi tel
quel. Il faut seulement un serveur web, parce qu'un navigateur refuse les
modules JavaScript ouverts par double-clic.

```
python3 -m http.server 8000
```

À lancer **à la racine du projet**, puis ouvrir
`http://localhost:8000/web/index.html`.

## Vérification de la version navigateur

La page de tests compare la version JavaScript au moteur Python, cas par cas.
Deux commandes, dans cet ordre :

```
./venv/bin/python tests/generer_reference_js.py
```

```
python3 -m http.server 8000
```

Puis `http://localhost:8000/web/tests/tests.html`. Le bandeau du haut doit
être vert. Au 17/11/2026 : **1 007 cas, aucun écart**, dont 4 tolérés et
documentés.

La première commande rejoue le moteur Python de `core/` sur une série
d'entrées et écrit, dans `web/tests/reference/`, tout ce que la version
JavaScript doit reproduire : texte extrait de chaque CV, scores, détail par
critère, et le classeur Excel décrit cellule par cellule. À relancer après
toute modification de `core/`.

## Vérification du moteur

Fait tourner le parser et le scorer sur le corpus de test fictif et contrôle
les cent et une assertions du moteur, de l'extraction à l'export Excel :

```
./venv/bin/python tests/verifier_moteur.py
```

Il doit afficher « Toutes les vérifications passent » et se terminer sur le
code 0. **À relancer après toute modification de `core/`.**

Le corpus fictif se régénère avec `tests/generer_corpus.py`, qui a besoin de
`requirements-dev.txt`. Ces deux paquets ne servent qu'à fabriquer les
fichiers de test et ne partent pas en production.

## Déploiement — version navigateur (GitHub Pages)

En ligne : **https://charleszogoue.ci/TriCV/**

Le site est publié par `.github/workflows/pages.yml`, qui copie `web/` tel
quel : aucune étape de construction, rien entre ce qu'on écrit et ce qui est
servi.

1. **Une seule fois, et c'est fait** : Settings → Pages → Build and
   deployment → Source : **GitHub Actions**. Sans ce réglage, GitHub publie la
   racine du dépôt et sert le README à la place de l'application — le workflow
   s'exécute alors sans commander ce qui part en ligne.
2. Fusionner la branche de travail dans `main` et pousser. La publication se
   déclenche sur toute modification de `web/`, et peut aussi être lancée à la
   main par le bouton **Run workflow** de l'onglet Actions.
3. Dérouler `docs/RECETTE-WEB.md` sur l'URL obtenue.

Deux choses à savoir :

- **La page de tests n'est pas publiée.** Elle lit le corpus dans
  `tests/corpus/`, qui est à la racine du dépôt et non dans `web/` : en ligne,
  ces fichiers n'existeraient pas. C'est une page de développement.
- **Le workflow refuse de publier** si une adresse distante s'est glissée dans
  `web/js`, `web/css` ou les pages HTML. C'est un dernier filet avant la mise
  en ligne, en plus de la politique de sécurité que le navigateur applique.

## Déploiement — version Streamlit

Streamlit Community Cloud installe `requirements.txt` et lance `app.py`.

1. Pousser la branche `main` sur GitHub.
2. Sur [share.streamlit.io](https://share.streamlit.io), se connecter avec le
   compte GitHub, puis **New app**.
3. Dépôt `Hirus-225/TriCV`, branche `main`, fichier principal `app.py`.
4. Dans **Advanced settings**, choisir une version de Python proposée par
   l'hébergeur — **3.11 ou 3.12**. Le poste de développement tourne en 3.14,
   que Streamlit Cloud ne propose pas. Le code n'utilise aucune syntaxe
   postérieure à 3.9, donc cela ne change rien à son fonctionnement.
5. Déployer, puis dérouler `docs/RECETTE.md` sur l'URL obtenue.

### Ce qui doit partir avec l'application

`docs/` en fait partie : l'application y lit `MANUEL-PROCEDURE.md` pour
afficher son mode d'emploi. Un déploiement qui l'oublierait afficherait un
message d'erreur à la place du manuel.

### Limites connues de l'hébergement Streamlit

Ces limites ne concernent **que** la version Streamlit. GitHub Pages ne sert
que des fichiers : il n'a ni mémoire à saturer, ni mise en veille, et les CV
ne lui parviennent jamais.

| Limite | Conséquence |
|---|---|
| Mémoire restreinte | Un lot de 40 CV volumineux peut faire redémarrer l'application. À éprouver une fois en ligne. |
| Mise en veille après inactivité | Le premier accès prend quelques dizaines de secondes. Accepté pour un outil gratuit. |
| Serveurs aux États-Unis | Mentionné explicitement dans la notice de confidentialité, comme l'exige le §5 du cadrage. |

## Documentation

| Fichier | Contenu |
|---|---|
| `docs/CADRAGE-TriCV.md` | Le **quoi** : produit, moteur, règles de confidentialité |
| `docs/PROCESS-TriCV.md` | Le **comment** : méthode, séquence des lots, points de contrôle |
| `docs/MANUEL-PROCEDURE.md` | Le **mode d'emploi**, pour l'utilisateur RH. Affiché dans l'application |
| `docs/RECETTE.md` | Les dix points de recette de la version Streamlit |
| `docs/DESIGN-MAPPING.md` | Correspondance entre la maquette et le thème Streamlit, et les écarts assumés |
| `docs/MIGRATION-JS.md` | La **migration vers le navigateur** : inventaire, équivalents, défauts repérés, plan en neuf étapes et décisions en attente |
| `docs/RECETTE-WEB.md` | Les points de recette de la **version navigateur**, dont le point 7 réécrit : « aucune requête ne sort du site » |
| `web/manuel.md` | Le mode d'emploi de la version navigateur, dérivé de `MANUEL-PROCEDURE.md` |
| `web/vendor/LISEZMOI.md` | Les bibliothèques tierces : version, provenance, licence, et pourquoi celles-là |

## Règles non négociables

1. Aucune écriture disque du contenu d'un CV.
2. Aucun `@st.cache_data` ni `@st.cache_resource` sur du contenu de CV.
3. Aucun `print()` ni message d'erreur contenant du texte extrait.
4. `core/` n'importe jamais `streamlit`.
5. Aucun CV réel dans ce dépôt. Le `.gitignore` refuse `*.pdf` et `*.docx`
   partout sauf sous `tests/corpus/`, qui ne contient que des CV fictifs.

Détail en §5 du cadrage.
