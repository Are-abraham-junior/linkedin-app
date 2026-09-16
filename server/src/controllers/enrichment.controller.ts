import { Response } from "express";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { ENRICHMENT_BATCH_MAX, ENRICHMENT_COST } from "../config/plans.js";
import { EnrichmentError, enrichProspects, getBalance, getHistory } from "../services/enrichment.service.js";

const EnrichSchema = z.object({
  prospectIds: z.array(z.string().min(1)).min(1, "Aucun prospect sélectionné").max(ENRICHMENT_BATCH_MAX),
});

async function userTimezone(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  return u?.timezone || "Africa/Abidjan";
}

export async function getEnrichmentBalance(req: AuthenticatedRequest, res: Response) {
  try {
    const organizationId = req.user!.organizationId;
    if (!organizationId) {
      res.status(400).json({ success: false, error: "Votre compte n'est rattaché à aucune organisation." });
      return;
    }
    const balance = await getBalance(organizationId, await userTimezone(req.user!.id));
    res.json({ success: true, balance, cost: ENRICHMENT_COST, batchMax: ENRICHMENT_BATCH_MAX });
  } catch (err: any) {
    console.error("[enrichment.controller:getEnrichmentBalance]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

export async function enrich(req: AuthenticatedRequest, res: Response) {
  try {
    const { prospectIds } = EnrichSchema.parse(req.body);
    const result = await enrichProspects({
      userId: req.user!.id,
      organizationId: req.user!.organizationId,
      prospectIds: [...new Set(prospectIds)],
    });
    res.json({ success: true, ...result });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.issues?.[0]?.message || err.message });
      return;
    }
    if (err instanceof EnrichmentError) {
      res.status(err.code === "NO_TOKENS" ? 402 : 400).json({ success: false, error: err.message, code: err.code });
      return;
    }
    console.error("[enrichment.controller:enrich]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

export async function getEnrichmentHistory(req: AuthenticatedRequest, res: Response) {
  try {
    const organizationId = req.user!.organizationId;
    if (!organizationId) {
      res.json({ success: true, history: [] });
      return;
    }
    const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit || "100"), 10) || 100));
    const history = await getHistory(organizationId, await userTimezone(req.user!.id), limit);
    res.json({ success: true, history });
  } catch (err: any) {
    console.error("[enrichment.controller:getEnrichmentHistory]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}
