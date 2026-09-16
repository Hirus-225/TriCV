# Fiche de recette — TriCV

Les dix points de contrôle du §12 du cadrage, avec la manière de les vérifier
et l'état constaté.

**La colonne qui compte est la dernière.** Le critère de sortie du lot 6 est
que ces dix points soient cochés sur l'application **déployée**, pas seulement
en local. Une application qui passe la recette sur le poste du développeur et
échoue en ligne n'a pas passé la recette.

---

## Comment vérifier

**Les points automatiques** sont couverts par le script du moteur. Une seule
commande, et il doit se terminer en affichant « Toutes les vérifications
passent » :

```
./venv/bin/python tests/verifier_moteur.py
```

**Les points manuels** demandent d'ouvrir l'application et de regarder.

---

## Les dix points

| # | Point de contrôle (§12) | Comment | Local — 16/09/2026 | Déployé |
|---|---|---|---|---|
| 1 | Un mot-clé d'une lettre (`R`, `C`) ne correspond pas à l'intérieur d'un autre mot | Automatique — partie A1 | ✅ | ☐ |
| 2 | « développeur » dans le CV est trouvé par le mot-clé « developpeur », et réciproquement | Automatique — partie A2 | ✅ | ☐ |
| 3 | La somme des poids, quelle qu'elle soit, produit un score sur 100 cohérent | Automatique — partie A3 | ✅ | ☐ |
| 4 | Un CV scanné apparaît dans « À examiner manuellement », et non en dernière position du classement | Automatique — partie B, cas 3. Confirmé sur lot réel : 2 scans sortis du classement | ✅ | ☐ |
| 5 | Un CV Word construit en tableaux est correctement extrait | Automatique — partie B, cas 4. Le cas 10 couvre en plus les zones de texte flottantes | ✅ | ☐ |
| 6 | Un critère d'exclusion déclenché ne retire pas le candidat du classement | Automatique — parties A4 et D2 | ✅ | ☐ |
| 7 | La recherche d'écritures disque ne remonte rien sur du contenu de CV | Commande ci-dessous | ✅ | ☐ |
| 8 | L'export Excel se télécharge sans qu'aucun fichier n'apparaisse sur le disque du serveur | Automatique — partie D3, plus un contrôle manuel | ✅ | ☐ |
| 9 | « Effacer la session » ramène à l'écran initial, sans résidu | Manuel, au navigateur | ✅ | ☐ |
| 10 | La notice de confidentialité est visible sans avoir à faire défiler la page | Manuel, au navigateur | ✅ | ☐ |

### Point 7 — la commande

```
grep -rn "\.save(\|open(.*'w'\|cache_data\|cache_resource" app.py core/
```

Trois résultats sont attendus et légitimes : deux commentaires qui énoncent la
règle, et `classeur.save(tampon)` dans `core/export.py`, où `tampon` est un
`BytesIO` en mémoire. Tout autre résultat est un défaut.

### Points 9 et 10 — ce qu'il faut regarder

**Point 9.** Déposer des CV, lancer l'analyse, cliquer sur « Effacer la
session », confirmer. Doivent disparaître **en même temps** : le classement,
les critères, et **les noms de fichiers dans la zone de dépôt**. C'est ce
dernier qui a été pris en défaut au lot 5 : l'état était bien vidé, mais le
composant réaffichait la même liste de fichiers. La promesse était démentie à
l'écran au moment même où elle était faite.

**Point 10.** Ouvrir l'application sur un écran d'ordinateur portable, sans
toucher à la molette. Le bandeau « Aucune donnée conservée » et le bloc
« Traitement éphémère — aucune conservation » doivent tous deux être visibles.

---

## Détail du passage local du 16/09/2026

Script du moteur : **101 vérifications, aucune en échec**, code de sortie 0.

Parcours complet au navigateur sur un lot réel de **dix CV de comptables**,
conservés hors du dépôt :

- les dix fichiers sont acceptés, y compris ceux dont le nom contient des
  accents, des apostrophes, des espaces et des parenthèses ;
- **huit sont classés**, de 86 à 44, dans un ordre identique à celui calculé
  par le moteur hors interface — l'interface n'introduit aucun écart ;
- **deux sont mis à part** dans « À examiner manuellement », sans score ;
- le bouton d'export produit le classeur sans créer aucun fichier : après le
  parcours entier, rien n'a été écrit sur le disque ;
- « Effacer la session » ne laisse ni classement, ni critère, ni nom de
  fichier, ni nom de candidat.

---

## Ce qui reste à faire sur l'application déployée

La colonne « Déployé » se coche après la mise en ligne. Deux points méritent
une attention particulière, parce qu'ils peuvent se comporter autrement en
ligne qu'en local :

**Le point 8.** En local, le disque du serveur est le vôtre. En ligne, c'est
celui de l'hébergeur, et vous ne pouvez pas y regarder. Ce qui se vérifie à
la place : le téléchargement fonctionne, et le code ne contient aucune
écriture — c'est le point 7 qui en répond.

**Le plafond de téléversement.** `.streamlit/config.toml` fixe 5 Mo par
fichier. Vérifier que l'application déployée annonce bien 5 Mo, et non la
valeur par défaut de l'hébergeur.

**La mémoire.** Streamlit Community Cloud est limité. Un lot de 40 CV est le
maximum prévu ; c'est aussi le cas qui peut faire redémarrer l'application
pour dépassement. À éprouver une fois en ligne, avec un lot complet.
