import { Response } from "express";
import { prisma } from "../../../lib/prisma.js";
import { z } from "zod";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";

const CreateListSchema = z.object({
  name: z.string().min(1, "Le nom de la liste est requis"),
  description: z.string().optional(),
  color: z.string().optional().default("#592eff"),
});

const UpdateListSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
});

export async function getLists(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const memberId = (req.query.memberId || req.query.userId) as string;
    let whereClause: any = { userId };

    if (req.user!.role === "SUPER_ADMIN" && req.user!.organizationId) {
      if (memberId && memberId !== "ALL") {
        whereClause = { userId: memberId, user: { organizationId: req.user!.organizationId } };
      } else {
        whereClause = { user: { organizationId: req.user!.organizationId } };
      }
    } else {
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { organizationId: true, orgRole: true },
      });
      if (currentUser?.organizationId && (currentUser.orgRole === "OWNER" || req.query.scope === "team")) {
        whereClause = { user: { organizationId: currentUser.organizationId } };
      }
    }

    const lists = await prisma.prospectList.findMany({
      where: whereClause,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: {
            prospects: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      lists: lists.map((l: any) => ({
        id: l.id,
        name: l.name,
        description: l.description,
        color: l.color || "#592eff",
        prospectsCount: l._count.prospects,
        author: l.user ? { id: l.user.id, name: l.user.name || l.user.email } : null,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function createList(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const body = CreateListSchema.parse(req.body);

    let targetOwnerId = userId;
    if (req.user!.role === "SUPER_ADMIN" && req.user!.ownerId) {
      targetOwnerId = req.user!.ownerId; // Auto-assign to owner
    }

    const list = await prisma.prospectList.create({
      data: {
        userId: targetOwnerId,
        name: body.name.trim(),
        description: body.description?.trim(),
        color: body.color || "#592eff",
      },
    });

    res.status(201).json({
      success: true,
      list: {
        id: list.id,
        name: list.name,
        description: list.description,
        color: list.color,
        prospectsCount: 0,
        createdAt: list.createdAt,
        updatedAt: list.updatedAt,
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.issues?.[0]?.message || err.message });
      return;
    }
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function updateList(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const body = UpdateListSchema.parse(req.body);

    let whereClause: any = { id };
    if (req.user!.role === "SUPER_ADMIN" && req.user!.organizationId) {
      whereClause.user = { organizationId: req.user!.organizationId };
    } else {
      whereClause.userId = userId;
    }

    const existing = await prisma.prospectList.findFirst({
      where: whereClause,
    });

    if (!existing) {
      res.status(404).json({ success: false, error: "Liste introuvable." });
      return;
    }

    const updated = await prisma.prospectList.update({
      where: { id },
      data: {
        name: body.name ? body.name.trim() : undefined,
        description: body.description !== undefined ? body.description?.trim() : undefined,
        color: body.color || undefined,
      },
    });

    res.json({
      success: true,
      list: updated,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.issues?.[0]?.message || err.message });
      return;
    }
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function deleteList(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;

    let whereClause: any = { id };
    if (req.user!.role === "SUPER_ADMIN" && req.user!.organizationId) {
      whereClause.user = { organizationId: req.user!.organizationId };
    } else {
      whereClause.userId = userId;
    }

    const existing = await prisma.prospectList.findFirst({
      where: whereClause,
    });

    if (!existing) {
      res.status(404).json({ success: false, error: "Liste introuvable." });
      return;
    }

    await prisma.prospectList.delete({ where: { id } });

    res.json({
      success: true,
      message: "Liste supprimée avec succès.",
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
