import { Response } from "express";
import { isWithinCreationGrace } from "../services/linkedinConnection.service.js";
import { z } from "zod";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { UnipileService, UnipilePostNotFoundError } from "../services/unipile.service.js";
import { prisma } from "../../../lib/prisma.js";

/** Compte LinkedIn connecté de l'utilisateur (le plus récent), ou null. */
async function findConnectedAccount(userId: string) {
  return prisma.linkedInAccount.findFirst({
    where: { userId, status: "CONNECTED", unipileAccountId: { not: "" } },
    orderBy: { updatedAt: "desc" },
  });
}

/** URL LinkedIn comparable : minuscules, sans query string ni `/` final. */
function normalizeLinkedInUrl(url: string): string {
  return url.trim().toLowerCase().split("?")[0].replace(/\/+$/, "");
}

/**
 * Retire des résultats de recherche les profils déjà présents dans les listes de
 * l'utilisateur (même scope `list: { userId }` que le CRM), pour que relancer une
 * recherche ne remonte pas sans cesse les mêmes prospects.
 */
async function excludeKnownProspects<T extends { providerProfileId: string; linkedinUrl: string }>(
  userId: string,
  profiles: T[]
): Promise<{ profiles: T[]; excludedCount: number }> {
  if (profiles.length === 0) return { profiles, excludedCount: 0 };

  const providerIds = profiles.map((p) => p.providerProfileId).filter(Boolean);
  const urls = profiles.map((p) => normalizeLinkedInUrl(p.linkedinUrl)).filter(Boolean);

  const known = await prisma.prospect.findMany({
    where: {
      list: { userId },
      OR: [
        { providerProfileId: { in: providerIds } },
        { linkedinUrl: { in: urls, mode: "insensitive" } },
        { linkedinUrl: { in: urls.map((u) => `${u}/`), mode: "insensitive" } },
      ],
    },
    select: { providerProfileId: true, linkedinUrl: true },
  });
  if (known.length === 0) return { profiles, excludedCount: 0 };

  const knownIds = new Set(known.map((k) => k.providerProfileId).filter(Boolean));
  const knownUrls = new Set(known.map((k) => normalizeLinkedInUrl(k.linkedinUrl)));

  const kept = profiles.filter(
    (p) => !knownIds.has(p.providerProfileId) && !knownUrls.has(normalizeLinkedInUrl(p.linkedinUrl))
  );
  return { profiles: kept, excludedCount: profiles.length - kept.length };
}

/**
 * Gestion commune des erreurs Unipile des recherches : une 401/404/checkpoint
 * signifie une session LinkedIn expirée → compte marqué DISCONNECTED et
 * `needsReconnect` renvoyé au client ; sinon erreur générique.
 */
async function handleUnipileControllerError(req: AuthenticatedRequest, res: Response, err: any, label: string) {
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
    console.warn(`[${label}] Auto-marking account DISCONNECTED for user ${req.user.id} due to: ${errorMsg}`);
    await prisma.linkedInAccount.updateMany({
      where: { userId: req.user.id, status: "CONNECTED" },
      data: { status: "DISCONNECTED" },
    });

    res.status(400).json({
      success: false,
      error: "Votre session LinkedIn a expiré ou n'est plus active. Veuillez reconnecter votre compte LinkedIn.",
      needsReconnect: true,
    });
    return;
  }

  console.error(`[linkedin.controller:${label}]`, err);
  res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
}

const PostEngagersSchema = z.object({
  url: z.string().trim().min(1, "L'URL du post LinkedIn est requise."),
  includeReactions: z.boolean().optional().default(true),
  includeComments: z.boolean().optional().default(true),
  limit: z.number().int().optional().default(50),
});

/**
 * POST /api/linkedin/post-engagers
 * Liste les personnes ayant liké / commenté un post LinkedIn (source de prospects).
 */
export async function getPostEngagers(req: AuthenticatedRequest, res: Response) {
  try {
    const parsed = PostEngagersSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || "Données invalides." });
      return;
    }
    const { url, includeReactions, includeComments } = parsed.data;
    if (!includeReactions && !includeComments) {
      res.status(400).json({ success: false, error: "Sélectionnez au moins les likes ou les commentaires." });
      return;
    }

    const postId = UnipileService.parseLinkedInPostId(url);
    if (!postId) {
      res.status(400).json({
        success: false,
        error: "URL de post LinkedIn non reconnue. Collez l'URL d'un post (…/posts/…-activity-1234567890-…) ou son identifiant.",
      });
      return;
    }

    const linkedAcc = await findConnectedAccount(req.user!.id);
    if (!linkedAcc?.unipileAccountId) {
      res.status(400).json({
        success: false,
        error: "Veuillez connecter votre compte LinkedIn avant de récupérer les interactions d'un post.",
      });
      return;
    }

    const safeLimit = Math.min(Math.max(parsed.data.limit || 50, 1), 100);
    const accountId = linkedAcc.unipileAccountId;

    let post;
    let result;
    try {
      post = await UnipileService.getPost({ accountId, postId });
      if (!post) throw new UnipilePostNotFoundError();
      result = await UnipileService.getPostEngagers({
        accountId,
        socialId: post.socialId,
        includeReactions,
        includeComments,
        limit: safeLimit,
      });
    } catch (err: any) {
      if (err instanceof UnipilePostNotFoundError) {
        res.status(404).json({ success: false, error: err.message });
        return;
      }
      throw err;
    }

    res.json({
      success: true,
      post,
      count: result.items.length,
      truncated: result.truncated,
      profiles: result.items,
    });
  } catch (err: any) {
    await handleUnipileControllerError(req, res, err, "getPostEngagers");
  }
}

export async function searchProfiles(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const { keywords, location, company, title, url, limit = 25, api, industry, companyHeadcount } = req.body;
    // Curseur Unipile renvoyé par une recherche précédente → page suivante de la même recherche
    const cursor = typeof req.body.cursor === "string" && req.body.cursor.trim() ? req.body.cursor.trim() : undefined;

    if (!cursor && !keywords && !title && !company && !location && !url && (!industry || industry.length === 0)) {
      res.status(400).json({
        success: false,
        error: "Veuillez spécifier au moins un critère de recherche (poste, lieu, entreprise, secteur ou URL LinkedIn).",
      });
      return;
    }

    const linkedAcc = await findConnectedAccount(userId);

    if (!linkedAcc?.unipileAccountId) {
      res.status(400).json({
        success: false,
        error: "Veuillez connecter votre compte LinkedIn avant de lancer une recherche de profils.",
      });
      return;
    }

    // Garde-fou de sécurité : le mode Sales Navigator et les filtres de taille d'entreprise sont réservés aux comptes Sales Navigator
    const wantsSalesNav = api === "sales_navigator" || (Array.isArray(companyHeadcount) && companyHeadcount.length > 0);
    const hasSalesNav = Boolean(linkedAcc.hasSalesNavigator || linkedAcc.accountType === "SALES_NAVIGATOR");

    if (wantsSalesNav && !hasSalesNav) {
      res.status(403).json({
        success: false,
        error: "Le mode Sales Navigator et le filtre par taille d'entreprise nécessitent un compte LinkedIn Sales Navigator. Votre compte est actuellement en mode Standard.",
        requiresSalesNavigator: true,
        accountType: linkedAcc.accountType || "STANDARD",
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
      cursor,
    });

    const { profiles, excludedCount } = await excludeKnownProspects(userId, result.items);

    res.json({
      success: true,
      count: profiles.length,
      totalCount: result.totalCount,
      profiles,
      nextCursor: result.nextCursor,
      excludedCount,
    });
  } catch (err: any) {
    await handleUnipileControllerError(req, res, err, "searchProfiles");
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

      if (isNotFoundOrExpired && isWithinCreationGrace(linkedAcc)) {
        // Compte fraîchement créé, pas encore visible chez Unipile : ne pas le rétrograder
        res.json({ success: true, connected: true, status: null, pending: true });
        return;
      }

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
    console.error("[linkedin.controller:getAccountHealth]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}

export async function disconnectAccount(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    // Toutes les lignes de l'utilisateur (CONNECTED, DISCONNECTED, CHECKPOINT) : chacune est un compte facturé chez Unipile
    const accounts = await prisma.linkedInAccount.findMany({ where: { userId } });

    const failed: string[] = [];
    for (const acc of accounts) {
      if (acc.unipileAccountId) {
        const del = await UnipileService.deleteAccount(acc.unipileAccountId);
        // 404 = déjà supprimé chez Unipile : on peut nettoyer la ligne
        if (!del.success && !/404|not.?found/i.test(del.error || "")) {
          failed.push(acc.unipileAccountId);
          continue;
        }
      }
      await prisma.linkedInAccount.delete({ where: { id: acc.id } }).catch(() => {});
    }

    if (failed.length > 0) {
      // On garde la ligne : un compte encore facturé ne doit jamais devenir invisible
      await prisma.linkedInAccount.updateMany({
        where: { userId, unipileAccountId: { in: failed } },
        data: { status: "DISCONNECTED" },
      });
      res.status(502).json({
        success: false,
        error: "Unipile n'a pas confirmé la suppression du compte. Réessayez dans quelques instants.",
      });
      return;
    }

    res.json({ success: true, message: "Compte LinkedIn déconnecté et supprimé avec succès." });
  } catch (err: any) {
    console.error("[linkedin.controller:disconnectAccount]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." });
  }
}
