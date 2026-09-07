import { prisma } from "../lib/prisma.js";
import { UnipileService } from "../server/src/services/unipile.service.js";

async function main() {
  const newUnipileAccountId = process.env.UNIPILE_ACCOUNT_ID || "8oH2mAJZS2ef-1Q5PWsnWQ";
  console.log("=== 1. SYNCHRONISATION DU COMPTE LINKEDIN ===");

  // Trouver l'utilisateur Abraham Are
  const user = await prisma.user.findFirst({
    where: { email: { contains: "areabraham225", mode: "insensitive" } },
    include: { accounts: true },
  });

  if (!user) {
    console.error("Utilisateur Abraham Are introuvable !");
    process.exit(1);
  }

  console.log(`Utilisateur trouvé: ${user.name} (${user.email}) - ID: ${user.id}`);

  // Mettre à jour le compte LinkedIn de l'utilisateur avec le nouvel ID Unipile
  const updatedAccount = await prisma.linkedInAccount.upsert({
    where: { unipileAccountId: newUnipileAccountId },
    create: {
      userId: user.id,
      unipileAccountId: newUnipileAccountId,
      accountName: "Abraham Are",
      status: "CONNECTED",
    },
    update: {
      userId: user.id,
      status: "CONNECTED",
      accountName: "Abraham Are",
    },
  });

  // Si l'ancien compte existe encore en base sous l'ancien ID, on réassigne ou nettoie
  await prisma.linkedInAccount.updateMany({
    where: {
      userId: user.id,
      unipileAccountId: { not: newUnipileAccountId },
    },
    data: {
      status: "DISCONNECTED",
    },
  });

  console.log(`Compte LinkedIn actif mis à jour avec unipileAccountId: ${updatedAccount.unipileAccountId}`);

  console.log("\n=== 2. MISE A JOUR DE LA CAMPAGNE DEVELOPPEURS ===");
  const campaign = await prisma.campaign.findFirst({
    where: { name: { contains: "DEVELOPPEURS", mode: "insensitive" } },
    include: {
      steps: true,
      prospectStates: {
        include: { prospect: true },
      },
    },
  });

  if (!campaign) {
    console.error("Campagne DEVELOPPEURS introuvable !");
    process.exit(1);
  }

  // Lier la campagne au bon compte
  await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      accountId: updatedAccount.id,
      status: "ACTIVE",
    },
  });
  console.log(`Campagne ${campaign.name} liée au compte ${updatedAccount.id} et statut ACTIVE`);

  // Récupérer la première étape (Visite profil)
  const firstStep = campaign.steps.sort((a, b) => a.stepOrder - b.stepOrder)[0];
  console.log("Première étape:", firstStep?.actionType, firstStep?.id);

  console.log("\n=== 3. REINITIALISATION DES PROSPECTS EN ECHEC ===");
  const failedStates = campaign.prospectStates.filter(ps => ps.status === "FAILED");
  console.log(`Nombre de prospects en échec à réinitialiser : ${failedStates.length}`);

  for (const ps of failedStates) {
    await prisma.prospectCampaignState.update({
      where: { id: ps.id },
      data: {
        status: "PENDING",
        currentStepId: firstStep?.id || ps.currentStepId,
        errorLog: null,
        nextExecutionAt: new Date(), // prêt à être exécuté immédiatement
      },
    });
  }

  // Nettoyer les actions échouées dans ActionQueue et les reprogrammer
  const deletedActions = await prisma.actionQueue.deleteMany({
    where: {
      campaignId: campaign.id,
      status: "FAILED",
    },
  });
  console.log(`Actions échouées nettoyées de la file d'attente: ${deletedActions.count}`);

  // Re-créer les actions dans ActionQueue pour les prospects réinitialisés
  let scheduledCount = 0;
  for (const ps of failedStates) {
    if (!firstStep) continue;
    await prisma.actionQueue.create({
      data: {
        accountId: updatedAccount.id,
        prospectId: ps.prospectId,
        campaignId: campaign.id,
        actionType: firstStep.actionType,
        payload: {
          stepId: firstStep.id,
          messageText: firstStep.messageText || "",
        },
        scheduledFor: new Date(Date.now() + scheduledCount * 15000), // jitter 15s entre chaque
        status: "QUEUED",
      },
    });
    scheduledCount++;
  }
  console.log(`Nouvelles actions planifiées dans ActionQueue : ${scheduledCount}`);

  console.log("\n=== 4. TEST EN DIRECT SUR UN PROSPECT AVEC LE NOUVEL ABONNEMENT ===");
  const testProspect = failedStates[0]?.prospect;
  if (testProspect) {
    console.log(`Test visite profil sur ${testProspect.firstName} ${testProspect.lastName} (${testProspect.linkedinUrl})...`);
    const testRes = await UnipileService.visitProfile({
      accountId: updatedAccount.unipileAccountId,
      identifier: testProspect.linkedinUrl,
    });
    console.log("Résultat visite profil :", JSON.stringify(testRes, null, 2));
  }

  console.log("\n✅ TERMINÉ AVEC SUCCÈS !");
  process.exit(0);
}

main().catch(err => {
  console.error("Erreur lors de la réinitialisation:", err);
  process.exit(1);
});
