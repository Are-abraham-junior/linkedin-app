/**
 * Domaines fonctionnels décrits sur le site. Les faits (quotas par défaut,
 * délais de reprise, fréquence des vérifications) viennent du moteur de
 * campagnes (server/src/workers/campaign.worker.ts) — ne pas inventer.
 */

export type FeatureId = "campagnes" | "prospects" | "inbox" | "securite" | "equipe" | "rapports";

export interface Feature {
  id: FeatureId;
  short: string;
  title: string;
  lead: string;
  paragraphs: string[];
  points: string[];
}

export const FEATURES: Feature[] = [
  {
    id: "campagnes",
    short: "Campagnes",
    title: "Des séquences qui suivent votre rythme, pas l'inverse.",
    lead: "Assemblez invitation, message, visite de profil et suivi dans l'ordre que vous voulez, avec un délai en jours entre chaque étape.",
    paragraphs: [
      "Chaque prospect avance dans la séquence à son propre rythme. Après une invitation, Bleadin attend l'acceptation avant d'envoyer le message suivant, puis respecte le délai que vous avez fixé.",
      "Les messages sont personnalisés avec le prénom, le nom, l'entreprise et le titre du prospect. Vous voyez exactement ce qui partira, quand, et pour qui.",
    ],
    points: [
      "Étapes : invitation, message, visite de profil, suivi, délai",
      "Vérification des acceptations toutes les cinq minutes",
      "Variables {{firstName}}, {{lastName}}, {{company}}, {{headline}}",
    ],
  },
  {
    id: "prospects",
    short: "Prospects",
    title: "Une base propre, sans doublons.",
    lead: "Importez vos fichiers CSV ou XLSX, organisez-les en listes, et laissez Bleadin dédoublonner sur l'URL LinkedIn.",
    paragraphs: [
      "Un prospect n'existe qu'une fois dans votre espace, quelle que soit la liste d'où il vient. L'historique des imports garde la trace de chaque fichier.",
      "À mesure que les campagnes tournent, les fiches s'enrichissent avec le titre, l'entreprise et la photo. L'e-mail et le téléphone se révèlent à la demande avec vos tokens d'enrichissement : 1 token par e-mail trouvé, 5 par numéro, restitués s'ils sont introuvables.",
    ],
    points: [
      "Dédoublonnage sur l'URL LinkedIn à l'import",
      "Listes et historique des imports",
      "Titre, entreprise et photo mis à jour au fil des actions",
      "E-mail et téléphone à la demande, avec tokens restitués si introuvables",
    ],
  },
  {
    id: "inbox",
    short: "Inbox",
    title: "Vos conversations LinkedIn, au même endroit que vos campagnes.",
    lead: "Les réponses arrivent dans Bleadin en temps réel. Vous répondez sans changer d'onglet, avec le contexte de la campagne sous les yeux.",
    paragraphs: [
      "Chaque conversation est reliée au prospect et à la séquence qui l'a déclenchée. Vous savez d'où vient la réponse avant même de la lire.",
      "Les messages envoyés depuis LinkedIn apparaissent aussi dans Bleadin : l'inbox reste le reflet exact de votre messagerie.",
    ],
    points: [
      "Synchronisation en temps réel via webhooks",
      "Réponse directe depuis Bleadin",
      "Lien vers la fiche prospect et la campagne d'origine",
    ],
  },
  {
    id: "securite",
    short: "Sécurité du compte",
    title: "Votre compte LinkedIn passe avant vos campagnes.",
    lead: "Bleadin envoie comme une personne le ferait : à vos heures, dans vos limites, et s'arrête au premier signe d'anomalie.",
    paragraphs: [
      "Vous définissez des quotas journaliers d'invitations et de messages, vos jours et heures de travail, et votre fuseau horaire. Rien ne part en dehors.",
      "Si LinkedIn demande une vérification ou si la session expire, toutes vos campagnes se mettent en pause et l'action en cours est reprogrammée deux heures plus tard. En cas de limitation temporaire, l'action est simplement décalée de quinze minutes.",
    ],
    points: [
      "Quotas par défaut : 30 invitations et 70 messages par jour, ajustables",
      "Horaires et jours de travail par utilisateur, fuseau respecté",
      "Pause automatique et reprise après vérification",
    ],
  },
  {
    id: "equipe",
    short: "Équipe",
    title: "Un espace par équipe, un compte LinkedIn par personne.",
    lead: "Invitez vos collègues, attribuez des rôles, et gardez une vue d'ensemble sur ce que chacun envoie.",
    paragraphs: [
      "Chaque membre connecte son propre compte LinkedIn et travaille avec ses propres quotas et horaires. Les listes et les campagnes restent dans l'espace de l'organisation.",
      "Les agences gèrent plusieurs espaces de travail depuis un seul accès et passent de l'un à l'autre sans se déconnecter.",
    ],
    points: [
      "Rôles propriétaire, administrateur et membre",
      "Invitations par lien",
      "Espaces de travail multiples pour les agences",
    ],
  },
  {
    id: "rapports",
    short: "Rapports",
    title: "Ce qui a été envoyé, accepté et répondu.",
    lead: "Des chiffres simples, par campagne et par période, pour décider quoi ajuster.",
    paragraphs: [
      "Taux d'acceptation des invitations, taux de réponse aux messages, volume par jour : les indicateurs qui comptent, sans tableau de bord à configurer.",
      "Exportez vos rapports pour les partager avec votre équipe ou vos clients.",
    ],
    points: [
      "Acceptations, réponses et volumes par campagne",
      "Comparaison par période",
      "Export PDF",
    ],
  },
];

export const SEQUENCE_TEMPLATES = [
  { file: "05_invitation.png", name: "Invitation seule", desc: "Élargir son réseau sans message de relance." },
  { file: "04_message_direct.png", name: "Message direct", desc: "Pour les contacts déjà connectés." },
  { file: "03_visite_invitation_1_message.png", name: "Visite, invitation, message", desc: "La séquence de prise de contact classique." },
  { file: "02_visite_follow_invitation.png", name: "Visite, suivi, invitation", desc: "Se faire remarquer avant d'inviter." },
  { file: "06_invitation_2_messages.png", name: "Invitation et deux messages", desc: "Une relance espacée pour les cibles chaudes." },
  { file: "01_invitation_3_messages.png", name: "Invitation et trois messages", desc: "La séquence longue, pour les cycles de vente lents." },
];

export const HOME_FAQ = [
  {
    q: "Mon compte LinkedIn risque-t-il d'être restreint ?",
    a: "Bleadin agit dans les limites que vous fixez, uniquement pendant vos heures de travail, et se met en pause dès que LinkedIn demande une vérification. C'est la même prudence qu'un envoi manuel, sans l'oubli.",
  },
  {
    q: "Dois-je laisser mon ordinateur allumé ?",
    a: "Non. Les actions sont exécutées depuis nos serveurs, à vos horaires, que vous soyez connecté ou non.",
  },
  {
    q: "Faut-il installer une extension ?",
    a: "Non. Vous connectez votre compte LinkedIn une fois depuis les paramètres, puis tout se passe dans Bleadin.",
  },
  {
    q: "Puis-je répondre aux prospects depuis Bleadin ?",
    a: "Oui. L'inbox reflète votre messagerie LinkedIn en temps réel et vous répondez directement depuis l'application.",
  },
  {
    q: "Comment importer mes prospects ?",
    a: "Depuis un fichier CSV ou XLSX contenant les URL LinkedIn. Les doublons sont écartés automatiquement à l'import.",
  },
  {
    q: "Que se passe-t-il lorsqu'un prospect répond ?",
    a: "Il sort de la séquence automatique et la conversation vous est remise dans l'inbox. Rien d'automatique ne lui est envoyé ensuite.",
  },
];
