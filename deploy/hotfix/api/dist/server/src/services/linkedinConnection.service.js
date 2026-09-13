import { prisma } from "../../../lib/prisma.js";
import { UnipileService } from "./unipile.service.js";
/**
 * Connexion / reconnexion LinkedIn sans doublon Unipile.
 *
 * Règle d'or : chaque `POST /accounts` crée un nouveau compte FACTURÉ chez Unipile.
 * On ne crée donc un compte que s'il n'en existe aucun pour cet utilisateur ; sinon on
 * reconnecte sur l'account_id existant (`POST /accounts/{id}`), qui conserve l'id,
 * l'historique et les webhooks. Après toute connexion réussie, on dédoublonne par
 * identité LinkedIn (provider_id "ACo...") et on garde une seule ligne en base.
 */
/** Durée de vie d'un intent d'authentification Unipile (checkpoint à résoudre dans ce délai). */
export const CHECKPOINT_TTL_MS = 5 * 60 * 1000;
/**
 * Reconnecte sur l'id existant si possible, sinon crée. Ne persiste rien : voir persistLinkedInAccount.
 */
export async function connectOrReconnect(params) {
    const email = params.email.trim();
    let reused = false;
    let result;
    if (params.existingAccountId) {
        console.log(`[LinkedInConnection] Reconnexion sur le compte Unipile existant ${params.existingAccountId}`);
        result = await UnipileService.reconnectLinkedInAccount(params.existingAccountId, email, params.password);
        reused = true;
        if (!result.success && result.notFound) {
            // Le compte n'existe plus chez Unipile (supprimé manuellement) → création légitime
            console.warn(`[LinkedInConnection] Compte ${params.existingAccountId} introuvable chez Unipile → création`);
            result = await UnipileService.connectLinkedInAccount(email, params.password);
            reused = false;
        }
    }
    else {
        result = await UnipileService.connectLinkedInAccount(email, params.password);
    }
    if (!result.success) {
        if (result.status === "CHECKPOINT") {
            const accountId = result.checkpoint?.account_id || result.checkpoint?.id || params.existingAccountId || "";
            return { kind: "CHECKPOINT", accountId, checkpoint: result.checkpoint, reused };
        }
        return {
            kind: "ERROR",
            error: result.error || "Identifiants LinkedIn invalides. Veuillez vérifier votre mot de passe.",
            statusCode: result.statusCode,
        };
    }
    return finalizeConnection(result.accountId, reused);
}
/**
 * Après une authentification réussie (directe ou via checkpoint) : profil + dédoublonnage Unipile.
 */
export async function finalizeConnection(accountId, reused = false) {
    const profileResult = await UnipileService.getConnectedAccountProfile(accountId).catch(() => null);
    const profile = profileResult?.profile || null;
    // Filet de sécurité facturation : un seul compte Unipile par identité LinkedIn (await, jamais fire-and-forget)
    const removedDuplicates = await UnipileService.dedupeUnipileAccounts(accountId, profile?.linkedinProfileId).catch((err) => {
        console.warn("[LinkedInConnection] Dédoublonnage Unipile impossible:", err?.message || err);
        return [];
    });
    return { kind: "CONNECTED", accountId, profile, reused, removedDuplicates };
}
/**
 * Garde UNE seule ligne LinkedInAccount pour l'utilisateur, pointant sur `accountId`.
 * Les autres account_id de cet utilisateur sont supprimés chez Unipile (await) puis en base.
 */
export async function persistLinkedInAccount(userId, accountId, profile, status, fallbackName) {
    const others = await prisma.linkedInAccount.findMany({
        where: { userId, unipileAccountId: { not: accountId } },
        select: { id: true, unipileAccountId: true },
    });
    for (const old of others) {
        if (old.unipileAccountId) {
            const del = await UnipileService.deleteAccount(old.unipileAccountId);
            if (!del.success) {
                // On garde la ligne : un compte encore facturé ne doit pas devenir invisible (le worker de réconciliation réessaiera)
                console.warn(`[LinkedInConnection] Ancien compte ${old.unipileAccountId} non supprimé chez Unipile, ligne conservée`);
                continue;
            }
        }
        await prisma.linkedInAccount.delete({ where: { id: old.id } }).catch(() => { });
    }
    const data = {
        userId,
        accountName: profile?.name || fallbackName || undefined,
        profilePicture: profile?.avatarUrl ?? undefined,
        headline: profile?.headline ?? undefined,
        status,
        isPremium: profile?.isPremium ?? false,
        hasSalesNavigator: profile?.hasSalesNavigator ?? false,
        accountType: profile?.accountType ?? "STANDARD",
    };
    return prisma.linkedInAccount.upsert({
        where: { unipileAccountId: accountId },
        create: { unipileAccountId: accountId, ...data },
        update: data,
    });
}
/**
 * Si l'utilisateur a un checkpoint en attente et encore valable (< 5 min), renvoie son account_id :
 * l'appelant doit redemander le code au lieu de relancer une authentification (qui créerait un doublon).
 * Au-delà, l'intent Unipile a expiré : la ligne est nettoyée (compte supprimé si ce n'est pas un compte réutilisé).
 */
export async function pendingCheckpointFor(userId) {
    const row = await prisma.linkedInAccount.findFirst({
        where: { userId, status: "CHECKPOINT" },
        orderBy: { updatedAt: "desc" },
    });
    if (!row)
        return null;
    if (Date.now() - row.updatedAt.getTime() < CHECKPOINT_TTL_MS) {
        return { accountId: row.unipileAccountId, checkpoint: { account_id: row.unipileAccountId } };
    }
    // Intent expiré : on repasse la ligne en DISCONNECTED (le compte Unipile reste réutilisable via reconnect)
    await prisma.linkedInAccount.update({ where: { id: row.id }, data: { status: "DISCONNECTED" } }).catch(() => { });
    return null;
}
/** Reprend les campagnes mises en pause par la déconnexion. */
export async function resumePausedCampaigns(userId) {
    await prisma.campaign.updateMany({ where: { userId, status: "PAUSED" }, data: { status: "ACTIVE" } }).catch(() => { });
}
