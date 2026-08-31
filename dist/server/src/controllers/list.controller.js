import { prisma } from "../../../lib/prisma.js";
import { z } from "zod";
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
export async function getLists(req, res) {
    try {
        const userId = req.user.id;
        const lists = await prisma.prospectList.findMany({
            where: { userId },
            include: {
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
            lists: lists.map((l) => ({
                id: l.id,
                name: l.name,
                description: l.description,
                color: l.color || "#592eff",
                prospectsCount: l._count.prospects,
                createdAt: l.createdAt,
                updatedAt: l.updatedAt,
            })),
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}
export async function createList(req, res) {
    try {
        const userId = req.user.id;
        const body = CreateListSchema.parse(req.body);
        const list = await prisma.prospectList.create({
            data: {
                userId,
                name: body.name.trim(),
                description: body.description?.trim(),
                color: body.color || "#592eff",
            },
        });
        res.status(201).json({
            success: true,
            list: {
                ...list,
                prospectsCount: 0,
            },
        });
    }
    catch (err) {
        if (err instanceof z.ZodError) {
            res.status(400).json({ success: false, error: err.issues?.[0]?.message || err.message });
            return;
        }
        res.status(500).json({ success: false, error: err.message });
    }
}
export async function updateList(req, res) {
    try {
        const id = req.params.id;
        const userId = req.user.id;
        const body = UpdateListSchema.parse(req.body);
        const existing = await prisma.prospectList.findFirst({
            where: { id, userId },
        });
        if (!existing) {
            res.status(404).json({ success: false, error: "Liste introuvable." });
            return;
        }
        const updated = await prisma.prospectList.update({
            where: { id },
            data: body,
            include: {
                _count: { select: { prospects: true } },
            },
        });
        res.json({
            success: true,
            list: {
                ...updated,
                prospectsCount: updated._count?.prospects ?? 0,
            },
        });
    }
    catch (err) {
        if (err instanceof z.ZodError) {
            res.status(400).json({ success: false, error: err.issues?.[0]?.message || err.message });
            return;
        }
        res.status(500).json({ success: false, error: err.message });
    }
}
export async function deleteList(req, res) {
    try {
        const id = req.params.id;
        const userId = req.user.id;
        const existing = await prisma.prospectList.findFirst({
            where: { id, userId },
        });
        if (!existing) {
            res.status(404).json({ success: false, error: "Liste introuvable." });
            return;
        }
        await prisma.prospectList.delete({ where: { id } });
        res.json({ success: true, message: "Liste supprimée avec succès." });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}
