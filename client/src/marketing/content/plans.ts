/**
 * Source unique de la grille tarifaire côté client.
 * Utilisée par la page /tarifs, l'aperçu tarifs de l'accueil et l'onglet Facturation.
 * Le serveur (settings.controller.ts) porte la même grille pour les factures.
 */

export type PlanId = "STARTER" | "PRO" | "BUSINESS";

export type ActionKind = "invites" | "messages" | "visits" | "follows";

/** Quota par compte LinkedIn : semaine (lundi → dimanche) et mois civil. */
export interface QuotaWindow {
  week: number;
  month: number;
}

export interface Plan {
  id: PlanId;
  name: string;
  audience: string;
  monthly: number;
  /** Prix mensuel équivalent en engagement annuel (−20 %, arrondi). */
  annual: number;
  highlighted?: boolean;
  limits: {
    linkedinAccounts: number;
    seats: number;
    prospects: number;
    /** -1 = illimité */
    activeCampaigns: number;
    /** Tokens d'enrichissement (e-mail / téléphone) par mois civil, partagés par l'organisation. */
    enrichmentTokens: number;
    /**
     * Quotas d'actions LinkedIn. Le journalier n'est jamais affiché : il est
     * réparti automatiquement et aléatoirement par le serveur (quota.service.ts)
     * pour ne pas produire de motif régulier détectable par LinkedIn.
     */
    actions: Record<ActionKind, QuotaWindow>;
    /** Visites pour un compte LinkedIn standard (sans Sales Navigator/Recruiter), si différent. */
    visitsStandard?: QuotaWindow;
  };
  /** Arguments courts affichés sur les cartes. */
  pitch: string[];
}

export const ANNUAL_DISCOUNT = 0.2;
export const CURRENCY_SYMBOL = "$";

/** Coût en tokens d'une coordonnée trouvée (restituée si introuvable). Miroir de server/src/config/plans.ts. */
export const ENRICHMENT_COST = { email: 1, phone: 5 } as const;

export const ACTION_LABELS: Record<ActionKind, string> = {
  invites: "Invitations",
  messages: "Messages",
  visits: "Visites de profil",
  follows: "Suivis de profil",
};

export const PLANS: Plan[] = [
  {
    id: "STARTER",
    name: "Starter",
    audience: "Pour démarrer seul, proprement.",
    monthly: 22,
    annual: 18,
    limits: {
      linkedinAccounts: 1,
      seats: 1,
      prospects: 1_000,
      activeCampaigns: -1,
      enrichmentTokens: 20,
      actions: {
        invites: { week: 100, month: 400 },
        messages: { week: 250, month: 1_000 },
        visits: { week: 250, month: 1_000 },
        follows: { week: 150, month: 600 },
      },
    },
    pitch: [
      "1 compte LinkedIn",
      "400 invitations / mois",
      "1 000 messages envoyés",
      "Campagnes illimitées",
      "1 000 prospects",
      "20 tokens d'enrichissement / mois",
      "Inbox unifiée, imports CSV et XLSX",
    ],
  },
  {
    id: "PRO",
    name: "Pro",
    audience: "Pour prospecter chaque jour, en volume.",
    monthly: 40,
    annual: 32,
    highlighted: true,
    limits: {
      linkedinAccounts: 1,
      seats: 5,
      prospects: 10_000,
      activeCampaigns: -1,
      enrichmentTokens: 50,
      actions: {
        invites: { week: 150, month: 600 },
        messages: { week: 400, month: 1_600 },
        visits: { week: 400, month: 1_600 },
        follows: { week: 300, month: 1_200 },
      },
    },
    pitch: [
      "1 compte LinkedIn, 5 sièges",
      "600 invitations / mois",
      "1 600 messages envoyés",
      "Campagnes illimitées",
      "10 000 prospects",
      "50 tokens d'enrichissement / mois",
      "Rapports, clé API",
    ],
  },
  {
    id: "BUSINESS",
    name: "Business",
    audience: "Pour les équipes et les agences.",
    monthly: 70,
    annual: 56,
    limits: {
      linkedinAccounts: 1,
      seats: 10,
      prospects: 50_000,
      activeCampaigns: -1,
      enrichmentTokens: 100,
      actions: {
        invites: { week: 200, month: 800 },
        messages: { week: 600, month: 2_400 },
        visits: { week: 600, month: 2_400 },
        follows: { week: 400, month: 1_600 },
      },
      visitsStandard: { week: 400, month: 1_600 },
    },
    pitch: [
      "1 compte LinkedIn, 10 sièges",
      "800 invitations / mois ",
      "2 400 messages envoyés",
      "Campagnes illimitées",
      "50 000 prospects",
      "100 tokens d'enrichissement / mois",
      "Espaces multiples, intégrations, support prioritaire",
    ],
  },
];

/** Format « 400 / mois ». */
export function formatQuota(q: QuotaWindow): string {
  return `${q.month.toLocaleString("fr-FR")} / mois`;
}

function quotaRow(kind: ActionKind): ComparisonRow {
  const values = {} as Record<PlanId, string>;
  for (const p of PLANS) {
    values[p.id] = formatQuota(p.limits.actions[kind]);
  }
  return { label: ACTION_LABELS[kind], values };
}

/** Lignes du tableau comparatif. `true`/`false` ou texte libre par plan. */
export interface ComparisonRow {
  label: string;
  values: Record<PlanId, string | boolean>;
}

export interface ComparisonGroup {
  title: string;
  rows: ComparisonRow[];
}

export const COMPARISON: ComparisonGroup[] = [
  {
    title: "Volumes",
    rows: [
      { label: "Comptes LinkedIn", values: { STARTER: "1", PRO: "1", BUSINESS: "1" } },
      { label: "Sièges", values: { STARTER: false, PRO: "5", BUSINESS: "10" } },
      { label: "Prospects", values: { STARTER: "1 000", PRO: "10 000", BUSINESS: "50 000" } },
      { label: "Campagnes actives", values: { STARTER: "Illimitées", PRO: "Illimitées", BUSINESS: "Illimitées" } },
    ],
  },
  {
    title: "Actions LinkedIn (par compte)",
    rows: [quotaRow("invites"), quotaRow("messages"), quotaRow("visits"), quotaRow("follows")],
  },
  {
    title: "Prospection",
    rows: [
      { label: "Séquences invitation, message, visite, suivi", values: { STARTER: true, PRO: true, BUSINESS: true } },
      { label: "Modèles de séquences", values: { STARTER: true, PRO: true, BUSINESS: true } },
      { label: "Variables de personnalisation", values: { STARTER: true, PRO: true, BUSINESS: true } },
      { label: "Détection des invitations acceptées", values: { STARTER: true, PRO: true, BUSINESS: true } },
      { label: "Tokens d'enrichissement e-mail / téléphone", values: { STARTER: "20 / mois", PRO: "50 / mois", BUSINESS: "100 / mois" } },
    ],
  },
  {
    title: "Données",
    rows: [
      { label: "Imports CSV et XLSX avec dédoublonnage", values: { STARTER: true, PRO: true, BUSINESS: true } },
      { label: "Inbox unifiée", values: { STARTER: true, PRO: true, BUSINESS: true } },
      { label: "Rapports", values: { STARTER: false, PRO: true, BUSINESS: true } },
      { label: "Clé API", values: { STARTER: false, PRO: true, BUSINESS: true } },
      { label: "Intégrations", values: { STARTER: false, PRO: false, BUSINESS: true } },
    ],
  },
  {
    title: "Sécurité du compte",
    rows: [
      { label: "Répartition journalière aléatoire des actions", values: { STARTER: true, PRO: true, BUSINESS: true } },
      { label: "Montée en charge progressive des nouveaux comptes", values: { STARTER: true, PRO: true, BUSINESS: true } },
      { label: "Plafonds de sécurité LinkedIn (200 invitations / semaine)", values: { STARTER: true, PRO: true, BUSINESS: true } },
      { label: "Horaires et fuseau de travail", values: { STARTER: true, PRO: true, BUSINESS: true } },
      { label: "Pause automatique sur déconnexion", values: { STARTER: true, PRO: true, BUSINESS: true } },
    ],
  },
  {
    title: "Équipe",
    rows: [
      { label: "Espaces de travail multiples", values: { STARTER: false, PRO: false, BUSINESS: true } },
      { label: "Rôles et invitations", values: { STARTER: false, PRO: true, BUSINESS: true } },
      { label: "Support", values: { STARTER: "E-mail", PRO: "E-mail", BUSINESS: "Prioritaire" } },
    ],
  },
];

export const PRICING_FAQ = [
  {
    q: "Puis-je changer d'offre en cours de route ?",
    a: "Oui, à tout moment. Le passage à une offre supérieure est immédiat ; le passage à une offre inférieure prend effet à la prochaine échéance.",
  },
  {
    q: "Que se passe-t-il si je dépasse mon nombre de prospects ?",
    a: "Vos campagnes continuent de tourner sur les prospects déjà importés. Les nouveaux imports sont bloqués jusqu'à ce que vous passiez à l'offre supérieure ou libériez de la place.",
  },
  {
    q: "Comment fonctionnent les tokens d'enrichissement ?",
    a: "Un token d'enrichissement sert à révéler les coordonnées d'un prospect : 1 token pour un e-mail trouvé, 5 tokens pour un numéro de téléphone trouvé. Si la coordonnée n'est pas disponible, les tokens réservés vous sont restitués. Vous recevez 20, 50 ou 100 tokens selon votre offre, renouvelés chaque mois et partagés par toute votre équipe.",
  },
  {
    q: "Pourquoi les quotas sont-ils exprimés par semaine et par mois, et non par jour ?",
    a: "LinkedIn plafonne surtout les invitations sur la semaine (environ 200). Bleadin répartit donc votre quota hebdomadaire sur vos jours de travail avec un volume légèrement différent chaque jour, comme le ferait un humain, sans jamais dépasser les maxima recommandés par notre fournisseur d'API. Un compte fraîchement connecté monte en charge progressivement pendant deux semaines. Vous pouvez abaisser vos volumes à tout moment depuis vos réglages.",
  },
  {
    q: "Ai-je besoin d'un compte LinkedIn Premium ou Sales Navigator ?",
    a: "Non. Bleadin fonctionne avec un compte standard. Les comptes Premium, Sales Navigator et Recruiter sont pris en charge et bénéficient de quotas LinkedIn plus larges.",
  },
  {
    q: "Comment fonctionne l'engagement annuel ?",
    a: "Vous réglez douze mois d'un coup avec 20 % de remise. Les prix affichés en annuel correspondent au coût mensuel équivalent.",
  },
  {
    q: "Puis-je résilier ?",
    a: "Oui, depuis les paramètres de votre espace. L'abonnement reste actif jusqu'à la fin de la période déjà réglée, sans frais supplémentaires.",
  },
];

/** Normalise les valeurs héritées de la base (les anciennes organisations ont `ENTERPRISE`). */
export function normalizePlanId(raw: string | null | undefined): PlanId {
  if (raw === "STARTER" || raw === "PRO") return raw;
  return "BUSINESS";
}

export function getPlan(raw: string | null | undefined): Plan {
  const id = normalizePlanId(raw);
  return PLANS.find((p) => p.id === id) ?? PLANS[2];
}

export function planLabel(raw: string | null | undefined): string {
  return getPlan(raw).name;
}

export function formatPrice(amount: number): string {
  return `${amount} ${CURRENCY_SYMBOL}`;
}
