import { prisma } from "../../../lib/prisma.js";

async function check() {
  const campaign = await prisma.campaign.findFirst({
    orderBy: { createdAt: "desc" },
    include: {
      prospectStates: {
        include: { prospect: true },
      },
      steps: true,
    },
  });

  if (!campaign) {
    console.log("No campaigns found");
    return;
  }

  console.log("=== CAMPAIGN ===");
  console.log(`ID: ${campaign.id}`);
  console.log(`Name: ${campaign.name}`);
  console.log(`Status: ${campaign.status}`);

  console.log("\n=== PROSPECTS ===");
  for (const state of campaign.prospectStates) {
    const p = state.prospect;
    console.log(`- ${p.firstName} ${p.lastName}`);
    console.log(`  ID (Prisma): ${p.id}`);
    console.log(`  providerProfileId: "${p.providerProfileId || "MISSING!"}"`);
    console.log(`  linkedinUrl: ${p.linkedinUrl || "MISSING!"}`);
    console.log(`  connectionStatus: ${p.connectionStatus}`);
    console.log(`  State status: ${state.status}`);
  }

  // Get action queue for this campaign
  const actions = await prisma.actionQueue.findMany({
    where: { campaignId: campaign.id },
    include: { prospect: true },
  });

  console.log("\n=== ACTION QUEUE ===");
  for (const action of actions) {
    console.log(`- ActionType: ${action.actionType} | Status: ${action.status}`);
    console.log(`  ProspectID: ${action.prospectId}`);
    console.log(`  Prospect providerProfileId: "${action.prospect?.providerProfileId || "MISSING!"}"`);
    console.log(`  Error: ${action.errorMessage || "none"}`);
    console.log(`  Payload: ${JSON.stringify(action.payload)}`);
  }

  await prisma.$disconnect();
}

check().catch(console.error);
