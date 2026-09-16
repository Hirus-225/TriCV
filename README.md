# TriCV

Outil web gratuit de tri de CV pour les professionnels RH francophones.

Un lot de CV est déposé, classé selon des critères définis par l'utilisateur,
puis exporté en classeur Excel. **Aucune donnée n'est conservée** : les CV sont
analysés en mémoire vive et disparaissent à la fin de la session. Pas de
compte, pas de base de données, pas d'historique.

## État d'avancement

Voir `docs/PROCESS-TriCV.md` §7.

Les lots 0 à 5 sont faits : moteur, parser, modèles de critères, export Excel
et interface Streamlit. **Les portes P1 et P2 sont franchies** — le moteur a
été éprouvé sur un corpus fictif de dix cas et sur un lot réel de dix CV, et
le parcours complet a été rejoué au navigateur sur ce même lot réel.

Reste le **déploiement** sur Streamlit Community Cloud, puis la porte P3 : les
dix points de recette cochés sur l'application en ligne, et non seulement en
local. Voir `docs/RECETTE.md`.

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

## Déploiement

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

### Limites connues de l'hébergement

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
| `docs/RECETTE.md` | Les dix points de recette, leur état, et ce qui reste à cocher en ligne |
| `docs/DESIGN-MAPPING.md` | Correspondance entre la maquette et le thème Streamlit, et les écarts assumés |

## Règles non négociables

1. Aucune écriture disque du contenu d'un CV.
2. Aucun `@st.cache_data` ni `@st.cache_resource` sur du contenu de CV.
3. Aucun `print()` ni message d'erreur contenant du texte extrait.
4. `core/` n'importe jamais `streamlit`.
5. Aucun CV réel dans ce dépôt. Le `.gitignore` refuse `*.pdf` et `*.docx`
   partout sauf sous `tests/corpus/`, qui ne contient que des CV fictifs.

Détail en §5 du cadrage.
