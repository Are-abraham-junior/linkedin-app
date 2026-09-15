import type { PlanId } from "./plans";

export interface Audience {
  id: string;
  short: string;
  title: string;
  pain: string;
  change: string[];
  sequence: { name: string; file: string };
  /** Photo de personne illustrant le métier, servie depuis client/public/audiences/. */
  photo: { file: string; alt: string; position: string };
  plan: PlanId;
}

export const AUDIENCES: Audience[] = [
  {
    id: "commerciaux",
    short: "Commerciaux et SDR",
    title: "Pour les commerciaux et SDR qui doivent tenir un volume chaque semaine.",
    pain:
      "Cinquante invitations par jour, des relances à ne pas oublier, et un manager qui attend des rendez-vous. Le temps passé à cliquer n'est pas du temps passé à vendre.",
    change: [
      "Les invitations et relances partent chaque jour ouvré, aux heures que vous avez fixées, sans que vous y pensiez.",
      "Chaque réponse vous est remise dans l'inbox avec la campagne d'origine, prête à être traitée.",
      "Les rapports montrent le taux d'acceptation et de réponse par campagne : vous ajustez le message, pas la cadence.",
    ],
    sequence: { name: "Visite, invitation, message", file: "03_visite_invitation_1_message.png" },
    photo: { file: "commerciaux.jpg", alt: "Commerciale debout devant une fenêtre de bureau, ordinateur portable en main", position: "center 28%" },
    plan: "PRO",
  },
  {
    id: "fondateurs",
    short: "Fondateurs et indépendants",
    title: "Pour les fondateurs et indépendants qui prospectent entre deux livraisons.",
    pain:
      "La prospection est la première chose qui saute quand une mission ou un produit réclame de l'attention. Le pipeline se vide en silence.",
    change: [
      "Une séquence configurée en dix minutes tourne pendant des semaines et alimente le pipeline sans intervention.",
      "Trois campagnes actives suffisent pour tester un message par cible et garder ce qui marche.",
      "Les quotas conservateurs par défaut protègent le compte que vous utilisez aussi pour votre marque personnelle.",
    ],
    sequence: { name: "Invitation et deux messages", file: "06_invitation_2_messages.png" },
    photo: { file: "fondateurs.jpg", alt: "Fondateur attablé dans un café, téléphone et carnet posés devant lui", position: "center 40%" },
    plan: "STARTER",
  },
  {
    id: "agences",
    short: "Agences",
    title: "Pour les agences qui prospectent au nom de plusieurs clients.",
    pain:
      "Un compte LinkedIn par client, des listes qui se mélangent, et l'obligation de prouver ce qui a été fait chaque mois.",
    change: [
      "Un espace de travail par client, avec ses propres comptes, listes, campagnes et rapports. Vous passez de l'un à l'autre sans vous déconnecter.",
      "Chaque compte LinkedIn a ses quotas et ses horaires : un client à Paris, un autre à Montréal, chacun dans son fuseau.",
      "Les rapports s'exportent en PDF pour être joints au bilan mensuel.",
    ],
    sequence: { name: "Invitation et trois messages", file: "01_invitation_3_messages.png" },
    photo: { file: "agences.jpg", alt: "Équipe d'agence au travail autour d'une table, chacun sur son ordinateur", position: "center 45%" },
    plan: "BUSINESS",
  },
  {
    id: "recruteurs",
    short: "Recruteurs",
    title: "Pour les recruteurs qui approchent des candidats en poste.",
    pain:
      "Les meilleurs profils ne postulent pas. Il faut les approcher un par un, avec un message qui ne ressemble pas à un envoi en masse.",
    change: [
      "La visite de profil précède l'invitation : le candidat voit qui s'intéresse à lui avant de recevoir une demande.",
      "Les variables de personnalisation reprennent le titre et l'entreprise actuels du candidat dans le message.",
      "Les comptes Recruiter et Sales Navigator sont pris en charge, avec leurs quotas propres.",
    ],
    sequence: { name: "Visite, suivi, invitation", file: "02_visite_follow_invitation.png" },
    photo: { file: "recruteurs.jpg", alt: "Recruteuse souriante devant les parois vitrées d'une salle de réunion", position: "center 30%" },
    plan: "PRO",
  },
];
