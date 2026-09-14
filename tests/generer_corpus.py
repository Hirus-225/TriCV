"""
Génère le corpus de test synthétique sous tests/corpus/.

Les neuf cas couverts sont ceux du §5.1.1 de PROCESS-TriCV.md. Tout le
contenu est ENTIÈREMENT FICTIF : aucune de ces personnes n'existe, aucune de
ces adresses ni de ces numéros n'est réelle. C'est ce qui permet de commiter
ce corpus dans le dépôt sans enfreindre la promesse de confidentialité.

Ce script n'est PAS utilisé par l'application. Il ne sert qu'à régénérer le
corpus si on veut le modifier. Il dépend de reportlab et de Pillow, listés
dans requirements-dev.txt et volontairement absents de requirements.txt :
Streamlit Community Cloud n'installe que ce dernier.

Usage :
    ./venv/bin/python tests/generer_corpus.py
"""

import io
import unicodedata
from pathlib import Path

from docx import Document
from docx.shared import Pt
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

DOSSIER_CORPUS = Path(__file__).parent / "corpus"

# DejaVu Sans est une police Unicode complète, présente sur la plupart des
# distributions Linux. On en a besoin pour le cas 2 : les polices PDF
# standard (Helvetica) ne savent pas représenter une accentuation décomposée.
CHEMIN_DEJAVU = "/usr/share/fonts/TTF/DejaVuSans.ttf"
POLICE_UNICODE = "DejaVuSans"

LARGEUR_PAGE, HAUTEUR_PAGE = A4
MARGE = 60
INTERLIGNE = 16


def enregistrer_police_unicode():
    """Rend DejaVu Sans utilisable par reportlab et par Pillow."""
    pdfmetrics.registerFont(TTFont(POLICE_UNICODE, CHEMIN_DEJAVU))


def ecrire_pdf(nom_fichier, lignes):
    """
    Écrit un PDF texte simple, une ligne par entrée, avec passage à la page
    suivante quand on atteint le bas.
    """
    chemin = DOSSIER_CORPUS / nom_fichier
    page = canvas.Canvas(str(chemin), pagesize=A4)
    page.setFont(POLICE_UNICODE, 11)

    y = HAUTEUR_PAGE - MARGE
    for ligne in lignes:
        if y < MARGE:
            page.showPage()
            page.setFont(POLICE_UNICODE, 11)
            y = HAUTEUR_PAGE - MARGE
        page.drawString(MARGE, y, ligne)
        y -= INTERLIGNE

    page.save()
    return chemin


def ecrire_pdf_scanne(nom_fichier, lignes):
    """
    Écrit un PDF ne contenant qu'une IMAGE : le texte est dessiné en pixels,
    il n'existe aucune couche texte extractible.

    C'est exactement ce que produit un scanner, et c'est ce que la détection
    des illisibles doit reconnaître (§7.5 du cadrage).
    """
    largeur_px, hauteur_px = 1240, 1754  # A4 à 150 points par pouce
    image = Image.new("RGB", (largeur_px, hauteur_px), (247, 245, 240))
    dessin = ImageDraw.Draw(image)
    police = ImageFont.truetype(CHEMIN_DEJAVU, 26)

    y = 120
    for ligne in lignes:
        dessin.text((110, y), ligne, fill=(40, 40, 40), font=police)
        y += 42

    # Un léger liseré gris en bord de page, comme sur une numérisation
    dessin.rectangle([4, 4, largeur_px - 5, hauteur_px - 5], outline=(200, 197, 190), width=3)

    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    tampon.seek(0)

    chemin = DOSSIER_CORPUS / nom_fichier
    page = canvas.Canvas(str(chemin), pagesize=A4)
    from reportlab.lib.utils import ImageReader

    page.drawImage(ImageReader(tampon), 0, 0, width=LARGEUR_PAGE, height=HAUTEUR_PAGE)
    page.save()
    return chemin


def ecrire_docx_paragraphes(nom_fichier, lignes):
    """Écrit un .docx classique : tout le contenu en paragraphes."""
    document = Document()
    document.styles["Normal"].font.size = Pt(11)
    for ligne in lignes:
        document.add_paragraph(ligne)

    chemin = DOSSIER_CORPUS / nom_fichier
    document.save(str(chemin))
    return chemin


def ecrire_docx_tableaux(nom_fichier, entete, sections):
    """
    Écrit un .docx dont TOUT le contenu utile est dans des tableaux, sauf
    l'en-tête.

    C'est le piège du lot 2 : un parser qui ne lit que `document.paragraphs`
    ne verrait ici presque rien et classerait ce CV comme illisible.

    `sections` est une liste de couples (intitulé, [lignes de contenu]).
    """
    document = Document()
    document.styles["Normal"].font.size = Pt(11)

    for ligne in entete:
        document.add_paragraph(ligne)

    for intitule, contenu in sections:
        tableau = document.add_table(rows=len(contenu), cols=2)
        tableau.style = "Table Grid"
        for index, ligne in enumerate(contenu):
            tableau.cell(index, 0).text = intitule if index == 0 else ""
            tableau.cell(index, 1).text = ligne
        document.add_paragraph("")

    chemin = DOSSIER_CORPUS / nom_fichier
    document.save(str(chemin))
    return chemin


# ----------------------------------------------------------------------
# Les neuf cas
# ----------------------------------------------------------------------


def cas_1_pdf_texte_standard():
    """Chemin nominal : PDF texte, profil développeur web bien pourvu."""
    return ecrire_pdf(
        "01_cv_texte_standard.pdf",
        [
            "Konan Bernard",
            "konan.bernard@example.ci",
            "+225 07 58 41 22 96",
            "Abidjan (Cocody)",
            "",
            "PROFIL",
            "Developpeur web full-stack, 6 ans d'experience sur des applications",
            "metier a destination de PME ivoiriennes.",
            "",
            "EXPERIENCE",
            "2022 - 2026  Developpeur senior, Atelier Numerique Abidjan",
            "  Conception d'applications Python / Django pour la gestion de stock.",
            "  Interfaces React et integration d'API REST.",
            "  Mise en production sur serveurs Linux, conteneurs Docker.",
            "",
            "2020 - 2022  Developpeur, Studio Lagune",
            "  Sites JavaScript, requetes SQL sur base PostgreSQL et MySQL.",
            "  Travail en freelance sur trois projets complementaires.",
            "",
            "COMPETENCES",
            "Langages : Python, JavaScript, SQL",
            "Frameworks : Django, React",
            "Bases : PostgreSQL, MySQL",
            "Outils : Git, GitHub, Docker, Linux",
            "",
            "FORMATION",
            "2020  Licence en informatique, Universite Felix Houphouet-Boigny",
        ],
    )


def cas_2_pdf_accents_prenoms_composes():
    """
    Accents et prénom composé.

    Deux pièges reproduits volontairement, documentés au §5.1.3 de PROCESS :
    - un tiret cadratin parasite en tête de ligne ;
    - une accentuation DÉCOMPOSÉE (NFD) : le « é » est écrit « e » suivi d'un
      accent aigu combinant. C'est ce qui avait produit « Kouassi Guy-De´sire´ »
      dans RecrutPro. Le parser doit recomposer en NFC.
    """
    nom_decompose = unicodedata.normalize("NFD", "— Kouassi Guy-Désiré")

    return ecrire_pdf(
        "02_cv_accents_prenoms_composes.pdf",
        [
            nom_decompose,
            "guy.kouassi@example.ci",
            "+225 05 44 18 90 33",
            "",
            "PROFIL",
            "Développeur d'applications, spécialisé en développement back-end.",
            "Expérience acquise en Côte d'Ivoire et au Sénégal.",
            "",
            "EXPÉRIENCE",
            "2023 - 2026  Développeur, Société Générale de Données",
            "  Développement d'une plateforme Django de suivi des règlements.",
            "  Modélisation et requêtes SQL sur base MySQL.",
            "  Déploiement sur environnement Linux, versionnement sous Git.",
            "",
            "2022 - 2023  Stage de fin d'études, Agence Ivoirienne du Numérique",
            "  Automatisation de traitements en Python.",
            "",
            "COMPÉTENCES",
            "Python, Django, SQL, MySQL, Git, Linux",
            "Méthodes agiles, rédaction de spécifications",
            "",
            "FORMATION",
            "2022  Master en génie informatique, Institut National Polytechnique",
        ],
    )


def cas_3_pdf_scanne():
    """PDF scanné : une image, aucune couche texte. Doit sortir « illisible »."""
    return ecrire_pdf_scanne(
        "03_cv_scanne_sans_couche_texte.pdf",
        [
            "Traore Aminata",
            "aminata.traore@example.ci",
            "+225 07 31 55 08 12",
            "",
            "Developpeuse web",
            "",
            "Experience : 2021-2026, Developpeuse Python / Django",
            "Competences : Python, Django, SQL, Git, Docker, Linux",
            "Formation : Licence en informatique",
            "",
            "(Ce document est volontairement une image :",
            " aucun texte n'en est extractible.)",
        ],
    )


def cas_4_docx_tableaux():
    """CV Word entièrement construit en tableaux : le piège du lot 2."""
    return ecrire_docx_tableaux(
        "04_cv_docx_tableaux.docx",
        entete=["Diabaté Fatoumata"],
        sections=[
            (
                "Contact",
                [
                    "f.diabate@example.ci",
                    "+225 01 42 77 65 08",
                    "Abidjan (Marcory)",
                ],
            ),
            (
                "Expérience",
                [
                    "2021 - 2026 : Développeuse web, Coopérative Tech Lagunes",
                    "Applications JavaScript et React pour la vente en ligne.",
                    "Conception de bases de données PostgreSQL.",
                    "Intégration continue, Git et Docker.",
                ],
            ),
            (
                "Compétences",
                [
                    "JavaScript, React, Python",
                    "SQL, PostgreSQL, MongoDB",
                    "Git, Docker, Linux",
                ],
            ),
            (
                "Formation",
                [
                    "2021 : Master en informatique appliquée",
                    "2019 : Licence en informatique",
                ],
            ),
        ],
    )


def cas_5_docx_paragraphes():
    """Chemin nominal Word : tout en paragraphes simples."""
    return ecrire_docx_paragraphes(
        "05_cv_docx_paragraphes.docx",
        [
            "Yao Kouadio Emmanuel",
            "yao.emmanuel@example.ci",
            "+225 07 09 33 51 74",
            "",
            "PROFIL",
            "Développeur web junior, sorti de formation en 2024.",
            "",
            "EXPÉRIENCE",
            "2024 - 2026 : Développeur, Groupe Éburnéen Services",
            "Développement d'un intranet en Python et Django.",
            "Requêtes SQL, administration d'une base MySQL.",
            "Versionnement des sources sous GitLab.",
            "",
            "2024 : Stage de six mois, Bureau d'Études Akwaba",
            "",
            "COMPÉTENCES",
            "Python, Django, SQL, MySQL, Git",
            "",
            "FORMATION",
            "2024 : Licence professionnelle en informatique de gestion",
        ],
    )


def cas_6_cv_en_anglais():
    """
    CV rédigé en anglais : langue non prévue.

    Le score doit rester cohérent grâce aux synonymes anglais du modèle
    (« js », « developer », « bachelor »), tout en restant plus bas qu'un CV
    francophone équivalent. C'est la limite assumée du §9 du cadrage.
    """
    return ecrire_pdf(
        "06_cv_en_anglais.pdf",
        [
            "Mensah Kwame",
            "kwame.mensah@example.com",
            "+225 05 61 28 43 19",
            "Abidjan, Cote d'Ivoire",
            "",
            "PROFESSIONAL SUMMARY",
            "Full-stack web developer with five years of experience building",
            "customer-facing applications for retail companies.",
            "",
            "WORK EXPERIENCE",
            "2022 - 2026  Senior Developer, Gulf Coast Software",
            "  Built single-page applications with React and JavaScript.",
            "  Designed and queried MongoDB and SQL data stores.",
            "  Managed source control with Git and containers with Docker.",
            "",
            "2021 - 2022  Junior Developer, Accra Web Studio",
            "  Maintained Linux servers and deployment scripts.",
            "",
            "SKILLS",
            "JavaScript, React, Node, Python",
            "SQL, MongoDB, Git, Docker, Linux",
            "",
            "EDUCATION",
            "2021  Bachelor of Science in Computer Science",
        ],
    )


def cas_7_nom_de_fichier_inexploitable():
    """
    Fichier nommé CVBR.pdf.

    Double vérification : l'heuristique d'extraction du nom doit échouer
    (le document commence par « CURRICULUM VITAE », un intitulé de section,
    pas un nom), ET le repli sur le nom du fichier doit échouer PROPREMENT
    en retournant None, plutôt que d'inventer un nom à partir de « CVBR ».
    """
    return ecrire_pdf(
        "CVBR.pdf",
        [
            "CURRICULUM VITAE",
            "bamba.r@example.ci | +225 07 77 12 36 40",
            "Abidjan (Yopougon)",
            "",
            "EXPERIENCE PROFESSIONNELLE",
            "2023 - 2026 : Developpeur full-stack, Societe Anonyme Digitale",
            "  Applications Python et Django, front-end React.",
            "  Administration de bases PostgreSQL.",
            "  Conteneurisation Docker, serveurs Linux.",
            "",
            "2021 - 2023 : Developpeur JavaScript, Cabinet Numerique Plateau",
            "  Integration d'interfaces et requetes SQL.",
            "",
            "COMPETENCES TECHNIQUES",
            "Python, JavaScript, Django, React",
            "SQL, PostgreSQL, Git, Docker, Linux",
            "",
            "FORMATION",
            "2021 : Master en informatique",
        ],
    )


def cas_8_nom_de_fichier_exploitable():
    """
    Fichier nommé CV_Adjoua_Kouadio_2026.pdf.

    Le document ne commence pas par un nom (il commence par un intitulé de
    section), donc l'heuristique échoue et le repli sur le nom du fichier
    doit produire « Adjoua Kouadio » — en écartant le préfixe « CV » et
    l'année « 2026 ».
    """
    return ecrire_pdf(
        "CV_Adjoua_Kouadio_2026.pdf",
        [
            "PROFIL PROFESSIONNEL",
            "Developpeuse web, quatre ans d'experience en agence.",
            "adjoua.kouadio@example.ci",
            "+225 05 12 84 60 27",
            "",
            "EXPERIENCE",
            "2022 - 2026 : Developpeuse, Agence Web Treichville",
            "  Sites JavaScript, framework Vue et composants React.",
            "  Bases de donnees MySQL, requetes SQL complexes.",
            "  Versionnement sous Git, hebergement Linux.",
            "",
            "COMPETENCES",
            "JavaScript, Vue, React, SQL, MySQL, Git, Linux",
            "",
            "FORMATION",
            "2022 : Licence en informatique",
        ],
    )


def cas_9_sans_email_ni_telephone():
    """
    CV sans aucune coordonnée, et sans rapport avec le poste visé.

    Deux vérifications d'un coup : les champs manquants doivent valoir None
    sans faire échouer le parser, et le score très bas qui en résulte doit
    rester un score — ce CV est LISIBLE. « Illisible » et « score de 0 » sont
    deux états distincts (§7.5 du cadrage).
    """
    return ecrire_pdf(
        "09_cv_sans_email_ni_telephone.pdf",
        [
            "Ouattara Salimata",
            "",
            "PROFIL",
            "Assistante de direction, huit ans d'experience en cabinet.",
            "Disponible immediatement, mobilite sur le district d'Abidjan.",
            "",
            "EXPERIENCE",
            "2018 - 2026 : Assistante de direction, Cabinet Conseil Plateau",
            "  Gestion administrative, tenue de l'agenda et du courrier.",
            "  Archivage des dossiers du personnel.",
            "  Organisation des deplacements et des reunions.",
            "",
            "COMPETENCES",
            "Bureautique : Word, Excel, PowerPoint, Outlook",
            "Redaction administrative, organisation, discretion",
            "",
            "FORMATION",
            "2018 : BTS en assistanat de direction",
        ],
    )


def principal():
    DOSSIER_CORPUS.mkdir(parents=True, exist_ok=True)
    enregistrer_police_unicode()

    cas = [
        cas_1_pdf_texte_standard,
        cas_2_pdf_accents_prenoms_composes,
        cas_3_pdf_scanne,
        cas_4_docx_tableaux,
        cas_5_docx_paragraphes,
        cas_6_cv_en_anglais,
        cas_7_nom_de_fichier_inexploitable,
        cas_8_nom_de_fichier_exploitable,
        cas_9_sans_email_ni_telephone,
    ]

    for fonction in cas:
        chemin = fonction()
        print(f"  écrit : {chemin.name}")

    print(f"\n{len(cas)} fichiers générés dans {DOSSIER_CORPUS}")


if __name__ == "__main__":
    principal()
