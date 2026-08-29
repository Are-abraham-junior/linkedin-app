import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { UnipileService } from "../services/unipile.service.js";

export async function searchProfiles(req: AuthenticatedRequest, res: Response) {
  try {
    const { keywords, location, company, title, url, limit = 25 } = req.body;

    if (!keywords && !title && !company && !location && !url) {
      res.status(400).json({
        success: false,
        error: "Veuillez spécifier au moins un critère de recherche (poste, lieu, entreprise ou URL LinkedIn).",
      });
      return;
    }

    const safeLimit = Math.min(Math.max(parseInt(limit) || 25, 1), 100);

    const result = await UnipileService.searchProfiles({
      keywords,
      location,
      company,
      title,
      url,
      limit: safeLimit,
    });

    res.json({
      success: true,
      count: result.items.length,
      totalCount: result.totalCount,
      profiles: result.items,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getAccountHealth(req: AuthenticatedRequest, res: Response) {
  try {
    const status: any = await UnipileService.getAccountStatus();
    res.json({
      success: true,
      status,
      connected: status?.sources?.[0]?.status === "OK" || status?.name !== undefined,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
