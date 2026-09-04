import { prisma } from "../../../lib/prisma.js";
import { z } from "zod";
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
export async function getProspects(req, res) {
    try {
        const userId = req.user.id;
        const { listId, search, connectionStatus, hasEmail, tag, page = "1", limit = "50", scope, userId: targetUserId, memberId } = req.query;
        const pageNum = parseInt(page) || 1;
        const take = parseInt(limit) || 50;
        const skip = (pageNum - 1) * take;
        const effectiveMemberId = (memberId || targetUserId);
        let listFilter = { userId };
        if (req.user.role === "SUPER_ADMIN" && req.user.organizationId) {
            if (effectiveMemberId && effectiveMemberId !== "ALL") {
                listFilter = { userId: effectiveMemberId, user: { organizationId: req.user.organizationId } };
            }
            else {
                listFilter = { user: { organizationId: req.user.organizationId } };
            }
        }
        else {
            const currentUser = await prisma.user.findUnique({
                where: { id: userId },
                select: { organizationId: true, orgRole: true, role: true },
            });
            if (scope === "team" && currentUser?.organizationId) {
                listFilter = { user: { organizationId: currentUser.organizationId } };
            }
            else if (effectiveMemberId && (currentUser?.orgRole === "OWNER" || currentUser?.role === "SUPER_ADMIN")) {
                listFilter = { userId: effectiveMemberId };
            }
        }
        const where = {
            list: listFilter,
        };
        if (listId === "DO_NOT_CONTACT") {
            where.doNotContact = true;
        }
        else {
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
                        select: {
                            id: true,
                            name: true,
                            color: true,
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                    avatarUrl: true,
                                },
                            },
                        },
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
                    list: listFilter,
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
                    }).catch(() => { });
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
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}
export async function bulkImportProspects(req, res) {
    try {
        const userId = req.user.id;
        const body = BulkImportSchema.parse(req.body);
        // Vérifier l'appartenance de la liste
        let listWhere = { id: body.listId };
        if (req.user.role === "SUPER_ADMIN" && req.user.organizationId) {
            listWhere.user = { organizationId: req.user.organizationId };
        }
        else {
            listWhere.userId = userId;
        }
        const list = await prisma.prospectList.findFirst({
            where: listWhere,
        });
        if (!list) {
            res.status(404).json({ success: false, error: "Liste cible non trouvée." });
            return;
        }
        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { organizationId: true },
        });
        // Récupérer les URLs LinkedIn existantes dans cette liste
        const existingProspects = await prisma.prospect.findMany({
            where: { listId: body.listId },
            select: { linkedinUrl: true },
        });
        const existingUrls = new Set(existingProspects.map((p) => p.linkedinUrl.toLowerCase().trim()));
        // Moteur Anti-Collision d'Équipe : Récupérer les prospects de toute l'organisation
        const teamCollisions = [];
        const orgUrlsMap = new Map();
        if (currentUser?.organizationId) {
            const allOrgProspects = await prisma.prospect.findMany({
                where: {
                    list: {
                        user: {
                            organizationId: currentUser.organizationId,
                        },
                    },
                },
                select: {
                    linkedinUrl: true,
                    firstName: true,
                    lastName: true,
                    list: {
                        select: {
                            userId: true,
                            user: { select: { name: true, email: true } },
                        },
                    },
                },
            });
            for (const op of allOrgProspects) {
                orgUrlsMap.set(op.linkedinUrl.toLowerCase().trim(), {
                    ownerId: op.list.userId,
                    ownerName: op.list.user.name || op.list.user.email,
                });
            }
        }
        let createdCount = 0;
        let duplicateCount = 0;
        const toInsert = [];
        for (const p of body.prospects) {
            const cleanUrl = p.linkedinUrl.toLowerCase().trim();
            // Règle d'or : Ne contactez jamais la même personne qu'un autre membre de l'équipe
            const teamOwner = orgUrlsMap.get(cleanUrl);
            if (teamOwner && teamOwner.ownerId !== userId) {
                teamCollisions.push({
                    name: `${p.firstName} ${p.lastName}`.trim(),
                    url: cleanUrl,
                    ownerName: teamOwner.ownerName,
                });
                duplicateCount++;
                continue;
            }
            if (existingUrls.has(cleanUrl)) {
                duplicateCount++;
                continue;
            }
            existingUrls.add(cleanUrl);
            orgUrlsMap.set(cleanUrl, { ownerId: userId, ownerName: "Moi" });
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
            message: `${createdCount} prospect(s) importé(s) avec succès.${teamCollisions.length > 0 ? ` (${teamCollisions.length} collision(s) d'équipe bloquée(s))` : duplicateCount > 0 ? ` (${duplicateCount} doublon(s) ignoré(s))` : ""}`,
            createdCount,
            duplicateCount,
            teamCollisionsCount: teamCollisions.length,
            teamCollisions,
            totalReceived: body.prospects.length,
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
export async function updateProspect(req, res) {
    try {
        const id = req.params.id;
        const userId = req.user.id;
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
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}
export async function deleteProspect(req, res) {
    try {
        const id = req.params.id;
        const userId = req.user.id;
        let prospectWhere = { id };
        if (req.user.role === "SUPER_ADMIN" && req.user.organizationId) {
            prospectWhere.list = { user: { organizationId: req.user.organizationId } };
        }
        else {
            prospectWhere.list = { userId };
        }
        const existing = await prisma.prospect.findFirst({
            where: prospectWhere,
        });
        if (!existing) {
            res.status(404).json({ success: false, error: "Prospect introuvable." });
            return;
        }
        await prisma.prospect.delete({ where: { id } });
        res.json({ success: true, message: "Prospect supprimé avec succès." });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}
export async function bulkDeleteProspects(req, res) {
    try {
        const userId = req.user.id;
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            res.status(400).json({ success: false, error: "Liste d'identifiants requise." });
            return;
        }
        let listClause = { userId };
        if (req.user.role === "SUPER_ADMIN" && req.user.organizationId) {
            listClause = { user: { organizationId: req.user.organizationId } };
        }
        await prisma.prospect.deleteMany({
            where: {
                id: { in: ids },
                list: listClause,
            },
        });
        res.json({ success: true, message: `${ids.length} prospect(s) supprimé(s).` });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}
export async function bulkMoveProspects(req, res) {
    try {
        const userId = req.user.id;
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
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}
/**
 * POST /api/prospects/sync-status
 * Interroge l'API Unipile pour vérifier le statut réel de connexion LinkedIn
 * (CONNECTED, PENDING, NOT_CONNECTED) des prospects et mettre à jour la base.
 */
export async function syncProspectsStatus(req, res) {
    try {
        const userId = req.user.id;
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
        const where = { list: { userId } };
        if (Array.isArray(prospectIds) && prospectIds.length > 0) {
            where.id = { in: prospectIds };
        }
        else if (listId && listId !== "ALL" && listId !== "DO_NOT_CONTACT") {
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
            if (!identifier)
                continue;
            const result = await UnipileService.getProfileDetailsAndStatus(identifier, unipileAccountId);
            const updateData = {
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
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}
const CollisionCheckSchema = z.object({
    urls: z.array(z.string()).min(1, "Au moins une URL est requise"),
});
export async function checkProspectCollision(req, res) {
    try {
        const userId = req.user.id;
        const body = CollisionCheckSchema.parse(req.body);
        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { organizationId: true },
        });
        if (!currentUser?.organizationId) {
            res.json({ success: true, collisionsCount: 0, collisions: [] });
            return;
        }
        const cleanUrls = body.urls.map((u) => u.toLowerCase().trim());
        // Chercher tous les prospects avec ces URLs dans la même organisation
        const existing = await prisma.prospect.findMany({
            where: {
                list: {
                    user: {
                        organizationId: currentUser.organizationId,
                    },
                },
                linkedinUrl: { in: cleanUrls },
            },
            include: {
                list: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true, avatarUrl: true },
                        },
                    },
                },
            },
        });
        const collisions = existing.map((p) => ({
            prospectId: p.id,
            linkedinUrl: p.linkedinUrl,
            name: `${p.firstName} ${p.lastName}`.trim(),
            company: p.company,
            ownedByMe: p.list.userId === userId,
            owner: {
                id: p.list.user.id,
                name: p.list.user.name,
                email: p.list.user.email,
                avatarUrl: p.list.user.avatarUrl,
            },
            listName: p.list.name,
        }));
        res.json({
            success: true,
            collisionsCount: collisions.length,
            collisions,
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
const TransferProspectsSchema = z.object({
    prospectIds: z.array(z.string()).min(1, "Au moins un prospect requis"),
    targetUserId: z.string().min(1, "Membre cible requis"),
    targetListId: z.string().optional(),
});
export async function transferProspects(req, res) {
    try {
        const userId = req.user.id;
        const body = TransferProspectsSchema.parse(req.body);
        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { organizationId: true, orgRole: true, role: true },
        });
        if (!currentUser?.organizationId) {
            res.status(400).json({ success: false, error: "Vous devez appartenir à un espace de travail." });
            return;
        }
        if (currentUser.orgRole !== "OWNER" && currentUser.role !== "SUPER_ADMIN") {
            res.status(403).json({ success: false, error: "Seul le propriétaire de l'espace peut réassigner des prospects entre membres." });
            return;
        }
        // Vérifier que l'utilisateur cible est bien dans la même organisation
        const targetUser = await prisma.user.findFirst({
            where: { id: body.targetUserId, organizationId: currentUser.organizationId },
        });
        if (!targetUser) {
            res.status(404).json({ success: false, error: "Membre cible introuvable dans cet espace." });
            return;
        }
        // Déterminer la liste de destination
        let targetListId = body.targetListId;
        if (!targetListId) {
            let defaultList = await prisma.prospectList.findFirst({
                where: { userId: targetUser.id, name: "Prospects transférés" },
            });
            if (!defaultList) {
                defaultList = await prisma.prospectList.create({
                    data: {
                        name: "Prospects transférés",
                        description: "Prospects réassignés par le manager",
                        color: "#592eff",
                        userId: targetUser.id,
                    },
                });
            }
            targetListId = defaultList.id;
        }
        const updateResult = await prisma.prospect.updateMany({
            where: {
                id: { in: body.prospectIds },
                list: {
                    user: {
                        organizationId: currentUser.organizationId,
                    },
                },
            },
            data: {
                listId: targetListId,
            },
        });
        res.json({
            success: true,
            transferredCount: updateResult.count,
            message: `${updateResult.count} prospect(s) transféré(s) avec succès à ${targetUser.name || targetUser.email}.`,
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
