# Bibliothèques tierces (copiées en local)

Le site n'appelle aucun CDN : tout ce qui est chargé par la page vient de ce dossier.
Chaque bibliothèque est figée à une version précise ; pour en changer, remplacer les
fichiers ci-dessous **et** mettre à jour ce tableau.

C'est la contrepartie de la politique de sécurité `default-src 'self'` déclarée dans
`index.html` : le navigateur refuse tout ce qui ne vient pas de ce site. Une
bibliothèque oubliée ici ne se chargerait pas du tout — l'erreur est bruyante, et
c'est voulu.

| Dossier | Bibliothèque | Version | Provenance | Fichiers retenus | Remplace |
|---|---|---|---|---|---|
| `pdfjs/` | PDF.js (Mozilla) — lecture des PDF | 6.4.299 | paquet npm `pdfjs-dist` | `pdf.min.mjs`, `pdf.worker.min.mjs`, `cmaps/`, `standard_fonts/`, `LICENSE` (Apache-2.0) | `pdfplumber` |
| `fflate/` | fflate — décompression zip | 0.8.2 | paquet npm `fflate`, fichier `esm/browser.js` renommé `fflate.mjs` | `fflate.mjs`, `LICENSE` (MIT) | la moitié « ouvrir l'archive » de `python-docx` |
| `exceljs/` | ExcelJS — écriture de classeurs Excel **mis en forme** | 4.4.0 | paquet npm `exceljs`, fichier `dist/exceljs.min.js` | `exceljs.min.js`, `LICENSE` (MIT) | `openpyxl` |
| `marked/` | marked — rendu du manuel Markdown | 18.1.2 | paquet npm `marked`, fichier `lib/marked.esm.js` | `marked.esm.js`, `LICENSE` (MIT) | `st.markdown` |
| `fonts/` | Bricolage Grotesque (variable, axes opsz 12–96 + wght 200–800) et Manrope (variable, axe wght 200–800) — sous-ensemble *latin* | 5.3.0 | paquets npm `@fontsource-variable/bricolage-grotesque` et `@fontsource-variable/manrope` | les deux `.woff2`, `LICENCE-*.txt` (OFL-1.1), `polices.css` écrit à la main | les polices du thème Streamlit |

`pdfjs/`, `marked/` et `fonts/` sont recopiés **tels quels** depuis le dépôt
Rapprochement Bancaire, où ils sont déjà figés et éprouvés. Même version, mêmes
fichiers : les deux outils doivent se comporter pareil sur un même PDF.

## Points d'attention

**PDF.js — ne jamais laisser chercher ailleurs.** `cmaps/` et `standard_fonts/`
servent aux PDF dont les polices ne sont pas incorporées — fréquent sur les CV
exportés depuis un traitement de texte ancien. Ces deux dossiers sont déclarés à
`getDocument` (`cMapUrl`, `standardFontDataUrl`) pour que PDF.js ne tente jamais de
les télécharger. Sans ces options, il irait les chercher sur un CDN, et la politique
de sécurité bloquerait la requête : le PDF ressortirait avec des caractères manquants,
sans erreur explicite.

**PDF.js — le worker.** `pdf.worker.min.mjs` tourne dans un fil d'exécution séparé,
ce qui évite de geler la page pendant le décodage. La politique de sécurité l'autorise
par `worker-src 'self'`.

**ExcelJS — pourquoi lui et pas SheetJS.** SheetJS Community Edition n'écrit pas les
styles de cellule : c'est réservé à sa version payante. L'export de TriCV est
entièrement mis en forme — en-têtes colorés, bandes de couleur sur les scores, lignes
alternées, cellules fusionnées, hauteurs de ligne, filets. Avec SheetJS on obtiendrait
trois feuilles de données brutes, pas le livrable actuel.

**ExcelJS — l'occurrence de `new Function`.** Le fichier minifié en contient une, dans
le polyfill `setImmediate` qu'il embarque, sur une branche qui ne s'exécute **que** si
on passe une chaîne de caractères à `setImmediate`. ExcelJS ne lui passe que des
fonctions : cette branche est morte. La politique de sécurité interdit l'**exécution**
d'`eval` et de `new Function`, pas leur présence dans un fichier — la bibliothèque
fonctionne donc sous `script-src 'self'`. À revérifier si la version change.

**ExcelJS — format UMD, et chargement à la demande.** Contrairement aux autres,
ExcelJS n'est pas un module ES : il se charge par une balise `<script>` ordinaire et se
déclare dans `window.ExcelJS`. `web/js/export.js` insère cette balise **au premier clic
sur le bouton de téléchargement**, et une seule fois. Le fichier pèse 936 Ko : l'imposer
à chaque visiteur, y compris à celui qui n'exportera rien, serait payer cher une
fonction facultative.

**ExcelJS — les largeurs de colonnes groupées.** ExcelJS écrit une seule balise `<col>`
pour une suite de colonnes de même largeur (`min="7" max="9"`), là où openpyxl en écrit
une par colonne. Les deux sont du XML valide et Excel applique la largeur à toute la
plage. À savoir si l'on relit un tel fichier avec openpyxl : son dictionnaire
`column_dimensions` n'expose la largeur que sous la première lettre de la plage. C'est
une particularité du lecteur, pas une perte dans le fichier.

**fflate — pourquoi pas mammoth.js pour les `.docx`.** Mammoth convertit un document
Word en HTML en interprétant sa mise en forme, et **ignore les zones de texte
flottantes**. C'est précisément le cas qui a été corrigé le 16/09/2026 : un CV
entièrement construit en zones de texte ressortait à zéro caractère, donc classé
illisible, alors qu'il contenait onze cents caractères extractibles. Le code Python
(`core/parser.py`, `_collecter_paragraphes`) descend pour cette raison dans l'arbre XML
du document. On transpose cette lecture-là : fflate ouvre l'archive, et le `DOMParser`
du navigateur lit le XML — pas besoin de bibliothèque pour cette seconde moitié.

**Les polices.** Le sous-ensemble *latin* couvre le français, y compris œ, €, ’ et
« ». Un caractère hors de ce sous-ensemble s'affiche dans la police de secours du
système. Aucun appel à Google Fonts : chaque visiteur y laisserait son adresse IP, ce
qu'interdit la règle n°4 du §5 du cadrage.

## Ce qui n'a pas de bibliothèque

Volontairement. Le navigateur sait déjà le faire, et une dépendance de moins est une
dépendance de moins à suivre.

| Besoin | Moyen |
|---|---|
| normalisation Unicode NFC/NFD | `String.prototype.normalize` |
| suppression des accents | `/\p{Mn}/gu` |
| expressions régulières | `RegExp` |
| lecture du XML d'un `.docx` | `DOMParser` |
| coloration du tableau de classement | du CSS (c'est tout ce que `pandas` faisait ici) |
| téléchargement d'un fichier produit | `Blob` + `URL.createObjectURL` |
