# TriCV

Outil web gratuit de tri de CV pour les professionnels RH francophones.

Un lot de CV est déposé, classé selon des critères définis par l'utilisateur,
puis exporté en classeur Excel. **Aucune donnée n'est conservée** : les CV sont
analysés en mémoire vive et disparaissent à la fin de la session. Pas de compte,
pas de base de données, pas d'historique.

## État d'avancement

Voir `docs/PROCESS-TriCV.md` §7. Les lots 0 à 5 sont faits : moteur, parser,
modèles de critères, export Excel et interface Streamlit. La porte P1 est
franchie sur les deux volets — corpus fictif et lot réel de dix CV.

Reste le lot 6 : notice de confidentialité, déploiement sur Streamlit
Community Cloud, et recette complète sur l'application déployée (porte P3).

## Installation

```
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Vérification du moteur (porte P1)

Fait tourner le parser et le scorer sur le corpus de test fictif et affiche,
pour chaque fichier, les informations extraites et le détail du score :

```
./venv/bin/python tests/verifier_moteur.py
```

## Documentation

| Fichier | Contenu |
|---|---|
| `docs/CADRAGE-TriCV.md` | Le **quoi** : produit, moteur, règles de confidentialité |
| `docs/PROCESS-TriCV.md` | Le **comment** : méthode, séquence des lots, points de contrôle |
| `docs/DESIGN-MAPPING.md` | Correspondance entre la maquette et le thème Streamlit |
| `docs/MANUEL-PROCEDURE.md` | Le **mode d'emploi** : procédure d'utilisation, points de contrôle, réglage des critères |

## Règles non négociables

1. Aucune écriture disque du contenu d'un CV.
2. Aucun `@st.cache_data` ni `@st.cache_resource` sur du contenu de CV.
3. Aucun `print()` ni message d'erreur contenant du texte extrait.
4. `core/` n'importe jamais `streamlit`.

Détail en §5 du cadrage.

## Lancer l'application en local

```
./venv/bin/streamlit run app.py
```

L'application s'ouvre sur http://localhost:8501. `Ctrl+C` arrête le serveur.
Le thème est lu dans `.streamlit/config.toml`, relativement au dossier depuis
lequel la commande est lancée.
