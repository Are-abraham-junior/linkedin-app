import { prisma } from "../../../lib/prisma.js";
/**
 * Photo de profil de l'espace de travail (organisation).
 *
 * TEMPORAIRE — stockée dans `IntegrationConfig.config` (JSON) avec
 * `provider = "BLEADIN_WORKSPACE"`, une ligne par organisation, pour éviter une
 * modification du schéma Prisma (impossible à pousser en prod sans accès SSH
 * au moment de l'implémentation). À migrer vers `Organization.avatarUrl` dès
 * que `prisma db push` pourra être exécuté sur le serveur.
 */
export const WORKSPACE_PROVIDER = "BLEADIN_WORKSPACE";
function readAvatar(raw) {
    return raw && typeof raw === "object" && typeof raw.avatarUrl === "string" ? raw.avatarUrl : null;
}
export async function getWorkspaceAvatar(organizationId) {
    const row = await prisma.integrationConfig.findUnique({
        where: { organizationId_provider: { organizationId, provider: WORKSPACE_PROVIDER } },
        select: { config: true },
    });
    return readAvatar(row?.config);
}
/** Photos de plusieurs organisations en une requête (listes admin). */
export async function getWorkspaceAvatars(organizationIds) {
    const map = new Map();
    if (organizationIds.length === 0)
        return map;
    const rows = await prisma.integrationConfig.findMany({
        where: { provider: WORKSPACE_PROVIDER, organizationId: { in: organizationIds } },
        select: { organizationId: true, config: true },
    });
    for (const r of rows)
        map.set(r.organizationId, readAvatar(r.config));
    return map;
}
export async function setWorkspaceAvatar(organizationId, avatarUrl) {
    await prisma.integrationConfig.upsert({
        where: { organizationId_provider: { organizationId, provider: WORKSPACE_PROVIDER } },
        create: { organizationId, provider: WORKSPACE_PROVIDER, config: { avatarUrl }, status: "CONNECTED" },
        update: { config: { avatarUrl } },
    });
}
