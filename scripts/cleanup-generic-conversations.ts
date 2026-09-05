import { prisma } from "../lib/prisma";

async function main() {
  console.log("=== Début du nettoyage des conversations génériques ===");

  // 1. Identifier les prospects génériques ou publicitaires
  const genericProspects = await prisma.prospect.findMany({
    where: {
      OR: [
        { firstName: "Contact", lastName: "LinkedIn" },
        { firstName: { contains: "Contact", mode: "insensitive" }, lastName: { contains: "LinkedIn", mode: "insensitive" } },
        { firstName: { contains: "Invitation", mode: "insensitive" } },
        { firstName: { contains: "Découvrez", mode: "insensitive" } },
        { firstName: { contains: "Vous êtes invité", mode: "insensitive" } },
        { firstName: { contains: "Conférence", mode: "insensitive" } },
        { firstName: { contains: "Votre profil", mode: "insensitive" } },
        { headline: { contains: "NESCI", mode: "insensitive" } },
        { headline: { contains: "Gartner", mode: "insensitive" } },
        { headline: { contains: "Odoo Business", mode: "insensitive" } },
        { headline: { contains: "MBA MSIE", mode: "insensitive" } },
      ],
    },
    include: {
      conversations: true,
    },
  });

  console.log(`Trouvé ${genericProspects.length} prospects génériques/publicitaires à nettoyer.`);

  const prospectIds = genericProspects.map((p) => p.id);

  if (prospectIds.length > 0) {
    // 2. Trouver les IDs des conversations à supprimer
    const convsToDelete = await prisma.conversation.findMany({
      where: { prospectId: { in: prospectIds } },
      select: { id: true },
    });
    const convIds = convsToDelete.map((c) => c.id);

    if (convIds.length > 0) {
      const deletedMessages = await prisma.message.deleteMany({
        where: { conversationId: { in: convIds } },
      });
      console.log(`Supprimé ${deletedMessages.count} messages liés.`);
    }

    // 3. Supprimer les conversations associées
    const deletedConvs = await prisma.conversation.deleteMany({
      where: {
        prospectId: { in: prospectIds },
      },
    });
    console.log(`Supprimé ${deletedConvs.count} conversations génériques.`);

    // 4. Supprimer les états de campagne orphelins éventuels
    await prisma.prospectCampaignState.deleteMany({
      where: {
        prospectId: { in: prospectIds },
      },
    });

    // 5. Supprimer les prospects génériques
    const deletedProspects = await prisma.prospect.deleteMany({
      where: {
        id: { in: prospectIds },
      },
    });
    console.log(`Supprimé ${deletedProspects.count} prospects génériques.`);
  }

  // 6. Nettoyer les listes vides "Messagerie LinkedIn" si plus aucun prospect
  const emptyLists = await prisma.prospectList.findMany({
    where: {
      name: "Messagerie LinkedIn",
      prospects: { none: {} },
    },
  });
  if (emptyLists.length > 0) {
    await prisma.prospectList.deleteMany({
      where: { id: { in: emptyLists.map((l) => l.id) } },
    });
    console.log(`Supprimé ${emptyLists.length} listes « Messagerie LinkedIn » désormais vides.`);
  }

  console.log("=== Nettoyage terminé avec succès ===");
}

main()
  .catch((e) => {
    console.error("Erreur nettoyage:", e);
  })
  .finally(() => prisma.$disconnect());
