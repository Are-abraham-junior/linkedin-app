/**
 * Modèles de séquences de campagne — source unique partagée par le wizard client
 * (GET /api/campaigns/templates) et par Bleadin IA.
 * `VISIT` est conservé tel quel : CreateCampaignSchema le normalise en VISIT_PROFILE.
 */

export type TemplateActionType = "INVITATION" | "MESSAGE" | "VISIT" | "FOLLOW" | "DELAY";

export interface SequenceTemplateStep {
  actionType: TemplateActionType;
  delayDays: number;
  defaultMessage: string;
  label: string;
}

export interface SequenceTemplate {
  id: string;
  title: string;
  badge?: string;
  badgeColor?: string;
  description: string;
  recommendedFor: string;
  image: string;
  popularity?: string;
  steps: SequenceTemplateStep[];
}

export const CAMPAIGN_TEMPLATES: SequenceTemplate[] = [
  {
    id: "INVITE_AND_3_MESSAGES",
    title: "Invitation + 3 messages",
    image: "/campagnes_images/01_invitation_3_messages.png",
    popularity: "44.4K",
    description:
      "Séquence de prospection complète avec 1 invitation et 3 relances de valeur. Arrêt automatique garanti dès que le prospect répond.",
    recommendedFor: "Prospection commerciale B2B & Nurturing intensif de décideurs",
    steps: [
      {
        actionType: "INVITATION",
        delayDays: 0,
        label: "Demande de connexion",
        defaultMessage:
          "Bonjour {{firstName}}, j'ai découvert votre profil chez {{company}} et vos réalisations ont retenu mon attention. Au plaisir d'échanger avec vous !",
      },
      {
        actionType: "MESSAGE",
        delayDays: 1,
        label: "Message 1 (Bienvenue)",
        defaultMessage:
          "Merci pour votre connexion {{firstName}} ! Quel est votre principal défi actuellement chez {{company}} ?",
      },
      {
        actionType: "MESSAGE",
        delayDays: 3,
        label: "Message 2 (Partage de valeur)",
        defaultMessage:
          "Bonjour {{firstName}}, j'ai pensé à vous suite à un retour d'expérience récent sur des problématiques similaires à {{company}}. Seriez-vous curieux d'en discuter brièvement ?",
      },
      {
        actionType: "MESSAGE",
        delayDays: 4,
        label: "Message 3 (Relance de rupture)",
        defaultMessage:
          "Bonjour {{firstName}}, je ne souhaite pas être insistant. Si le sujet n'est pas prioritaire en ce moment, aucun souci ! Au plaisir de suivre vos actualités sur LinkedIn.",
      },
    ],
  },
  {
    id: "VISIT_FOLLOW_INVITE",
    title: "Visite + Follow + Invitation",
    image: "/campagnes_images/02_visite_follow_invitation.png",
    popularity: "28.1K",
    description:
      "Stratégie multi-touch : consulte le profil le Jour J, s'abonne à ses publications à J+1, puis envoie l'invitation à J+2 avec un taux d'acceptation record.",
    recommendedFor: "Grands comptes, Cadres dirigeants & Cibles très sollicitées",
    steps: [
      { actionType: "VISIT", delayDays: 0, label: "Visite de profil", defaultMessage: "" },
      { actionType: "FOLLOW", delayDays: 1, label: "Suivre le profil", defaultMessage: "" },
      {
        actionType: "INVITATION",
        delayDays: 1,
        label: "Demande de connexion",
        defaultMessage:
          "Bonjour {{firstName}}, je suis vos actualités et vos partages chez {{company}} avec grand intérêt. Au plaisir de vous compter parmi mon réseau !",
      },
    ],
  },
  {
    id: "VISIT_INVITE_1_MESSAGE",
    title: "Visite + Invitation + 1 message",
    image: "/campagnes_images/03_visite_invitation_1_message.png",
    popularity: "118.5K",
    description:
      "Préchauffez votre prospect par une consultation de son profil, puis envoyez l'invitation et un premier message d'introduction dès acceptation.",
    recommendedFor: "Prospection consultative, Consulting & Freelances",
    steps: [
      { actionType: "VISIT", delayDays: 0, label: "Visite de profil", defaultMessage: "" },
      {
        actionType: "INVITATION",
        delayDays: 1,
        label: "Demande de connexion",
        defaultMessage:
          "Bonjour {{firstName}}, j'ai visité votre profil et votre activité chez {{company}} m'a particulièrement interpellé. Connectons-nous !",
      },
      {
        actionType: "MESSAGE",
        delayDays: 1,
        label: "Message de présentation",
        defaultMessage:
          "Ravi d'être en relation {{firstName}} ! Seriez-vous ouvert à échanger sur vos priorités actuelles chez {{company}} ?",
      },
    ],
  },
  {
    id: "INVITE_AND_FOLLOWUPS",
    title: "Connexion & Double Relance",
    image: "/campagnes_images/06_invitation_2_messages.png",
    popularity: "376.4K",
    description: "Envoie une invitation ciblée, puis 2 messages espacés dès que le contact accepte la relation.",
    recommendedFor: "Prospection commerciale B2B & Génération de leads",
    steps: [
      {
        actionType: "INVITATION",
        delayDays: 0,
        label: "Demande de connexion",
        defaultMessage:
          "Bonjour {{firstName}}, j'ai découvert votre profil et votre activité chez {{company}}. Au plaisir d'échanger avec vous !",
      },
      {
        actionType: "MESSAGE",
        delayDays: 1,
        label: "Message 1 (Bienvenue)",
        defaultMessage:
          "Merci pour votre connexion {{firstName}} ! Je serais ravi de découvrir vos défis actuels chez {{company}}.",
      },
      {
        actionType: "MESSAGE",
        delayDays: 3,
        label: "Message 2 (Relance de valeur)",
        defaultMessage:
          "{{firstName}}, avez-vous eu l'opportunité de regarder mon précédent message ? Nous aidons les entreprises comme {{company}} à optimiser leur acquisition.",
      },
    ],
  },
  {
    id: "SOFT_INVITE",
    title: "Invitation Douce sans note",
    image: "/campagnes_images/05_invitation.png",
    popularity: "92.3K",
    description:
      "Invitation sans message d'accroche (recommandé pour un taux d'acceptation optimal), suivie d'un premier message.",
    recommendedFor: "Recrutement, Réseau & Prospection discrète",
    steps: [
      { actionType: "INVITATION", delayDays: 0, label: "Demande de connexion sans note", defaultMessage: "" },
      {
        actionType: "MESSAGE",
        delayDays: 1,
        label: "Message de présentation",
        defaultMessage:
          "Bonjour {{firstName}}, ravi de faire partie de votre réseau ! Quel est votre projet phare en ce moment chez {{company}} ?",
      },
    ],
  },
  {
    id: "DIRECT_MESSAGES",
    title: "Message Direct (Contacts 1er degré)",
    image: "/campagnes_images/04_message_direct.png",
    popularity: "65.2K",
    description:
      "Contacte directement les prospects qui font déjà partie de votre réseau LinkedIn avec une relance automatique.",
    recommendedFor: "Réactivation de réseau, Invités webinar & Newsletters",
    steps: [
      {
        actionType: "MESSAGE",
        delayDays: 0,
        label: "Message initial",
        defaultMessage:
          "Bonjour {{firstName}}, je me permets de vous contacter car j'ai suivi vos actualités chez {{company}}...",
      },
      {
        actionType: "MESSAGE",
        delayDays: 4,
        label: "Relance douce",
        defaultMessage:
          "Bonjour {{firstName}}, je relance brièvement mon message précédent au cas où il serait passé inaperçu.",
      },
    ],
  },
];

export function findCampaignTemplate(id: string | undefined | null): SequenceTemplate | undefined {
  if (!id) return undefined;
  const wanted = id.trim().toUpperCase();
  return CAMPAIGN_TEMPLATES.find((t) => t.id === wanted);
}
