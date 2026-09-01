import { Response } from "express";
import { prisma } from "../../../lib/prisma.js";
import { z } from "zod";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { extractCompanyFromHeadline } from "../utils/companyExtractor.js";
import { UnipileService } from "../services/unipile.service.js";

const ProspectItemSchema = z.object({
  firstName: z.string().min(1, "Le prénom est requis"),
  lastName: z.string().min(1, "Le nom est requis"),
  linkedinUrl: z.string().min(1, "L'URL LinkedIn est requise"),
  providerProfileId: z.string().optional(),
  headline: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  avatarUrl: z.string().optional(),
  connectionStatus: z.string().optional().default("NOT_CONNECTED"),
  tags: z.array(z.string()).optional().default([]),
});

const BulkImportSchema = z.object({
  listId: z.string().min(1, "La liste cible est obligatoire"),
  prospects: z
    .array(ProspectItemSchema)
    .min(1, "Au moins un prospect est requis")
    .max(250, "La limite maximale d'importation par lot est de 250 prospects."),
  importLimit: z.number().min(1).max(250).optional(),
});

export async function getProspects(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const { listId, search, connectionStatus, hasEmail, tag, page = "1", limit = "50" } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const take = parseInt(limit as string) || 50;
    const skip = (pageNum - 1) * take;

    const where: any = {
      list: {
        userId,
      },
    };

    if (listId === "DO_NOT_CONTACT") {
      where.doNotContact = true;
    } else {
      where.doNotContact = false;
      if (listId && typeof listId === "string" && listId !== "ALL") {
        where.listId = listId;
      }
    }

    if (search && typeof search === "string" && search.trim()) {
      const q = search.trim();
      where.OR = [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { company: { contains: q, mode: "insensitive" } },
        { headline: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    }

    if (connectionStatus && typeof connectionStatus === "string" && connectionStatus !== "ALL") {
      where.connectionStatus = connectionStatus;
    }

    if (hasEmail === "true") {
      where.email = { not: null, notIn: [""] };
    }

    if (tag && typeof tag === "string" && tag.trim()) {
      where.tags = { has: tag.trim() };
    }

    const [total, prospects, doNotContactCount] = await Promise.all([
      prisma.prospect.count({ where }),
      prisma.prospect.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          list: {
            select: { id: true, name: true, color: true },
          },
          campaignStates: {
            include: {
              campaign: { select: { id: true, name: true, status: true } },
            },
          },
        },
      }),
      prisma.prospect.count({
        where: {
          list: { userId },
          doNotContact: true,
        },
      }),
    ]);

    // Auto-enrichissement intelligent de l'entreprise si manquante
    const enrichedProspects = prospects.map((p) => {
      let company = p.company;
      if (!company && p.headline) {
        const detected = extractCompanyFromHeadline(p.headline);
        if (detected) {
          company = detected;
          // Mise à jour asynchrone dans la base pour les futures requêtes
          prisma.prospect.update({
            where: { id: p.id },
            data: { company: detected },
          }).catch(() => {});
        }
      }
      return {
        ...p,
        company,
      };
    });

    res.json({
      success: true,
      total,
      doNotContactCount,
      page: pageNum,
      limit: take,
      totalPages: Math.ceil(total / take),
      prospects: enrichedProspects,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function bulkImportProspects(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const body = BulkImportSchema.parse(req.body);

    // Vérifier l'appartenance de la liste
    const list = await prisma.prospectList.findFirst({
      where: { id: body.listId, userId },
    });

    if (!list) {
      res.status(404).json({ success: false, error: "Liste cible non trouvée." });
      return;
    }

    // Récupérer les URLs LinkedIn existantes pour éviter les doublons dans cette liste
    const existingProspects = await prisma.prospect.findMany({
      where: { listId: body.listId },
      select: { linkedinUrl: true },
    });

    const existingUrls = new Set(
      existingProspects.map((p: any) => p.linkedinUrl.toLowerCase().trim())
    );

    let createdCount = 0;
    let duplicateCount = 0;

    const toInsert = [];

    for (const p of body.prospects) {
      const cleanUrl = p.linkedinUrl.toLowerCase().trim();
      if (existingUrls.has(cleanUrl)) {
        duplicateCount++;
        continue;
      }

      existingUrls.add(cleanUrl);
      toInsert.push({
        listId: body.listId,
        firstName: p.firstName.trim(),
        lastName: p.lastName.trim(),
        linkedinUrl: p.linkedinUrl.trim(),
        providerProfileId: p.providerProfileId || null,
        headline: p.headline?.trim() || null,
        company: p.company?.trim() || extractCompanyFromHeadline(p.headline) || null,
        location: p.location?.trim() || null,
        email: p.email?.trim() || null,
        phone: p.phone?.trim() || null,
        avatarUrl: p.avatarUrl || null,
        connectionStatus: p.connectionStatus || "NOT_CONNECTED",
        tags: p.tags || [],
      });
      createdCount++;
    }

    if (toInsert.length > 0) {
      await prisma.prospect.createMany({
        data: toInsert,
        skipDuplicates: true,
      });
    }

    res.status(201).json({
      success: true,
      message: `${createdCount} prospect(s) importé(s) avec succès. (${duplicateCount} doublon(s) ignoré(s))`,
      createdCount,
      duplicateCount,
      totalReceived: body.prospects.length,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.issues?.[0]?.message || err.message });
      return;
    }
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function updateProspect(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;

    const existing = await prisma.prospect.findFirst({
      where: { id, list: { userId } },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: "Prospect introuvable." });
      return;
    }

    const updated = await prisma.prospect.update({
      where: { id },
      data: req.body,
    });

    res.json({ success: true, prospect: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function deleteProspect(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;

    const existing = await prisma.prospect.findFirst({
      where: { id, list: { userId } },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: "Prospect introuvable." });
      return;
    }

    await prisma.prospect.delete({ where: { id } });

    res.json({ success: true, message: "Prospect supprimé avec succès." });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function bulkDeleteProspects(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ success: false, error: "Liste d'identifiants requise." });
      return;
    }

    await prisma.prospect.deleteMany({
      where: {
        id: { in: ids },
        list: { userId },
      },
    });

    res.json({ success: true, message: `${ids.length} prospect(s) supprimé(s).` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function bulkMoveProspects(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const { ids, targetListId } = req.body;

    if (!Array.isArray(ids) || !targetListId) {
      res.status(400).json({ success: false, error: "IDs et liste cible requis." });
      return;
    }

    // Vérifier la liste cible
    const targetList = await prisma.prospectList.findFirst({
      where: { id: targetListId, userId },
    });

    if (!targetList) {
      res.status(404).json({ success: false, error: "Liste cible introuvable." });
      return;
    }

    await prisma.prospect.updateMany({
      where: {
        id: { in: ids },
        list: { userId },
      },
      data: {
        listId: targetListId,
      },
    });

    res.json({ success: true, message: `${ids.length} prospect(s) déplacé(s) vers ${targetList.name}.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/prospects/sync-status
 * Interroge l'API Unipile pour vérifier le statut réel de connexion LinkedIn
 * (CONNECTED, PENDING, NOT_CONNECTED) des prospects et mettre à jour la base.
 */
export async function syncProspectsStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const { prospectIds, listId } = req.body || {};

    // Récupérer le compte LinkedIn actif de l'utilisateur
    const linkedInAcc = await prisma.linkedInAccount.findFirst({
      where: {
        userId,
        status: "CONNECTED",
        OR: [{ accountName: { not: null } }, { profilePicture: { not: null } }],
      },
      orderBy: { updatedAt: "desc" },
    }) || await prisma.linkedInAccount.findFirst({
      where: { userId, status: "CONNECTED" },
      orderBy: { updatedAt: "desc" },
    });

    const unipileAccountId = linkedInAcc?.unipileAccountId || undefined;

    const where: any = { list: { userId } };

    if (Array.isArray(prospectIds) && prospectIds.length > 0) {
      where.id = { in: prospectIds };
    } else if (listId && listId !== "ALL" && listId !== "DO_NOT_CONTACT") {
      where.listId = listId;
    }

    const prospects = await prisma.prospect.findMany({ where });

    if (prospects.length === 0) {
      res.json({ success: true, updatedCount: 0, message: "Aucun prospect à synchroniser." });
      return;
    }

    let updatedCount = 0;

    for (const p of prospects) {
      const identifier = p.providerProfileId || p.linkedinUrl;
      if (!identifier) continue;

      const result = await UnipileService.getProfileDetailsAndStatus(identifier, unipileAccountId);

      const updateData: any = {
        connectionStatus: result.connectionStatus,
      };

      if (result.profile?.avatarUrl && (!p.avatarUrl || p.avatarUrl.includes("ui-avatars.com"))) {
        updateData.avatarUrl = result.profile.avatarUrl;
      }
      if (result.profile?.email && !p.email) {
        updateData.email = result.profile.email;
      }
      if (result.profile?.company && (!p.company || p.company === "—")) {
        updateData.company = result.profile.company;
      }
      if (result.profile?.headline && (!p.headline || p.headline === "Professionnel")) {
        updateData.headline = result.profile.headline;
      }

      await prisma.prospect.update({
        where: { id: p.id },
        data: updateData,
      });

      updatedCount++;
    }

    res.json({
      success: true,
      updatedCount,
      message: `${updatedCount} prospect(s) synchronisé(s) avec succès.`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
