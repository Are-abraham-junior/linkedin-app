import { prisma } from "../../../lib/prisma.js";
async function fixAndReset() {
    const CAMPAIGN_ID = "f7619341-dded-4e6b-9cec-26e37ecb26c8";
    // 1. Update provider IDs for both prospects
    console.log("=== Updating providerProfileId ===");
    const jl = await prisma.prospect.updateMany({
        where: { linkedinUrl: { contains: "gnakourijl" } },
        data: { providerProfileId: "ACoAAAGWPjEBrNOkwvBBBJVIJPq1pntNMBUL9rs" },
    });
    console.log(`Jean-Luc updated: ${jl.count}`);
    const tosten = await prisma.prospect.updateMany({
        where: { linkedinUrl: { contains: "tosten-kouya" } },
        data: { providerProfileId: "ACoAADxs8d8B1hXLn7vpDX5pXsQTOTk0BwM5jdY" },
    });
    console.log(`Tosten updated: ${tosten.count}`);
    // 2. Reset all FAILED actions for this campaign to QUEUED with scheduledFor = NOW
    const now = new Date();
    const resetActions = await prisma.actionQueue.updateMany({
        where: {
            campaignId: CAMPAIGN_ID,
            status: { in: ["FAILED", "EXECUTING"] },
        },
        data: {
            status: "QUEUED",
            scheduledFor: now,
            executedAt: null,
            errorMessage: null,
        },
    });
    console.log(`Actions reset to QUEUED: ${resetActions.count}`);
    // 3. Reset prospect campaign states to PENDING
    const resetStates = await prisma.prospectCampaignState.updateMany({
        where: {
            campaignId: CAMPAIGN_ID,
            status: "FAILED",
        },
        data: {
            status: "PENDING",
            errorLog: null,
        },
    });
    console.log(`ProspectCampaignStates reset: ${resetStates.count}`);
    // 4. Ensure campaign is ACTIVE
    await prisma.campaign.update({
        where: { id: CAMPAIGN_ID },
        data: { status: "ACTIVE" },
    });
    console.log(`Campaign set to ACTIVE`);
    console.log("\n✅ Done! The worker will pick up these actions in ~1 minute.");
    await prisma.$disconnect();
}
fixAndReset().catch(console.error);
