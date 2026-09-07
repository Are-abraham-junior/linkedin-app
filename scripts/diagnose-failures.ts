import { prisma } from "../lib/prisma.js";

async function main() {
  const campaign = await prisma.campaign.findFirst({
    where: { name: { contains: "DEVELOPPEURS", mode: "insensitive" } },
    include: {
      steps: true,
      linkedInAccount: true,
      user: {
        include: {
          accounts: true,
        },
      },
      prospectStates: {
        include: {
          prospect: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              linkedinUrl: true,
              providerProfileId: true,
            },
          },
          currentStep: true,
        },
      },
      actions: {
        take: 20,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!campaign) {
    console.log("No campaign found with name DEVELOPPEURS");
    return;
  }

  console.log("=== CAMPAGNE ===");
  console.log({
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    accountId: campaign.accountId,
    linkedInAccount: campaign.linkedInAccount,
    userAccounts: campaign.user.accounts,
  });

  console.log("\n=== ÉTAPES ===");
  console.log(campaign.steps);

  console.log("\n=== PROSPECT STATES (Failed) ===");
  const failedStates = campaign.prospectStates.filter(ps => ps.status === "FAILED");
  console.log(`Total prospect states: ${campaign.prospectStates.length}, Failed: ${failedStates.length}`);
  console.log(failedStates.slice(0, 5).map(ps => ({
    prospectName: `${ps.prospect.firstName} ${ps.prospect.lastName}`,
    linkedinUrl: ps.prospect.linkedinUrl,
    providerProfileId: ps.prospect.providerProfileId,
    status: ps.status,
    errorLog: ps.errorLog,
    currentStep: ps.currentStep?.actionType,
  })));

  console.log("\n=== ACTIONS RECENTES ===");
  console.log(campaign.actions.map(a => ({
    id: a.id,
    actionType: a.actionType,
    status: a.status,
    errorMessage: a.errorMessage,
    scheduledFor: a.scheduledFor,
    executedAt: a.executedAt,
    payload: a.payload,
  })));

  process.exit(0);
}

main().catch(err => {
  console.error("Diagnostic error:", err);
  process.exit(1);
});
