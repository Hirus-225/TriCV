# Manuel de procédure — TriCV

**Version 1.0 — 16 septembre 2026**

Ce manuel décrit comment utiliser TriCV correctement : dans quel ordre, avec
quels contrôles, et avec quelles précautions. Il s'adresse à la personne qui
trie les CV, pas à celle qui développe l'outil.

Il complète les deux documents de référence du projet — le cadrage (ce que
fait l'outil) et le process (comment il a été construit). En cas de
divergence, **le cadrage fait autorité** et ce manuel doit être corrigé.

---

## 1. Objet et périmètre

TriCV **ordonne un lot de CV** selon des critères que vous définissez, et vous
dit pourquoi chaque candidat se trouve à sa place.

Il traite jusqu'à 40 fichiers PDF ou Word par lot, de 5 Mo maximum chacun.

**Ce que TriCV ne fait pas**, et ne fera pas :

| Il ne fait pas | Pourquoi |
|---|---|
| Émettre un verdict « retenu / rejeté » | Il n'a pas la compétence de juger une candidature. Il compte des mots. |
| Masquer les candidats faibles | Un score bas doit rester visible : il signale un écart de vocabulaire, pas un écart de valeur. |
| Écarter automatiquement un candidat | Un critère d'exclusion produit un signalement, jamais un retrait. |
| Lire un CV scanné | Sans couche de texte, il n'y a rien à lire. Ces CV vont dans « À examiner manuellement ». |
| Conserver quoi que ce soit | Rien n'est écrit sur disque, à aucun moment. |

---

## 2. Le principe qu'il faut avoir compris

**TriCV mesure la présence de mots, pas la qualité d'un candidat.**

Un score de 40 ne veut pas dire « candidat moyen ». Il veut dire : *les mots
que vous avez demandés figurent à 40 % dans ce document.* Un excellent
candidat qui décrit son travail avec d'autres mots que les vôtres obtiendra
un score bas. C'est la limite structurelle de l'outil, et c'est pourquoi
l'avertissement reste affiché en permanence au-dessus du classement.

La bonne façon de s'en servir : **lire le classement de haut en bas, et
s'arrêter quand on a assez de candidats à rencontrer** — en sachant que le
bas du tableau mérite un coup d'œil, pas une poubelle.

---

## 3. Rôles et responsabilités

| Rôle | Responsabilité |
|---|---|
| **Utilisateur** (RH, recruteur) | Définit les critères, lit le classement, décide. La décision lui appartient entièrement. |
| **TriCV** | Extrait, compte, ordonne, explique. Ne décide rien. |
| **Responsable de l'outil** | Vérifie périodiquement la recette (§8), met à jour les modèles de critères quand le vocabulaire du marché évolue. |

Vous restez responsable du traitement des données des candidats, y compris de
la façon dont vous avez obtenu leurs CV et de ce que vous en faites après.

---

## 4. La procédure

### Étape 1 — Préparer le lot

1. Rassemblez les CV dans un dossier, hors de tout partage public.
2. Vérifiez les **noms de fichiers**. Ils comptent : quand TriCV ne trouve pas
   le nom dans le document, il le déduit du nom du fichier.

> **Point de contrôle.** Un fichier nommé d'après un modèle ou d'après une
> autre personne fera afficher le mauvais nom. Ce cas s'est produit lors des
> essais : un CV exporté depuis un outil de mise en page avait conservé le nom
> du modèle d'origine, et TriCV affichait ce nom-là à côté de l'adresse
> e-mail du vrai candidat. **Avant d'appeler quelqu'un, recoupez le nom avec
> l'adresse e-mail.**

### Étape 2 — Définir les critères

Choisissez un modèle dans la liste déroulante, puis ajustez-le. Ou partez de
zéro.

Pour chaque critère :

- un **nom** (« Comptabilité générale ») ;
- un **poids** en points — leur somme n'a pas besoin de faire 100, le score
  est ramené sur 100 automatiquement ;
- des **mots-clés**, un groupe par ligne ;
- un **type** : *requis* (compte dans le score) ou *exclusion* (signale, sans
  rien retirer).

La syntaxe des mots-clés tient en une règle :

> **Le signe `=` est la seule chose qui crée un groupe de synonymes.**

```
python                          →  un groupe
javascript = js                 →  un groupe, deux écritures acceptées
react = vue, angular            →  un groupe, trois écritures acceptées
sql, mysql                      →  deux groupes distincts
```

Un critère vaut ses points quand **tous** ses groupes sont trouvés. Chaque
groupe manquant coûte une fraction des points, à parts égales.

### Étape 3 — Analyser

Déposez les fichiers, lancez l'analyse. Le traitement se fait en mémoire ;
rien n'est enregistré.

### Étape 4 — Lire le classement

Le tableau donne le rang, le nom, les coordonnées, le score et le détail par
critère : ce qui a été **trouvé** et ce qui était **absent**.

La section **« À examiner manuellement »** est séparée du classement. Elle
regroupe les documents dont le texte n'a pas pu être extrait.

> **Point de contrôle.** « Illisible » et « score de 0 » sont deux états
> différents et ne doivent jamais être confondus. Un score de 0 veut dire :
> *j'ai lu ce CV, aucun de vos mots-clés n'y figure.* Illisible veut dire :
> *je n'ai pas pu le lire du tout.* Le second demande une lecture humaine, pas
> un rejet.

### Étape 5 — Exporter

Le classeur Excel contient trois feuilles : Résumé, Classement, Critères. Il
est produit en mémoire et téléchargé directement.

> **Point de contrôle.** Le fichier exporté, lui, est un fichier ordinaire sur
> **votre** poste. La promesse de non-conservation couvre l'application, pas
> votre disque dur. Rangez-le et supprimez-le comme n'importe quel document
> contenant des données personnelles.

### Étape 6 — Effacer la session

Cliquez sur **« Effacer la session »** quand vous avez terminé. L'écran
revient à son état initial : critères vidés, résultats effacés, zone de dépôt
vide.

C'est un geste de fin de travail, au même titre que fermer une armoire.

---

## 5. Écrire des critères qui mesurent vraiment quelque chose

C'est le vrai savoir-faire, et c'est là que se joue la qualité du classement.
Les trois règles ci-dessous viennent d'un essai mené sur un lot réel de dix
CV de comptables, qui a montré que le modèle d'origine comportait quatre
mots-clés ne se déclenchant **jamais**.

### Règle 1 — Un mot-clé de plusieurs mots est une expression exacte

`grand livre` ne trouve que « grand livre », dans cet ordre, sans rien entre
les deux. Une offre d'emploi écrit « comptabilité générale » ; un CV écrit
« comptabilité analytique **et** générale ». Les deux disent la même chose et
ne se rencontrent jamais.

**À faire :** ancrer le concept sur plusieurs écritures.

```
comptabilite generale = comptabilite analytique, ecritures comptables
```

### Règle 2 — Les pluriels ne sont pas automatiques

`facture` ne trouve pas « factures ». Sur le lot d'essai, `facture` était
absent des huit CV et `factures` présent dans six.

**À faire :** écrire les deux formes.

```
facture = factures
fiscalite = fiscal, fiscale, fiscales, fiscaux
```

### Règle 3 — Un critère se dérègle dans les deux sens

| Symptôme dans le tableau | Cause | Correction |
|---|---|---|
| La colonne « absents » est pleine chez **tout le monde** | Mots-clés trop précis, ils ne se déclenchent jamais | Élargir avec des synonymes |
| La colonne « trouvés » est pleine chez **tout le monde** | Mots-clés trop génériques | Resserrer, ou retirer le groupe |

Dans les deux cas, le critère cesse d'ordonner quoi que ce soit — tous les
candidats montent ou descendent ensemble — **et aucun message d'erreur ne
vous le dira**. Seule la lecture de la colonne « absents » le révèle.

Un critère bien réglé mélange les deux : un ou deux groupes que **tout
professionnel du métier** possède — ils écartent les profils hors sujet — et
deux ou trois groupes plus rares, qui ordonnent les candidats entre eux.

### Règle 4 — Un CV long marque plus de points

Plus un document est long, plus il a d'occasions de contenir vos mots. Un CV
de deux pages bien rédigé peut passer derrière un CV de quatre pages
bavard. Gardez-le en tête en haut du tableau.

---

## 6. Anomalies et conduite à tenir

| Constat | Interprétation | Conduite |
|---|---|---|
| CV dans « À examiner manuellement » | Document scanné, ou texte inaccessible | Le lire à la main. Ne jamais le traiter comme un score de 0. |
| Nom affiché = nom du fichier | Aucun nom trouvé dans les premières lignes | Normal. Recoupez avec l'e-mail. |
| Nom affiché manifestement faux | Nom de fichier trompeur | Recoupez avec l'e-mail avant tout contact. |
| Aucun e-mail ni téléphone | Coordonnées dans une image, ou absentes | Ouvrir le CV. |
| Tous les scores sont bas | Critères trop précis (règles 1 et 2) | Élargir les mots-clés, relancer. |
| Tous les scores sont proches | Critères trop génériques | Resserrer, ou différencier les poids. |
| Un signalement d'exclusion apparaît | Un mot-clé d'exclusion a été trouvé | C'est une alerte à vérifier, pas un rejet. Le candidat reste classé. |

---

## 7. Confidentialité

L'application ne conserve rien : les CV sont analysés en mémoire vive, jamais
écrits sur un disque, jamais transmis à un tiers, jamais utilisés pour
entraîner un modèle. Aucun compte, aucune base de données, aucun historique.

L'hébergement est situé aux États-Unis : les fichiers y transitent le temps de
l'analyse. Cette information doit rester visible dans l'application — elle
couvre l'obligation d'information de la loi ivoirienne n° 2013-450, et du
RGPD si un candidat est européen.

**Ce qui reste à votre charge :**

1. Le classeur Excel exporté est un document contenant des données
   personnelles. Il vous appartient et vous en répondez.
2. N'utilisez l'outil que sur des CV que vous avez légitimement reçus.
3. Cliquez sur « Effacer la session » en fin de travail, surtout sur un poste
   partagé.
4. Ne conservez pas les CV plus longtemps que nécessaire au recrutement en
   cours.

---

## 8. Contrôle périodique

À refaire après toute modification de l'outil, et au minimum avant chaque
mise en ligne d'une nouvelle version.

**Contrôle automatique.** Lancer le script de vérification du moteur :

```
./venv/bin/python tests/verifier_moteur.py
```

Il doit afficher « Toutes les vérifications passent » et se terminer sur le
code 0. Il couvre les frontières de mots, les accents, la normalisation des
poids, les critères d'exclusion, l'extraction PDF et Word, les cinq modèles
et l'export Excel.

**Contrôle manuel.** Les dix points de recette du §12 du cadrage, sur
l'application déployée et pas seulement en local.

**Contrôle sur lot réel.** Le contrôle automatique prouve que le moteur est
*correct*. Il ne prouve pas que le classement est *crédible*. Seul un passage
sur une dizaine de CV authentiques le montre — c'est ce passage qui a révélé
les quatre mots-clés morts et le CV Word invisible. À refaire pour chaque
nouveau modèle de critères.

> Ces CV réels ne doivent jamais entrer dans le dépôt de code. Conservez-les
> dans un dossier séparé.

---

## 9. Journal des versions

| Version | Date | Changement |
|---|---|---|
| 1.0 | 16/09/2026 | Rédaction initiale, après le passage du moteur sur un lot réel de dix CV. |

---

*Ce manuel est versionné avec le code, dans `docs/`. Toute évolution de
l'outil qui modifie une procédure décrite ici doit modifier ce document dans
le même commit.*
