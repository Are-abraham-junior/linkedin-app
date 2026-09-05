import { prisma } from "../../lib/prisma.js";
import { UnipileService } from "./services/unipile.service.js";
async function main() {
    const user = await prisma.user.findFirst({
        where: { email: "areabraham225@gmail.com" },
        include: { accounts: { orderBy: { updatedAt: "desc" } } }
    });
    if (!user) {
        console.log("User not found!");
        return;
    }
    // Clean up old disconnected account Oz3yZJjGQgybU9fpwKYZMA if present
    await prisma.linkedInAccount.deleteMany({
        where: { unipileAccountId: "Oz3yZJjGQgybU9fpwKYZMA" }
    });
    const activeAcc = await prisma.linkedInAccount.findFirst({
        where: { userId: user.id, status: "CONNECTED" },
        orderBy: { updatedAt: "desc" }
    });
    if (!activeAcc?.unipileAccountId) {
        console.error("Aucun compte LinkedIn connecté avec un unipileAccountId valide.");
        return;
    }
    console.log("Using active unipileAccountId:", activeAcc.unipileAccountId);
    const prospects = await prisma.prospect.findMany({
        where: { list: { userId: user.id } }
    });
    for (const p of prospects) {
        const identifier = p.providerProfileId || p.linkedinUrl;
        console.log(`Syncing prospect ${p.firstName} ${p.lastName} (${identifier})...`);
        const result = await UnipileService.getProfileDetailsAndStatus(identifier, activeAcc.unipileAccountId);
        console.log(`Result for ${p.firstName}: connectionStatus = ${result.connectionStatus}`);
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
        const updated = await prisma.prospect.update({
            where: { id: p.id },
            data: updateData,
        });
        console.log(`Updated ${updated.firstName} ${updated.lastName}: new status = ${updated.connectionStatus}`);
    }
}
main().finally(() => prisma.$disconnect());
