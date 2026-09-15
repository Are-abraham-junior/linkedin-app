import { prisma } from "../../../lib/prisma.js";
/**
 * Organisation « effective » de l'appelant : celle de l'utilisateur, ou celle
 * impersonée pour un SUPER_ADMIN (portée par `req.user.organizationId`).
 */
export async function resolveOrganization(req) {
    const me = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { organizationId: true, orgRole: true, role: true },
    });
    const organizationId = req.user.organizationId || me?.organizationId || null;
    const isAdmin = req.user.role === "SUPER_ADMIN" || me?.orgRole === "OWNER" || me?.orgRole === "ADMIN";
    return { organizationId, orgRole: me?.orgRole || null, isAdmin };
}
