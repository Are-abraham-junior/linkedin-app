import { Response, NextFunction } from "express";
import { prisma } from "../../../lib/prisma.js";
import type { AuthenticatedRequest } from "./auth.middleware.js";
import { normalizePlanId } from "../config/plans.js";

export const AI_ALLOWED_PLANS = ["PRO", "BUSINESS"] as const;

export async function hasAiAccess(user: { id: string; role: string; organizationId?: string | null }): Promise<boolean> {
  if (user.role === "SUPER_ADMIN") return true;
  let orgId = user.organizationId;
  if (!orgId) {
    const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { organizationId: true } });
    orgId = dbUser?.organizationId;
  }
  if (!orgId) return false;
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true } });
  if (!org) return false;
  return (AI_ALLOWED_PLANS as readonly string[]).includes(normalizePlanId(org.plan));
}

export async function requireAiAccess(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Non authentifié." });
      return;
    }
    if (await hasAiAccess(req.user)) return next();
    res.status(403).json({
      success: false,
      code: "PLAN_UPGRADE_REQUIRED",
      error: "Bleadin IA est réservé aux offres Pro et Business.",
    });
  } catch (err) {
    next(err);
  }
}
