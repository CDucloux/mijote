// ─── DOCUMENTS LÉGAUX ─────────────────────────────────────────────────────────
// Premier jet complet, à FAIRE RELIRE avant une mise en production réelle.
//
// ⚠️ INFOS À COMPLÉTER / VÉRIFIER avant prod (repérées par [entre crochets] dans
//    le texte, pour ne pas publier de données personnelles sans validation) :
//    - Identité de l'éditeur (nom, statut : particulier / auto-entrepreneur…).
//    - Adresse de contact (email ou postale) affichée publiquement.
//    - Le cas échéant : SIREN/SIRET, directeur de publication.
//    - Confirmer l'entité et la région d'hébergement Firebase/Google Cloud.
//
// Le contenu reflète l'état RÉEL de l'app au moment de la rédaction : auth Google
// (Firebase Auth), stockage Firestore/Storage (région europe-west1), IndexedDB
// pour le hors-ligne, AUCUNE mesure d'audience ni traceur publicitaire. Si tu
// ajoutes un jour de l'analytics, il faudra mettre à jour Confidentialité +
// Cookies et probablement ajouter un consentement.

export const LEGAL_UPDATED = "24 juillet 2026";

// Chaque document : { id, short, icon, title, intro?, blocks: [{ h, p?, list? }] }
export const LEGAL_DOCS = [
  {
    id: "mentions-legales",
    short: "Mentions légales",
    icon: "info",
    title: "Mentions légales",
    intro: "Informations relatives à l'éditeur et à l'hébergeur du service Mijoté, en application de l'article 6 III de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l'économie numérique (LCEN).",
    blocks: [
      {
        h: "Éditeur",
        p: [
          "Le service Mijoté (ci-après « l'Application ») est édité par [nom de l'éditeur à compléter], [statut à préciser : particulier / auto-entrepreneur / société].",
          "Contact : [adresse de contact à compléter].",
        ],
      },
      {
        h: "Directeur de la publication",
        p: ["[nom du directeur de la publication à compléter]."],
      },
      {
        h: "Hébergeur",
        p: [
          "L'Application et ses données sont hébergées par Google (Firebase / Google Cloud Platform), Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irlande.",
          "Les données applicatives sont stockées dans la région europe-west1 (Union européenne).",
        ],
      },
      {
        h: "Propriété intellectuelle",
        p: [
          "L'ensemble des éléments de l'Application (structure, code, textes, éléments graphiques) est protégé par le droit de la propriété intellectuelle. Toute reproduction ou représentation, totale ou partielle, sans autorisation, est interdite.",
          "Les recettes et contenus que vous créez restent votre propriété.",
        ],
      },
      {
        h: "Contact",
        p: ["Pour toute question relative à l'Application, vous pouvez écrire à [adresse de contact à compléter]."],
      },
    ],
  },
  {
    id: "confidentialite",
    short: "Confidentialité",
    icon: "eyeOff",
    title: "Politique de confidentialité",
    intro: "Cette politique explique quelles données personnelles Mijoté traite, pourquoi, sur quelle base légale, et quels sont vos droits, conformément au Règlement (UE) 2016/679 (RGPD) et à la loi Informatique et Libertés.",
    blocks: [
      {
        h: "Responsable du traitement",
        p: ["Le responsable du traitement est l'éditeur de l'Application (voir les Mentions légales). Contact : [adresse de contact à compléter]."],
      },
      {
        h: "Données que nous traitons",
        list: [
          "Données de compte : lors de la connexion via Google, nous recevons votre nom d'affichage, votre adresse e-mail et votre photo de profil.",
          "Contenus que vous créez : recettes, carnets, planning de repas, listes de courses, stock, préférences.",
          "Données techniques strictement nécessaires au fonctionnement (session d'authentification, cache hors-ligne).",
        ],
      },
      {
        h: "Ce que nous ne faisons pas",
        list: [
          "Aucune mesure d'audience, aucun traceur publicitaire, aucun profilage.",
          "Aucune revente ni partage de vos données à des fins commerciales.",
        ],
      },
      {
        h: "Finalités et base légale",
        list: [
          "Fournir le service (créer et synchroniser vos recettes, planning, courses, stock) : exécution du contrat / des conditions d'utilisation.",
          "Gérer votre compte et la fonctionnalité de foyer partagé : exécution du contrat.",
          "Assurer la sécurité et le bon fonctionnement technique : intérêt légitime.",
        ],
      },
      {
        h: "Destinataires et sous-traitants",
        p: [
          "Vos données sont traitées pour notre compte par Google (Firebase Authentication, Cloud Firestore, Cloud Storage, Cloud Functions), en qualité de sous-traitant, dans la région europe-west1 (Union européenne).",
          "Si vous utilisez la fonction d'import de recette par lien ou par image, le contenu concerné est transmis au fournisseur du modèle d'analyse pour réaliser l'extraction demandée, uniquement le temps de ce traitement.",
        ],
      },
      {
        h: "Durée de conservation",
        p: ["Vos données sont conservées tant que votre compte est actif. Vous pouvez à tout moment effacer vos contenus depuis votre profil. À la suppression de votre compte, vos données sont supprimées."],
      },
      {
        h: "Vos droits",
        p: ["Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité de vos données."],
        list: [
          "Rectification et effacement partiel : directement depuis l'Application (profil, édition de vos contenus).",
          "Effacement global : bouton « Tout effacer » dans votre profil.",
          "Pour les autres droits : écrivez à [adresse de contact à compléter].",
        ],
      },
      {
        h: "Réclamation",
        p: ["Vous pouvez introduire une réclamation auprès de la CNIL (Commission Nationale de l'Informatique et des Libertés), 3 place de Fontenoy, 75007 Paris, www.cnil.fr."],
      },
    ],
  },
  {
    id: "cgu",
    short: "CGU",
    icon: "fileText",
    title: "Conditions générales d'utilisation",
    intro: "Les présentes conditions régissent l'utilisation de l'Application Mijoté. En vous connectant, vous les acceptez.",
    blocks: [
      {
        h: "Objet",
        p: ["Mijoté est une application d'organisation culinaire : gestion de recettes, planning de repas, listes de courses et stock, avec synchronisation et partage au sein d'un foyer."],
      },
      {
        h: "Accès au service",
        p: [
          "L'accès nécessite un compte Google. L'Application est fournie « en l'état », sans garantie de disponibilité continue.",
          "Certaines fonctionnalités nécessitent une connexion internet ; d'autres restent disponibles hors-ligne grâce au cache local.",
        ],
      },
      {
        h: "Votre compte et vos contenus",
        list: [
          "Vous êtes responsable des contenus que vous créez et publiez, et vous garantissez disposer des droits nécessaires.",
          "Vous vous engagez à ne pas publier de contenu illicite, offensant ou portant atteinte aux droits de tiers.",
          "Lorsque vous rejoignez un foyer, vos contenus partagés deviennent visibles par les autres membres de ce foyer.",
        ],
      },
      {
        h: "Propriété intellectuelle",
        p: ["Vous conservez la propriété de vos contenus. L'éditeur conserve tous les droits sur l'Application elle-même."],
      },
      {
        h: "Responsabilité",
        p: [
          "L'éditeur ne saurait être tenu responsable des pertes de données, interruptions de service ou dommages indirects liés à l'utilisation de l'Application.",
          "Les informations nutritionnelles, de saisonnalité ou de difficulté sont fournies à titre indicatif et ne constituent pas un conseil professionnel.",
        ],
      },
      {
        h: "Résiliation",
        p: ["Vous pouvez cesser d'utiliser l'Application et effacer vos données à tout moment depuis votre profil. L'éditeur peut suspendre un compte en cas de manquement aux présentes conditions."],
      },
      {
        h: "Évolution des conditions",
        p: ["Ces conditions peuvent évoluer. La version en vigueur est celle publiée dans l'Application, avec sa date de dernière mise à jour."],
      },
    ],
  },
  {
    id: "cookies",
    short: "Cookies",
    icon: "settings",
    title: "Politique de cookies",
    intro: "Mijoté n'utilise que des cookies et des mécanismes de stockage strictement nécessaires à son fonctionnement. Aucun traceur de mesure d'audience, de publicité ou de réseau social n'est déposé.",
    blocks: [
      {
        h: "Ce que nous utilisons",
        list: [
          "Authentification : la session Firebase Auth qui vous maintient connecté·e.",
          "Fonctionnement hors-ligne : un stockage local (IndexedDB) qui met en cache vos données et l'application pour un usage hors connexion.",
        ],
      },
      {
        h: "Pourquoi il n'y a pas de bandeau de consentement",
        p: ["Ces éléments sont exemptés de consentement car ils sont strictement nécessaires à la fourniture du service que vous demandez (rester connecté·e, utiliser l'application). Aucun cookie non essentiel n'étant déposé, aucun bandeau ni gestionnaire de consentement n'est requis."],
      },
      {
        h: "Gérer ou supprimer ces données",
        p: [
          "Vous pouvez à tout moment vider le stockage local et les cookies via les réglages de votre navigateur, ou vous déconnecter pour effacer la session.",
          "Supprimer ces données vous déconnectera et effacera le cache hors-ligne ; vos contenus synchronisés restent disponibles après reconnexion.",
        ],
      },
      {
        h: "En cas d'évolution",
        p: ["Si un outil de mesure d'audience était ajouté à l'avenir, cette politique serait mise à jour et un mécanisme de consentement approprié serait mis en place au préalable."],
      },
    ],
  },
];

export const LEGAL_BY_ID = Object.fromEntries(LEGAL_DOCS.map(d => [d.id, d]));
