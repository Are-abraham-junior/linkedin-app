import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../../../../lib/prisma.js";
import type { AuthenticatedUser } from "../../middlewares/auth.middleware.js";
import { invokeController } from "./invokeController.js";
import { searchProfiles } from "../../controllers/linkedin.controller.js";
import { getLists, createList } from "../../controllers/list.controller.js";
import { bulkImportProspects } from "../../controllers/prospect.controller.js";
import { createCampaign, getCampaigns } from "../../controllers/campaign.controller.js";
import { CAMPAIGN_TEMPLATES, findCampaignTemplate } from "../../config/campaignTemplates.js";
import { getQuotaSnapshot } from "../quota.service.js";
import { getPlan, normalizePlanId } from "../../config/plans.js";
import { searchKnowledge } from "./knowledge.service.js";
import type { LinkedInProfileResult } from "../unipile.service.js";
import type { ChatToolDefinition } from "./ollama.client.js";

// ─── Espace de travail (état persisté dans AiConversation.workspace) ────────

export interface WorkspaceProfile {
  providerProfileId: string;
  firstName: string;
  lastName: string;
  headline: string;
  company?: string;
  location?: string;
  linkedinUrl: string;
  avatarUrl?: string;
  connectionStatus?: string;
}

export interface DraftStep {
  stepOrder: number;
  actionType: "INVITATION" | "MESSAGE" | "VISIT_PROFILE" | "FOLLOW" | "DELAY";
  delayDays: number;
  messageText: string | null;
}

export interface AgentWorkspace {
  lastSearch?: { query: string; profiles: WorkspaceProfile[]; totalCount: number; excludedCount: number; at: string };
  currentList?: { id: string; name: string; prospectsCount: number };
  draft?: { campaignId: string; name: string; templateId?: string; steps: DraftStep[]; listIds: string[] };
  pendingConfirmation?: { token: string; campaignId: string; expiresAt: string };
}

export type AgentCard =
  | { type: "profiles"; query: string; totalCount: number; excludedCount: number; profiles: WorkspaceProfile[] }
  | { type: "list"; list: { id: string; name: string; prospectsCount: number }; imported?: number; duplicates?: number }
  | {
      type: "campaign_proposal";
      campaign: { id: string; name: string; steps: DraftStep[]; listId: string | null; listName: string | null; prospectsCount: number };
    }
  | { type: "confirm_launch"; token: string; campaignId: string; summary: { name: string; listName: string | null; prospectsCount: number; steps: DraftStep[] } }
  | { type: "launch_result"; campaignId: string; name: string; prospectsEnrolled: number }
  | { type: "account_status"; connected: boolean; accountName: string | null; accountType: string | null; plan: string; quotas: Array<{ kind: string; label: string; usedToday: number; target: number; usedWeek: number; limitWeek: number; usedMonth: number; limitMonth: number }>; warmup: { active: boolean; dayIndex: number; totalDays: number } | null };

export interface ToolContext {
  user: AuthenticatedUser;
  workspace: AgentWorkspace;
}

export interface ToolOutcome {
  /** Contenu compact renvoyé au modèle. */
  result: unknown;
  card?: AgentCard;
  workspacePatch?: Partial<AgentWorkspace>;
  ok: boolean;
}

export interface AgentTool {
  name: string;
  label: string;
  description: string;
  parameters: Record<string, unknown>;
  schema: z.ZodTypeAny;
  execute(ctx: ToolContext, args: any): Promise<ToolOutcome>;
}

// ─── Utilitaires ────────────────────────────────────────────────────────────

const ALLOWED_VARIABLES = ["firstName", "lastName", "company", "headline"];
const INVITATION_MAX = 300;
const MESSAGE_MAX = 1900;

export function validateStepMessages(steps: DraftStep[]): string | null {
  for (const step of steps) {
    const text = step.messageText || "";
    const vars = Array.from(text.matchAll(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g)).map((m) => m[1]);
    const invalid = vars.filter((v) => !ALLOWED_VARIABLES.includes(v));
    if (invalid.length) {
      return `Variable(s) non supportée(s) : ${invalid.map((v) => `{{${v}}}`).join(", ")}. Variables autorisées : ${ALLOWED_VARIABLES.map((v) => `{{${v}}}`).join(", ")}.`;
    }
    if (step.actionType === "INVITATION" && text.length > INVITATION_MAX) {
      return `La note d'invitation de l'étape ${step.stepOrder} fait ${text.length} caractères (maximum ${INVITATION_MAX}). Raccourcis-la.`;
    }
    if (step.actionType === "MESSAGE") {
      if (!text.trim()) return `L'étape ${step.stepOrder} (MESSAGE) doit contenir un texte.`;
      if (text.length > MESSAGE_MAX) return `Le message de l'étape ${step.stepOrder} dépasse ${MESSAGE_MAX} caractères.`;
    }
  }
  return null;
}

function fail(message: string): ToolOutcome {
  return { ok: false, result: { error: message, actionDone: false } };
}

function toWorkspaceProfile(p: LinkedInProfileResult): WorkspaceProfile {
  return {
    providerProfileId: p.providerProfileId,
    firstName: p.firstName,
    lastName: p.lastName,
    headline: p.headline,
    company: p.company,
    location: p.location,
    linkedinUrl: p.linkedinUrl,
    avatarUrl: p.avatarUrl,
    connectionStatus: p.connectionStatus,
  };
}

const coerceInt = (min: number, max: number, def: number) =>
  z.preprocess((v) => {
    if (v === undefined || v === null || v === "") return def;
    const n = typeof v === "number" ? v : parseInt(String(v), 10);
    return Number.isFinite(n) ? n : def;
  }, z.number().int().min(min).max(max));

const optionalText = z.preprocess((v) => (v === null || v === undefined ? undefined : String(v).trim() || undefined), z.string().optional());

const indexesSchema = z.preprocess((v) => {
  if (v === undefined || v === null || v === "" || v === "all" || v === "ALL" || v === "*") return "all";
  if (Array.isArray(v)) return v.map((x) => parseInt(String(x), 10)).filter((n) => Number.isFinite(n));
  if (typeof v === "string") {
    return v
      .split(/[\s,;]+/)
      .map((x) => parseInt(x, 10))
      .filter((n) => Number.isFinite(n));
  }
  if (typeof v === "number") return [v];
  return "all";
}, z.union([z.literal("all"), z.array(z.number().int())]));

const stepsSchema = z
  .array(
    z.object({
      actionType: z.preprocess(
        (v) => String(v || "").toUpperCase().replace("VISIT_PROFILE", "VISIT_PROFILE").replace(/^VISIT$/, "VISIT_PROFILE"),
        z.enum(["INVITATION", "MESSAGE", "VISIT_PROFILE", "FOLLOW", "DELAY"])
      ),
      delayDays: coerceInt(0, 60, 0),
      messageText: z.preprocess((v) => (v === null || v === undefined ? null : String(v)), z.string().nullable()),
    })
  )
  .min(1)
  .max(8);

async function loadListSummary(user: AuthenticatedUser, listId: string) {
  const res = await invokeController<{ success: boolean; lists?: any[] }>(getLists, user);
  const list = (res.body.lists || []).find((l: any) => l.id === listId);
  return list ? { id: list.id as string, name: list.name as string, prospectsCount: Number(list.prospectsCount || 0) } : null;
}

// ─── Outils ─────────────────────────────────────────────────────────────────

const searchLinkedinProfiles: AgentTool = {
  name: "search_linkedin_profiles",
  label: "Recherche de profils LinkedIn",
  description:
    "Recherche des personnes sur LinkedIn avec le compte de l'utilisateur. Donne le titre/poste (ex: 'Directeur Général'), le lieu (ex: 'Côte d'Ivoire') et des mots-clés (ex: 'pétrole gaz'). limit = nombre de profils voulus (max 50).",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Poste ou fonction recherchée, ex: 'Directeur Général'" },
      location: { type: "string", description: "Pays ou ville, ex: 'Côte d'Ivoire'" },
      keywords: { type: "string", description: "Secteur ou mots-clés, ex: 'pétrole', 'banque'" },
      company: { type: "string", description: "Nom d'entreprise (optionnel)" },
      limit: { type: "integer", description: "Nombre de profils (1-50), défaut 10" },
    },
    required: ["limit"],
  },
  schema: z.object({
    title: optionalText,
    location: optionalText,
    keywords: optionalText,
    company: optionalText,
    limit: coerceInt(1, 50, 10),
  }),
  async execute(ctx, args) {
    if (!args.title && !args.keywords && !args.company && !args.location) {
      return fail("Précise au moins un poste, un secteur/mot-clé ou une entreprise.");
    }
    const res = await invokeController<any>(searchProfiles, ctx.user, {
      body: { title: args.title, location: args.location, keywords: args.keywords, company: args.company, limit: args.limit },
    });
    if (!res.body?.success) return fail(res.body?.error || "La recherche LinkedIn a échoué.");

    const profiles: WorkspaceProfile[] = (res.body.profiles || []).map(toWorkspaceProfile);
    const query = [args.title, args.keywords, args.company, args.location].filter(Boolean).join(" · ");
    const sample = profiles.slice(0, 10).map((p, i) => `${i + 1}. ${p.firstName} ${p.lastName} — ${p.headline}${p.company ? ` @ ${p.company}` : ""}${p.location ? ` (${p.location})` : ""}`);

    return {
      ok: true,
      result: {
        found: profiles.length,
        totalOnLinkedIn: res.body.totalCount || null,
        alreadyInProspects: res.body.excludedCount || 0,
        sample,
        note:
          profiles.length === 0
            ? "Aucun profil. Propose d'élargir les critères (retirer le secteur ou la ville)."
            : "Les profils complets sont affichés à l'utilisateur dans une carte. Présente brièvement les résultats et propose de les ajouter à une liste (nouvelle ou existante).",
      },
      card: { type: "profiles", query, totalCount: res.body.totalCount || profiles.length, excludedCount: res.body.excludedCount || 0, profiles },
      workspacePatch: { lastSearch: { query, profiles, totalCount: res.body.totalCount || profiles.length, excludedCount: res.body.excludedCount || 0, at: new Date().toISOString() } },
    };
  },
};

const getProspectLists: AgentTool = {
  name: "get_prospect_lists",
  label: "Lecture des listes de prospects",
  description: "Liste les listes de prospects existantes de l'utilisateur (id, nom, nombre de prospects).",
  parameters: { type: "object", properties: {} },
  schema: z.object({}).passthrough(),
  async execute(ctx) {
    const res = await invokeController<any>(getLists, ctx.user);
    if (!res.body?.success) return fail(res.body?.error || "Impossible de lire les listes.");
    const lists = (res.body.lists || []).map((l: any) => ({ id: l.id, name: l.name, prospectsCount: l.prospectsCount }));
    return { ok: true, result: { count: lists.length, lists: lists.slice(0, 30) } };
  },
};

const createProspectList: AgentTool = {
  name: "create_prospect_list",
  label: "Création d'une liste",
  description: "Crée une nouvelle liste de prospects et la définit comme liste courante. Donne un nom explicite, ex: 'DG pétrole Côte d'Ivoire'.",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "Nom de la liste" },
      description: { type: "string", description: "Description courte (optionnel)" },
    },
    required: ["name"],
  },
  schema: z.object({ name: z.preprocess((v) => String(v ?? "").trim(), z.string().min(1).max(120)), description: optionalText }),
  async execute(ctx, args) {
    const res = await invokeController<any>(createList, ctx.user, { body: { name: args.name, description: args.description } });
    if (!res.body?.success) return fail(res.body?.error || "Impossible de créer la liste.");
    const list = { id: res.body.list.id as string, name: res.body.list.name as string, prospectsCount: 0 };
    return {
      ok: true,
      result: { created: true, list, note: "Liste créée et sélectionnée. Si une recherche est en cours, propose d'y ajouter les profils." },
      card: { type: "list", list },
      workspacePatch: { currentList: list },
    };
  },
};

async function findListByName(user: AuthenticatedUser, name: string) {
  const res = await invokeController<{ success: boolean; lists?: any[] }>(getLists, user);
  const wanted = name.trim().toLowerCase();
  const list = (res.body.lists || []).find((l: any) => String(l.name).trim().toLowerCase() === wanted);
  return list ? { id: list.id as string, name: list.name as string, prospectsCount: Number(list.prospectsCount || 0) } : null;
}

const addSearchResultsToList: AgentTool = {
  name: "add_search_results_to_list",
  label: "Ajout des profils à la liste",
  description:
    "Ajoute les profils de la dernière recherche à une liste de prospects. listName = nom de la liste (créée automatiquement si elle n'existe pas). indexes = 'all' pour tous les profils, ou numéros séparés par des virgules (ex: '1,3,5').",
  parameters: {
    type: "object",
    properties: {
      listName: { type: "string", description: "Nom de la liste cible, ex: 'DG pétrole Côte d'Ivoire' (créée si absente)" },
      indexes: { type: "string", description: "'all' ou numéros séparés par des virgules, ex: '1,3,5'" },
      listId: { type: "string", description: "Id d'une liste existante (optionnel)" },
    },
    required: ["indexes"],
  },
  schema: z.object({ listId: optionalText, listName: optionalText, indexes: indexesSchema }),
  async execute(ctx, args) {
    const search = ctx.workspace.lastSearch;
    if (!search || search.profiles.length === 0) return fail("Aucune recherche récente : lance d'abord une recherche de profils.");

    let listId = args.listId as string | undefined;
    let createdList: { id: string; name: string; prospectsCount: number } | null = null;
    if (!listId && args.listName) {
      const existing = await findListByName(ctx.user, args.listName);
      if (existing) {
        listId = existing.id;
      } else {
        const created = await invokeController<any>(createList, ctx.user, { body: { name: args.listName } });
        if (!created.body?.success) return fail(created.body?.error || "Impossible de créer la liste.");
        createdList = { id: created.body.list.id, name: created.body.list.name, prospectsCount: 0 };
        listId = createdList.id;
      }
    }
    if (!listId) listId = ctx.workspace.currentList?.id;
    if (!listId) return fail("Aucune liste indiquée : rappelle cet outil avec listName (nom de la liste à créer) et indexes.");

    const selected =
      args.indexes === "all"
        ? search.profiles
        : (args.indexes as number[]).map((i) => search.profiles[i - 1]).filter((p): p is WorkspaceProfile => Boolean(p));
    if (selected.length === 0) return fail("Aucun profil ne correspond aux numéros indiqués.");

    const res = await invokeController<any>(bulkImportProspects, ctx.user, {
      body: {
        listId,
        source: "BLEADIN_IA",
        prospects: selected.map((p) => ({
          firstName: p.firstName,
          lastName: p.lastName,
          linkedinUrl: p.linkedinUrl,
          providerProfileId: p.providerProfileId,
          headline: p.headline,
          company: p.company,
          location: p.location,
          avatarUrl: p.avatarUrl,
          connectionStatus: p.connectionStatus || "NOT_CONNECTED",
          tags: ["Bleadin IA"],
        })),
      },
    });
    if (!res.body?.success) return fail(res.body?.error || "L'ajout à la liste a échoué.");

    const list = (await loadListSummary(ctx.user, listId)) || { id: listId, name: createdList?.name || ctx.workspace.currentList?.name || "Liste", prospectsCount: res.body.createdCount || 0 };
    return {
      ok: true,
      result: {
        listCreated: Boolean(createdList),
        imported: res.body.createdCount,
        duplicatesIgnored: res.body.duplicateCount,
        list,
        note: "Demande à l'utilisateur l'objectif (rendez-vous, recrutement, partenariat…) ou propose directement une séquence adaptée, sans citer de noms techniques.",
      },
      card: { type: "list", list, imported: res.body.createdCount, duplicates: res.body.duplicateCount },
      workspacePatch: { currentList: list },
    };
  },
};

const getCampaignTemplates: AgentTool = {
  name: "get_campaign_templates",
  label: "Lecture des modèles de séquence",
  description: "Liste les modèles de séquences de campagne disponibles (id, titre, étapes, pour quel usage).",
  parameters: { type: "object", properties: {} },
  schema: z.object({}).passthrough(),
  async execute() {
    return {
      ok: true,
      result: {
        templates: CAMPAIGN_TEMPLATES.map((t) => ({
          id: t.id,
          title: t.title,
          recommendedFor: t.recommendedFor,
          steps: t.steps.map((s) => `${s.actionType === "VISIT" ? "VISIT_PROFILE" : s.actionType} (J+${s.delayDays})`).join(" → "),
        })),
      },
    };
  },
};

function templateToSteps(templateId: string): DraftStep[] | null {
  const tmpl = findCampaignTemplate(templateId);
  if (!tmpl) return null;
  return tmpl.steps.map((s, i) => ({
    stepOrder: i + 1,
    actionType: s.actionType === "VISIT" ? "VISIT_PROFILE" : s.actionType,
    delayDays: s.delayDays,
    messageText: s.defaultMessage || null,
  }));
}

const draftCampaign: AgentTool = {
  name: "draft_campaign",
  label: "Préparation du brouillon de campagne",
  description:
    "Crée ou met à jour le brouillon de campagne pour la liste courante. Donne un nom, un templateId (voir get_campaign_templates) et, si tu as rédigé des messages personnalisés, les étapes complètes (steps). Ne lance rien.",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "Nom de la campagne" },
      templateId: { type: "string", description: "Id du modèle, ex: INVITE_AND_FOLLOWUPS" },
      steps: {
        type: "array",
        description: "Étapes personnalisées (optionnel). Chaque étape: actionType (INVITATION|MESSAGE|VISIT_PROFILE|FOLLOW), delayDays, messageText",
        items: {
          type: "object",
          properties: {
            actionType: { type: "string" },
            delayDays: { type: "integer" },
            messageText: { type: "string" },
          },
        },
      },
      listName: { type: "string", description: "Nom de la liste de prospects ciblée (optionnel si liste courante)" },
    },
    required: ["name"],
  },
  schema: z.object({
    name: z.preprocess((v) => String(v ?? "").trim(), z.string().min(1).max(120)),
    templateId: optionalText,
    steps: z.preprocess((v) => (Array.isArray(v) && v.length ? v : undefined), stepsSchema.optional()),
    listId: optionalText,
    listName: optionalText,
  }),
  async execute(ctx, args) {
    let listId = args.listId || ctx.workspace.currentList?.id;
    if (!listId && args.listName) listId = (await findListByName(ctx.user, args.listName))?.id;
    if (!listId) return fail("Aucune liste sélectionnée pour la campagne : indique listName (nom d'une liste existante).");
    const list = await loadListSummary(ctx.user, listId);
    if (!list) return fail("Cette liste n'existe pas ou n'appartient pas à l'utilisateur.");

    let steps: DraftStep[] | null = null;
    if (args.steps) {
      steps = (args.steps as any[]).map((s, i) => ({ stepOrder: i + 1, actionType: s.actionType, delayDays: s.delayDays, messageText: s.messageText }));
    } else if (args.templateId) {
      steps = templateToSteps(args.templateId);
      if (!steps) return fail(`Modèle inconnu : ${args.templateId}. Modèles valides : ${CAMPAIGN_TEMPLATES.map((t) => t.id).join(", ")}.`);
    } else if (ctx.workspace.draft?.steps?.length) {
      steps = ctx.workspace.draft.steps;
    } else {
      return fail("Indique un templateId ou des steps.");
    }

    const validationError = validateStepMessages(steps);
    if (validationError) return fail(validationError);

    const res = await invokeController<any>(createCampaign, ctx.user, {
      body: {
        id: ctx.workspace.draft?.campaignId,
        name: args.name,
        type: args.templateId || ctx.workspace.draft?.templateId || "CUSTOM",
        listIds: [],
        steps,
        startImmediately: false,
      },
    });
    if (!res.body?.success) return fail(res.body?.error || "Impossible d'enregistrer le brouillon.");

    const campaignId = res.body.campaign.id as string;
    const draft = { campaignId, name: args.name, templateId: args.templateId || ctx.workspace.draft?.templateId, steps, listIds: [list.id] };
    return {
      ok: true,
      result: {
        draftSaved: true,
        campaignId,
        list,
        steps: steps.map((s) => ({ step: s.stepOrder, action: s.actionType, delayDays: s.delayDays, message: s.messageText })),
        note: "Le brouillon est affiché à l'utilisateur avec les messages modifiables. Invite-le à relire les messages et à te dire s'il souhaite lancer la campagne.",
      },
      card: { type: "campaign_proposal", campaign: { id: campaignId, name: args.name, steps, listId: list.id, listName: list.name, prospectsCount: list.prospectsCount } },
      workspacePatch: { draft, currentList: list, pendingConfirmation: undefined },
    };
  },
};

const requestLaunchConfirmation: AgentTool = {
  name: "request_launch_confirmation",
  label: "Demande de confirmation de lancement",
  description:
    "Affiche à l'utilisateur un récapitulatif du brouillon avec un bouton de confirmation. À appeler uniquement quand l'utilisateur demande de lancer la campagne. Le lancement réel n'a lieu qu'après son clic.",
  parameters: { type: "object", properties: {} },
  schema: z.object({}).passthrough(),
  async execute(ctx) {
    const draft = ctx.workspace.draft;
    if (!draft) return fail("Aucun brouillon de campagne : prépare d'abord le brouillon.");
    const listId = draft.listIds[0];
    const list = listId ? await loadListSummary(ctx.user, listId) : null;
    if (!list) return fail("La liste du brouillon est introuvable.");
    if (list.prospectsCount === 0) return fail("La liste est vide : ajoute des prospects avant de lancer.");

    const token = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    return {
      ok: true,
      result: {
        awaitingUserClick: true,
        note: "Une carte de confirmation est affichée. Dis à l'utilisateur de cliquer sur « Confirmer le lancement » et n'appelle plus aucun outil.",
      },
      card: { type: "confirm_launch", token, campaignId: draft.campaignId, summary: { name: draft.name, listName: list.name, prospectsCount: list.prospectsCount, steps: draft.steps } },
      workspacePatch: { pendingConfirmation: { token, campaignId: draft.campaignId, expiresAt } },
    };
  },
};

const getAccountStatus: AgentTool = {
  name: "get_account_status",
  label: "Vérification du compte LinkedIn et des quotas",
  description: "Donne l'état du compte LinkedIn connecté, l'offre de l'utilisateur et les quotas d'actions restants (jour/semaine/mois). À utiliser pour toute question sur les quotas ou avant un lancement.",
  parameters: { type: "object", properties: {} },
  schema: z.object({}).passthrough(),
  async execute(ctx) {
    const user = await prisma.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        maxWeeklyInvites: true,
        maxWeeklyMessages: true,
        maxWeeklyVisits: true,
        maxWeeklyFollows: true,
        workingDays: true,
        workingHoursStart: true,
        workingHoursEnd: true,
        timezone: true,
        organization: { select: { plan: true, name: true } },
      },
    });
    const account = await prisma.linkedInAccount.findFirst({ where: { userId: ctx.user.id }, orderBy: { updatedAt: "desc" } });
    const planId = normalizePlanId(user?.organization?.plan);
    const plan = getPlan(planId);
    const connected = Boolean(account && account.status === "CONNECTED" && account.unipileAccountId);

    if (!account || !connected) {
      return {
        ok: true,
        result: { linkedinConnected: false, plan: plan.name, note: "Le compte LinkedIn n'est pas connecté : l'utilisateur doit le connecter dans Paramètres → LinkedIn avant toute recherche ou campagne." },
        card: { type: "account_status", connected: false, accountName: account?.accountName || null, accountType: account?.accountType || null, plan: plan.name, quotas: [], warmup: null },
      };
    }

    const snapshot = await getQuotaSnapshot({ user: user || {}, account: { id: account.id, accountType: account.accountType, createdAt: account.createdAt }, planRaw: user?.organization?.plan });
    const labels: Record<string, string> = { invites: "Invitations", messages: "Messages", visits: "Visites", follows: "Follows" };
    const quotas = (Object.keys(snapshot.actions) as Array<keyof typeof snapshot.actions>).map((kind) => {
      const a = snapshot.actions[kind];
      return { kind, label: labels[kind], usedToday: a.usedToday, target: a.target, usedWeek: a.usedWeek, limitWeek: a.limitWeek, usedMonth: a.usedMonth, limitMonth: a.limitMonth };
    });

    return {
      ok: true,
      result: {
        linkedinConnected: true,
        accountName: account.accountName,
        accountType: account.accountType || "STANDARD",
        plan: plan.name,
        workingHours: `${(user?.workingDays || []).join(", ")} ${user?.workingHoursStart}-${user?.workingHoursEnd} (${user?.timezone})`,
        warmup: snapshot.warmup.active ? `Montée en charge jour ${snapshot.warmup.dayIndex + 1}/${snapshot.warmup.totalDays}` : "terminée",
        quotas: quotas.map((q) => `${q.label}: aujourd'hui ${q.usedToday}/${q.target}, semaine ${q.usedWeek}/${q.limitWeek}, mois ${q.usedMonth}/${q.limitMonth}`),
      },
      card: { type: "account_status", connected: true, accountName: account.accountName, accountType: account.accountType || "STANDARD", plan: plan.name, quotas, warmup: snapshot.warmup },
    };
  },
};

const getCampaignsOverview: AgentTool = {
  name: "get_campaigns_overview",
  label: "Lecture des campagnes",
  description: "Liste les campagnes de l'utilisateur avec leur statut et leurs statistiques (prospects, acceptations, réponses).",
  parameters: { type: "object", properties: {} },
  schema: z.object({}).passthrough(),
  async execute(ctx) {
    const res = await invokeController<any>(getCampaigns, ctx.user);
    if (!res.body?.success) return fail(res.body?.error || "Impossible de lire les campagnes.");
    const campaigns = (res.body.campaigns || []).slice(0, 20).map((c: any) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      steps: c.stepsCount,
      prospects: c.stats?.totalProspects ?? 0,
      accepted: c.stats?.acceptedCount ?? 0,
      replied: c.stats?.repliedCount ?? 0,
      acceptanceRate: `${c.stats?.acceptanceRate ?? 0}%`,
    }));
    return { ok: true, result: { count: res.body.campaigns?.length || 0, campaigns } };
  },
};

const searchKnowledgeTool: AgentTool = {
  name: "search_knowledge",
  label: "Consultation de la base de connaissances",
  description: "Cherche dans la documentation Bleadin et les guides de prospection/rédaction. À utiliser pour toute question sur le fonctionnement de Bleadin ou les bonnes pratiques.",
  parameters: { type: "object", properties: { query: { type: "string", description: "Sujet recherché" } }, required: ["query"] },
  schema: z.object({ query: z.preprocess((v) => String(v ?? "").trim(), z.string().min(2)) }),
  async execute(_ctx, args) {
    const hits = await searchKnowledge(args.query, 3);
    if (!hits.length) return { ok: true, result: { found: 0, note: "Rien dans la documentation : dis que tu ne sais pas plutôt que d'inventer." } };
    return { ok: true, result: { found: hits.length, passages: hits.map((h) => ({ source: h.docTitle, section: h.heading, text: h.text.slice(0, 1500) })) } };
  },
};

export const AGENT_TOOLS: AgentTool[] = [
  searchLinkedinProfiles,
  getProspectLists,
  createProspectList,
  addSearchResultsToList,
  getCampaignTemplates,
  draftCampaign,
  requestLaunchConfirmation,
  getAccountStatus,
  getCampaignsOverview,
  searchKnowledgeTool,
];

export const TOOL_DEFINITIONS: ChatToolDefinition[] = AGENT_TOOLS.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters }));

export function findTool(name: string): AgentTool | undefined {
  const wanted = name.trim().toLowerCase();
  return AGENT_TOOLS.find((t) => t.name === wanted);
}

// ─── Actions hors modèle (clics utilisateur) ────────────────────────────────

/** Lancement réel : re-soumission du brouillon avec la liste et startImmediately (chemin identique au wizard). */
export async function launchDraftCampaign(user: AuthenticatedUser, workspace: AgentWorkspace, token: string): Promise<ToolOutcome> {
  const pending = workspace.pendingConfirmation;
  const draft = workspace.draft;
  if (!pending || !draft || pending.campaignId !== draft.campaignId) return fail("Aucun lancement en attente de confirmation.");
  if (pending.token !== token) return fail("Jeton de confirmation invalide.");
  if (new Date(pending.expiresAt).getTime() < Date.now()) return fail("La confirmation a expiré. Redemande le lancement.");

  const res = await invokeController<any>(createCampaign, user, {
    body: {
      id: draft.campaignId,
      name: draft.name,
      type: draft.templateId || "CUSTOM",
      listIds: draft.listIds,
      steps: draft.steps,
      startImmediately: true,
    },
  });
  if (!res.body?.success) return { ok: false, result: { error: res.body?.error || "Le lancement a échoué." }, workspacePatch: { pendingConfirmation: undefined } };

  const enrolled = Number(res.body.prospectsEnrolled || 0);
  return {
    ok: true,
    result: {
      launched: true,
      campaignId: draft.campaignId,
      prospectsEnrolled: enrolled,
      note:
        enrolled === 0
          ? "Campagne activée mais aucun prospect enrôlé : les prospects sont probablement déjà connectés (campagne d'invitation) ou déjà dans une autre campagne active. Explique-le à l'utilisateur."
          : "Campagne lancée. Les actions s'exécuteront pendant les heures de travail selon les quotas.",
    },
    card: { type: "launch_result", campaignId: draft.campaignId, name: draft.name, prospectsEnrolled: enrolled },
    workspacePatch: { pendingConfirmation: undefined, draft: undefined },
  };
}

/** Mise à jour des messages depuis la carte de proposition (édition inline). */
export async function updateDraftSteps(user: AuthenticatedUser, workspace: AgentWorkspace, rawSteps: unknown): Promise<ToolOutcome> {
  const draft = workspace.draft;
  if (!draft) return fail("Aucun brouillon en cours.");
  const parsed = stepsSchema.safeParse(rawSteps);
  if (!parsed.success) return fail("Étapes invalides.");
  const steps: DraftStep[] = parsed.data.map((s, i) => ({ stepOrder: i + 1, actionType: s.actionType, delayDays: s.delayDays, messageText: s.messageText }));
  const validationError = validateStepMessages(steps);
  if (validationError) return fail(validationError);

  const res = await invokeController<any>(createCampaign, user, {
    body: { id: draft.campaignId, name: draft.name, type: draft.templateId || "CUSTOM", listIds: [], steps, startImmediately: false },
  });
  if (!res.body?.success) return fail(res.body?.error || "Impossible de mettre à jour le brouillon.");

  const newDraft = { ...draft, steps };
  const list = draft.listIds[0] ? await loadListSummary(user, draft.listIds[0]) : null;
  return {
    ok: true,
    result: { updated: true },
    card: { type: "campaign_proposal", campaign: { id: draft.campaignId, name: draft.name, steps, listId: list?.id || null, listName: list?.name || null, prospectsCount: list?.prospectsCount || 0 } },
    workspacePatch: { draft: newDraft, pendingConfirmation: undefined },
  };
}
