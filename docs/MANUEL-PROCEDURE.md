# Manuel de procédure — TriCV

**Version 2.0 — 16 septembre 2026**

Ce manuel explique comment utiliser TriCV : dans quel ordre, avec quelles
vérifications, et avec quelles précautions.

Il s'adresse à la personne qui trie les CV. Aucune connaissance technique
n'est nécessaire : si vous savez utiliser une messagerie et un tableur, vous
savez utiliser TriCV.

---

## 1. À quoi sert TriCV

TriCV **met un lot de CV dans l'ordre** selon des critères que vous
choisissez, et vous montre pourquoi chaque candidat se trouve à sa place.

Il traite jusqu'à 40 CV à la fois, au format PDF ou Word, de 5 Mo maximum
chacun.

### Ce qu'il ne fait pas

| Il ne fait pas | Pourquoi |
|---|---|
| Dire « retenu » ou « rejeté » | Il ne sait pas juger une candidature. Il compte des mots. |
| Cacher les candidats mal classés | Un score bas signale un écart de vocabulaire, pas un candidat moins bon. |
| Écarter quelqu'un tout seul | Un critère d'exclusion pose un drapeau. Il ne retire personne. |
| Lire un CV scanné | Un scan est une photo. Il n'y a pas de texte à lire dedans. |
| Garder vos CV | Rien n'est enregistré, à aucun moment. |

---

## 2. Ce qu'il faut avoir compris avant de s'en servir

> **TriCV mesure la présence de mots. Il ne mesure pas la valeur d'un
> candidat.**

Un score de 40 ne veut pas dire « candidat moyen ». Il veut dire : *les mots
que vous avez demandés se trouvent à 40 % dans ce CV.*

Un excellent candidat qui décrit son travail avec d'autres mots que les
vôtres obtiendra un score bas. C'est la limite de l'outil, et c'est pourquoi
l'avertissement reste affiché en permanence au-dessus du classement.

La bonne façon de s'en servir : **lire le classement de haut en bas et
s'arrêter quand vous avez assez de candidats à rencontrer** — en gardant à
l'esprit que le bas du tableau mérite un coup d'œil, pas la corbeille.

---

## 3. Qui fait quoi

| | |
|---|---|
| **Vous** | Choisissez les critères, lisez le classement, décidez. La décision vous appartient entièrement. |
| **TriCV** | Lit, compte, classe, explique. Ne décide rien. |

Vous restez responsable des données des candidats : de la façon dont vous
avez obtenu leurs CV, et de ce que vous en faites ensuite.

---

## 4. La procédure

### Étape 1 — Préparer le lot

Rassemblez les CV dans un dossier.

Regardez les **noms des fichiers** au passage. Ils comptent : quand TriCV ne
trouve pas le nom du candidat dans le document, il le déduit du nom du
fichier.

> **À vérifier.** Un CV enregistré sous le nom de quelqu'un d'autre fera
> afficher le mauvais nom. Cela s'est produit pendant les essais : un candidat
> avait construit son CV à partir du modèle d'une autre personne, et le
> fichier avait gardé le nom de cette personne. TriCV affichait donc ce
> nom-là, à côté de la vraie adresse e-mail.
>
> **Avant d'appeler quelqu'un, vérifiez que le nom et l'adresse e-mail vont
> bien ensemble.**

### Étape 2 — Choisir les critères

Prenez un modèle tout prêt dans la liste, puis ajustez-le. Ou partez d'une
page blanche.

Chaque critère comporte :

- un **nom** — par exemple « Comptabilité générale » ;
- un **poids** en points, qui dit son importance. Leur total n'a pas besoin
  de faire 100 : le score est ramené sur 100 tout seul ;
- des **mots-clés**, un par ligne ;
- un **type** : *requis*, qui compte dans le score, ou *exclusion*, qui pose
  simplement un drapeau.

Une seule règle d'écriture à retenir :

> **Une ligne = une chose à chercher. Le signe `=` sert à dire « ces mots
> veulent dire la même chose pour moi ».**

```
comptabilite                          une chose à chercher
tva = taxe sur la valeur ajoutee      la même chose, écrite de deux façons
sage = saari, sage 100                la même chose, écrite de trois façons
paie, recrutement                     deux choses différentes
```

Un critère vaut tous ses points quand **toutes** ses lignes sont trouvées.
Chaque ligne manquante en coûte une part égale.

### Étape 3 — Lancer l'analyse

Déposez les fichiers et lancez l'analyse. Tout se passe en mémoire, le temps
du calcul. Rien n'est enregistré.

### Étape 4 — Lire le classement

Le tableau donne le rang, le nom, les coordonnées, le score, et pour chaque
critère ce qui a été **trouvé** et ce qui était **absent**.

Sous le classement, une liste séparée, **« À examiner manuellement »**,
rassemble les CV que l'outil n'a pas pu lire.

> **À retenir.** « Illisible » et « score de 0 » ne veulent pas dire la même
> chose. Un score de 0 veut dire : *j'ai lu ce CV, aucun de vos mots-clés n'y
> figure.* Illisible veut dire : *je n'ai pas réussi à le lire du tout.* Le
> second demande une lecture de votre part, pas un rejet.

### Étape 5 — Exporter

Le fichier Excel contient trois feuilles : Résumé, Classement, Critères. Il se
télécharge directement.

> **À retenir.** Ce fichier Excel, lui, reste sur **votre** ordinateur. La
> promesse « rien n'est conservé » concerne l'application, pas votre disque
> dur. Rangez-le et supprimez-le comme n'importe quel document contenant des
> données personnelles.

### Étape 6 — Effacer la session

Cliquez sur **« Effacer la session »** quand vous avez terminé. L'écran
revient à son état de départ : critères vidés, résultats effacés, plus aucun
fichier affiché.

C'est un geste de fin de travail, comme refermer une armoire à dossiers.

---

## 5. Bien choisir ses mots-clés

C'est là que se joue la qualité du classement. Les règles ci-dessous viennent
d'un essai mené sur un vrai lot de dix CV de comptables, qui a montré que
quatre des mots-clés prévus au départ ne se trouvaient dans **aucun** CV.

### Les accents et les majuscules ne comptent pas

Écrivez comme cela vous vient. `comptabilité générale`,
`comptabilite generale` et `COMPTABILITÉ GÉNÉRALE` cherchent exactement la
même chose.

### Les pluriels, en revanche, comptent

`facture` ne trouve **pas** « factures ». Sur le lot d'essai, `facture` était
absent des huit CV, et `factures` présent dans six.

Écrivez donc les deux formes :

```
facture = factures
declaration = declarations
```

### Plusieurs mots collés forment une expression exacte

`grand livre` ne trouve que « grand livre », dans cet ordre, sans rien entre
les deux.

C'est le piège le plus courant. Une offre d'emploi écrit « comptabilité
générale » ; un CV écrit « comptabilité analytique **et** générale ». Les
deux parlent de la même chose et ne se rencontrent jamais.

Prévoyez donc les façons dont un candidat écrirait réellement la chose :

```
comptabilite generale = comptabilite analytique, ecritures comptables
```

### Un critère peut se dérégler dans les deux sens

Relisez la colonne **« absents »** du tableau, c'est elle qui vous le dira.

| Ce que vous voyez | Ce que cela veut dire | Ce qu'il faut faire |
|---|---|---|
| La colonne « absents » est pleine chez **tout le monde** | Vos mots-clés sont trop précis, ils ne se trouvent nulle part | Ajouter des façons de dire la même chose, avec le `=` |
| La colonne « trouvés » est pleine chez **tout le monde** | Vos mots-clés sont trop courants, ils se trouvent partout | Être plus précis, ou retirer la ligne |

Dans les deux cas, le critère ne classe plus rien : tous les candidats montent
ou descendent ensemble. **Et rien ne vous préviendra** — seule la lecture de
la colonne « absents » le montre.

Un bon critère mélange les deux : une ou deux lignes que **tout professionnel
du métier** aura — elles écartent les candidatures hors sujet — et deux ou
trois lignes plus rares, qui départagent les candidats sérieux entre eux.

### Un CV long marque plus de points

Plus un CV est long, plus il a d'occasions de contenir vos mots. Un CV de deux
pages bien écrit peut passer derrière un CV de quatre pages bavard.
Gardez-le en tête en haut du tableau.

---

## 6. Quand quelque chose cloche

| Ce que vous constatez | Ce que cela veut dire | Ce qu'il faut faire |
|---|---|---|
| Un CV dans « À examiner manuellement » | C'est un scan, ou son texte est inaccessible | Le lire vous-même. Ne jamais le traiter comme un score de 0. |
| Le nom affiché est celui du fichier | Aucun nom trouvé en haut du CV | C'est normal. Vérifiez avec l'adresse e-mail. |
| Le nom affiché est visiblement faux | Le fichier porte le nom de quelqu'un d'autre | Vérifiez avec l'adresse e-mail avant tout appel. |
| Ni e-mail ni téléphone | Les coordonnées sont dans une image, ou absentes | Ouvrir le CV. |
| Tous les scores sont bas | Vos mots-clés sont trop précis | Les élargir avec le `=`, relancer. |
| Tous les scores se ressemblent | Vos mots-clés sont trop courants | Être plus précis, ou différencier les poids. |
| Un drapeau d'exclusion apparaît | Un mot que vous surveilliez a été trouvé | C'est une alerte à vérifier, pas un rejet. Le candidat reste classé. |

---

## 7. Confidentialité

L'application ne garde rien. Les CV sont lus le temps du calcul, jamais
enregistrés, jamais transmis à qui que ce soit, jamais utilisés pour entraîner
un programme. Il n'y a ni compte, ni base de données, ni historique.

L'application est hébergée sur des serveurs situés aux États-Unis : les
fichiers y passent le temps de l'analyse. Cette information doit rester
visible dans l'application — elle répond à l'obligation d'information de la
loi ivoirienne n° 2013-450, et du RGPD si un candidat est européen.

### Ce qui reste à votre charge

1. Le fichier Excel que vous téléchargez contient des données personnelles. Il
   est à vous, et vous en répondez.
2. N'utilisez l'outil que sur des CV que vous avez reçus légitimement.
3. Cliquez sur « Effacer la session » en fin de travail, surtout sur un poste
   partagé.
4. Ne gardez pas les CV plus longtemps que le recrutement en cours ne
   l'exige.

---

## 8. Vérifier que le classement reste juste

**À chaque nouveau jeu de critères**, avant de vous fier au classement :
relisez la colonne « absents » sur les trois ou quatre premiers candidats. Si
elle est pleine partout, vos critères ne mesurent pas ce que vous croyez.

**À chaque nouveau type de poste**, faites un essai sur une dizaine de CV que
vous connaissez déjà. Si le classement place en haut les candidats que vous
auriez retenus vous-même, vos critères sont bons. Sinon, ce sont les critères
qu'il faut corriger — pas le classement qu'il faut ignorer.

C'est un essai de ce genre, sur dix CV de comptables, qui a révélé les quatre
mots-clés introuvables et un CV Word que l'outil ne savait pas lire.

> La personne qui maintient l'outil dispose d'une vérification technique
> séparée, décrite dans la documentation du projet. Elle ne vous concerne pas.

---

## 9. Versions

| Version | Date | Changement |
|---|---|---|
| 2.0 | 16/09/2026 | Réécriture pour un lecteur non technique. |
| 1.0 | 16/09/2026 | Première rédaction, après l'essai sur un lot réel de dix CV. |
