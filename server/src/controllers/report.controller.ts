import { Response } from "express";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { resolveCampaignScope } from "./campaign.controller.js";
import { buildCampaignsReport } from "../services/report.service.js";
import {
  getReportsConfig,
  getUserReportPrefs,
  updateUserReportPrefs,
  appendHistory,
  REPORT_DAYS,
  MAX_REPORT_EMAILS,
} from "../services/reportSettings.service.js";
import { sendReportEmailToUser } from "../workers/report.worker.js";
import { resolveOrganization } from "../utils/organization.js";

const GENERIC_ERROR = "Une erreur inattendue est survenue. Veuillez réessayer.";

/** Parse "YYYY-MM-DD" en début (00:00:00) ou fin (23:59:59.999) de journée UTC. */
function parseDay(value: unknown, endOfDay: boolean): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * GET /api/reports/campaigns?from&to&campaignIds=a,b&memberId&details=1&compare=1
 */
export async function getCampaignsReport(req: AuthenticatedRequest, res: Response) {
  try {
    const scope = await resolveCampaignScope(req);

    const now = new Date();
    const to = parseDay(req.query.to, true) || now;
    const from = parseDay(req.query.from, false) || new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);
    if (from > to) {
      res.status(400).json({ success: false, error: "La date de début doit précéder la date de fin." });
      return;
    }
    const flag = (v: unknown) => v === "1" || v === "true";
    const rawIds = typeof req.query.campaignIds === "string" ? req.query.campaignIds : "";
    const campaignIds = rawIds.split(",").map((s) => s.trim()).filter(Boolean);

    const [report, owner] = await Promise.all([
      buildCampaignsReport({
        scope,
        from,
        to,
        campaignIds,
        includeDetails: flag(req.query.details),
        compare: flag(req.query.compare),
      }),
      prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { name: true, email: true, organization: { select: { name: true } } },
      }),
    ]);

    res.json({
      success: true,
      ...report,
      owner: {
        name: owner?.name || owner?.email || "",
        email: owner?.email || "",
        organizationName: owner?.organization?.name || null,
      },
    });
  } catch (error: any) {
    console.error("Error getCampaignsReport:", error);
    res.status(500).json({ success: false, error: GENERIC_ERROR });
  }
}

/** GET /api/reports/settings */
export async function getReportSettings(req: AuthenticatedRequest, res: Response) {
  try {
    const { organizationId } = await resolveOrganization(req);
    const prefs = await getUserReportPrefs(req.user!.id);
    res.json({
      success: true,
      settings: { ...prefs, accountEmail: req.user!.email, available: !!organizationId },
    });
  } catch (error: any) {
    console.error("Error getReportSettings:", error);
    res.status(500).json({ success: false, error: GENERIC_ERROR });
  }
}

const UpdateSettingsSchema = z
  .object({
    emailFrequency: z.enum(["NONE", "DAILY", "WEEKLY"]).optional(),
    emails: z
      .array(z.string().trim().toLowerCase().email("Adresse e-mail invalide."))
      .max(MAX_REPORT_EMAILS, `${MAX_REPORT_EMAILS} destinataires maximum.`)
      .optional(),
    hour: z.number().int().min(0).max(23).optional(),
    day: z.enum(REPORT_DAYS).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: "Aucun réglage fourni." });

/** PUT /api/reports/settings  { emailFrequency?, emails?, hour?, day? } */
export async function updateReportSettings(req: AuthenticatedRequest, res: Response) {
  try {
    const parsed = UpdateSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || "Données invalides." });
      return;
    }
    const { organizationId } = await resolveOrganization(req);
    if (!organizationId) {
      res.status(400).json({ success: false, error: "Aucun espace de travail associé à ce compte." });
      return;
    }

    const patch = { ...parsed.data };
    if (patch.emails) patch.emails = Array.from(new Set(patch.emails));

    const prefs = await updateUserReportPrefs(req.user!.id, patch);
    res.json({
      success: true,
      settings: { ...prefs, accountEmail: req.user!.email, available: true },
    });
  } catch (error: any) {
    console.error("Error updateReportSettings:", error);
    res.status(500).json({ success: false, error: GENERIC_ERROR });
  }
}

/** POST /api/reports/email/send-now  { frequency?: "DAILY"|"WEEKLY" } */
export async function sendReportNow(req: AuthenticatedRequest, res: Response) {
  try {
    const prefs = await getUserReportPrefs(req.user!.id);
    const requested = req.body?.frequency;
    const frequency =
      requested === "DAILY" || requested === "WEEKLY"
        ? requested
        : prefs.emailFrequency !== "NONE"
        ? prefs.emailFrequency
        : "WEEKLY";

    const result = await sendReportEmailToUser(req.user!.id, frequency);
    if (!result.sent) {
      res.status(400).json({ success: false, error: result.reason || "Envoi impossible." });
      return;
    }
    res.json({ success: true, message: "Rapport envoyé par e-mail.", recipients: result.recipients || [] });
  } catch (error: any) {
    console.error("Error sendReportNow:", error);
    res.status(500).json({ success: false, error: "L'envoi de l'e-mail a échoué. Vérifiez la configuration SMTP." });
  }
}

/** GET /api/reports/history */
export async function getReportHistory(req: AuthenticatedRequest, res: Response) {
  try {
    const { organizationId, isAdmin } = await resolveOrganization(req);
    if (!organizationId) {
      res.json({ success: true, history: [] });
      return;
    }
    const config = await getReportsConfig(organizationId);
    // Les membres ne voient que leurs propres exports ; OWNER/ADMIN voient tout l'espace
    const history = isAdmin ? config.history : config.history.filter((h) => h.userId === req.user!.id);
    res.json({ success: true, history });
  } catch (error: any) {
    console.error("Error getReportHistory:", error);
    res.status(500).json({ success: false, error: GENERIC_ERROR });
  }
}

const HistorySchema = z.object({
  kind: z.enum(["PDF", "XLSX", "CONTACTS"]),
  filename: z.string().min(1).max(200),
  periodFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  campaignIds: z.array(z.string()).max(500).default([]),
  campaignsCount: z.number().int().min(0),
  prospectsCount: z.number().int().min(0).optional(),
});

/** POST /api/reports/history — enregistre un export généré côté client */
export async function addReportHistory(req: AuthenticatedRequest, res: Response) {
  try {
    const parsed = HistorySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: "Données invalides." });
      return;
    }
    const { organizationId } = await resolveOrganization(req);
    if (!organizationId) {
      res.json({ success: true, entry: null });
      return;
    }
    const me = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { name: true, email: true } });
    const entry = await appendHistory(organizationId, {
      ...parsed.data,
      userId: req.user!.id,
      userName: me?.name || me?.email || "",
    });
    res.json({ success: true, entry });
  } catch (error: any) {
    console.error("Error addReportHistory:", error);
    res.status(500).json({ success: false, error: GENERIC_ERROR });
  }
}
