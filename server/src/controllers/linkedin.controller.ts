import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { UnipileService } from "../services/unipile.service.js";
import { prisma } from "../../../lib/prisma.js";

export async function searchProfiles(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const { keywords, location, company, title, url, limit = 25, api, industry, companyHeadcount } = req.body;

    if (!keywords && !title && !company && !location && !url && (!industry || industry.length === 0)) {
      res.status(400).json({
        success: false,
        error: "Veuillez spécifier au moins un critère de recherche (poste, lieu, entreprise, secteur ou URL LinkedIn).",
      });
      return;
    }

    const linkedAcc = await prisma.linkedInAccount.findFirst({
      where: { userId, status: "CONNECTED", unipileAccountId: { not: "" } },
      orderBy: { updatedAt: "desc" },
    });

    if (!linkedAcc?.unipileAccountId) {
      res.status(400).json({
        success: false,
        error: "Veuillez connecter votre compte LinkedIn avant de lancer une recherche de profils.",
      });
      return;
    }

    const safeLimit = Math.min(Math.max(parseInt(limit) || 25, 1), 100);

    const result = await UnipileService.searchProfiles({
      accountId: linkedAcc.unipileAccountId,
      keywords,
      location,
      company,
      title,
      url,
      limit: safeLimit,
      api,
      industry,
      companyHeadcount,
    });

    res.json({
      success: true,
      count: result.items.length,
      totalCount: result.totalCount,
      profiles: result.items,
    });
  } catch (err: any) {
    const errorMsg = String(err?.message || "");
    const status = err?.status || err?.response?.status;
    const isExpiredOrNotFound =
      status === 404 ||
      status === 401 ||
      errorMsg.includes("404") ||
      errorMsg.includes("401") ||
      errorMsg.toLowerCase().includes("not found") ||
      errorMsg.toLowerCase().includes("not_found") ||
      errorMsg.toLowerCase().includes("unauthorized") ||
      errorMsg.toLowerCase().includes("checkpoint");

    if (isExpiredOrNotFound && req.user?.id) {
      console.warn(`[searchProfiles] Auto-marking account DISCONNECTED for user ${req.user.id} due to: ${errorMsg}`);
      await prisma.linkedInAccount.updateMany({
        where: { userId: req.user.id, status: "CONNECTED" },
        data: { status: "DISCONNECTED" },
      });

      res.status(400).json({
        success: false,
        error: "Votre session LinkedIn a expiré ou n'est plus active sur Unipile. Veuillez reconnecter votre compte LinkedIn.",
        needsReconnect: true,
      });
      return;
    }

    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getSearchParameters(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const { type, keywords, service, limit = "20" } = req.query as {
      type?: string;
      keywords?: string;
      service?: "CLASSIC" | "SALES_NAVIGATOR" | "RECRUITER";
      limit?: string;
    };

    if (!type) {
      res.status(400).json({
        success: false,
        error: "Le paramètre 'type' est requis (ex: INDUSTRY, LOCATION, etc.).",
      });
      return;
    }

    const linkedAcc = await prisma.linkedInAccount.findFirst({
      where: { userId, status: "CONNECTED", unipileAccountId: { not: "" } },
      orderBy: { updatedAt: "desc" },
    });

    if (!linkedAcc?.unipileAccountId) {
      res.status(400).json({
        success: false,
        error: "Veuillez connecter votre compte LinkedIn avant de rechercher des paramètres.",
      });
      return;
    }

    const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);

    const result = await UnipileService.searchParameters({
      accountId: linkedAcc.unipileAccountId,
      type,
      keywords,
      service,
      limit: safeLimit,
    });

    res.json({
      success: true,
      items: result.items,
      pageCount: result.pageCount,
    });
  } catch (err: any) {
    console.warn("Notice Unipile parameters lookup:", err.message);
    res.json({
      success: true,
      items: [],
      pageCount: 0,
      notice: err.message,
    });
  }
}

export async function getAccountHealth(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const linkedAcc = await prisma.linkedInAccount.findFirst({
      where: { userId, status: "CONNECTED", unipileAccountId: { not: "" } },
      orderBy: { updatedAt: "desc" },
    });

    if (!linkedAcc?.unipileAccountId) {
      res.json({
        success: true,
        connected: false,
        status: null,
      });
      return;
    }

    try {
      const status: any = await UnipileService.getAccountStatus(linkedAcc.unipileAccountId);
      res.json({
        success: true,
        status,
        connected: status?.sources?.[0]?.status === "OK" || status?.name !== undefined,
      });
    } catch (unipileErr: any) {
      const errorMsg = String(unipileErr?.message || "");
      const isNotFoundOrExpired =
        errorMsg.includes("404") ||
        errorMsg.includes("401") ||
        errorMsg.toLowerCase().includes("not found") ||
        errorMsg.toLowerCase().includes("not_found") ||
        errorMsg.toLowerCase().includes("unauthorized");

      if (isNotFoundOrExpired) {
        console.warn(`[getAccountHealth] Auto-disconnecting invalid Unipile account ${linkedAcc.unipileAccountId}`);
        await prisma.linkedInAccount.update({
          where: { id: linkedAcc.id },
          data: { status: "DISCONNECTED" },
        });
        res.json({
          success: true,
          connected: false,
          status: null,
          notice: "Session LinkedIn expirée ou compte introuvable. Veuillez reconnecter votre compte.",
        });
        return;
      }
      throw unipileErr;
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function disconnectAccount(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const linkedAcc = await prisma.linkedInAccount.findFirst({
      where: { userId, status: "CONNECTED" },
      orderBy: { updatedAt: "desc" },
    });

    if (linkedAcc) {
      if (linkedAcc.unipileAccountId) {
        try {
          await UnipileService.deleteAccount(linkedAcc.unipileAccountId);
        } catch (delErr: any) {
          console.warn(`[disconnectAccount] Unipile deletion notice: ${delErr.message}`);
        }
      }
      await prisma.linkedInAccount.update({
        where: { id: linkedAcc.id },
        data: { status: "DISCONNECTED" },
      });
    }

    res.json({ success: true, message: "Compte LinkedIn déconnecté avec succès." });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
