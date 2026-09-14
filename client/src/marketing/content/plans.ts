/**
 * Source unique de la grille tarifaire côté client.
 * Utilisée par la page /tarifs, l'aperçu tarifs de l'accueil et l'onglet Facturation.
 * Le serveur (settings.controller.ts) porte la même grille pour les factures.
 */

export type PlanId = "STARTER" | "PRO" | "BUSINESS";

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
  };
  /** Arguments courts affichés sur les cartes. */
  pitch: string[];
}

export const ANNUAL_DISCOUNT = 0.2;
export const CURRENCY_SYMBOL = "$";

export const PLANS: Plan[] = [
  {
    id: "STARTER",
    name: "Starter",
    audience: "Pour démarrer seul, proprement.",
    monthly: 19,
    annual: 15,
    limits: { linkedinAccounts: 1, seats: 1, prospects: 1_000, activeCampaigns: 3 },
    pitch: [
      "1 compte LinkedIn",
      "3 campagnes actives",
      "1 000 prospects",
      "Inbox unifiée",
      "Imports CSV et XLSX",
    ],
  },
  {
    id: "PRO",
    name: "Pro",
    audience: "Pour prospecter chaque jour, en volume.",
    monthly: 40,
    annual: 32,
    highlighted: true,
    limits: { linkedinAccounts: 1, seats: 3, prospects: 10_000, activeCampaigns: -1 },
    pitch: [
      "1 compte LinkedIn, 3 sièges",
      "Campagnes illimitées",
      "10 000 prospects",
      "Rapports et enrichissement",
      "Clé API",
    ],
  },
  {
    id: "BUSINESS",
    name: "Business",
    audience: "Pour les équipes et les agences.",
    monthly: 70,
    annual: 56,
    limits: { linkedinAccounts: 3, seats: 10, prospects: 50_000, activeCampaigns: -1 },
    pitch: [
      "3 comptes LinkedIn, 10 sièges",
      "Campagnes illimitées",
      "50 000 prospects",
      "Espaces de travail multiples",
      "Intégrations et support prioritaire",
    ],
  },
];

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
      { label: "Comptes LinkedIn", values: { STARTER: "1", PRO: "1", BUSINESS: "3" } },
      { label: "Sièges", values: { STARTER: "1", PRO: "3", BUSINESS: "10" } },
      { label: "Prospects", values: { STARTER: "1 000", PRO: "10 000", BUSINESS: "50 000" } },
      { label: "Campagnes actives", values: { STARTER: "3", PRO: "Illimitées", BUSINESS: "Illimitées" } },
    ],
  },
  {
    title: "Prospection",
    rows: [
      { label: "Séquences invitation, message, visite, suivi", values: { STARTER: true, PRO: true, BUSINESS: true } },
      { label: "Modèles de séquences", values: { STARTER: true, PRO: true, BUSINESS: true } },
      { label: "Variables de personnalisation", values: { STARTER: true, PRO: true, BUSINESS: true } },
      { label: "Détection des invitations acceptées", values: { STARTER: true, PRO: true, BUSINESS: true } },
      { label: "Enrichissement des profils", values: { STARTER: false, PRO: true, BUSINESS: true } },
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
      { label: "Quotas journaliers", values: { STARTER: true, PRO: true, BUSINESS: true } },
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
