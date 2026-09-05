import { prisma } from "../lib/prisma";

async function main() {
  console.log("=== Début de la réaffectation et isolation des comptes LinkedIn ===");

  const gnakouri = await prisma.user.findUnique({
    where: { email: "gnakourijl@yahoo.fr" },
  });
  const abraham = await prisma.user.findUnique({
    where: { email: "areabraham225@gmail.com" },
  });
  const elise = await prisma.user.findUnique({
    where: { email: "elise.ahua@yadec.ci" },
  });

  if (!gnakouri || !abraham || !elise) {
    console.error("Utilisateurs introuvables:", { gnakouri: !!gnakouri, abraham: !!abraham, elise: !!elise });
    return;
  }

  // 1. Réaffecter le compte LinkedIn de Jean-Luc Gnakouri à son utilisateur
  const gnakouriAcc = await prisma.linkedInAccount.findFirst({
    where: { unipileAccountId: "_M7-2bn7Rv2nnBg9su-fWw" },
  });
  if (gnakouriAcc) {
    await prisma.linkedInAccount.update({
      where: { id: gnakouriAcc.id },
      data: {
        userId: gnakouri.id,
      },
    });
    console.log(`✅ Compte LinkedIn de Jean-Luc GNAKOURI réaffecté à ${gnakouri.email} (${gnakouri.id})`);
  }

  // 2. Réaffecter la liste des prospects issus de la messagerie de Gnakouri
  const gnakouriList = await prisma.prospectList.findFirst({
    where: {
      name: "Messagerie LinkedIn",
      userId: abraham.id,
    },
  });
  if (gnakouriList) {
    await prisma.prospectList.update({
      where: { id: gnakouriList.id },
      data: {
        userId: gnakouri.id,
      },
    });
    console.log(`✅ Liste « Messagerie LinkedIn » réaffectée à ${gnakouri.email}`);
  }

  // 3. Nettoyer les comptes LinkedIn obsolètes/vides d'Abraham Are
  const deletedStale = await prisma.linkedInAccount.deleteMany({
    where: {
      userId: abraham.id,
      unipileAccountId: { in: ["2v-eSnguQoqFEysEShd0sg", "hKOxKZKMT367CoYQd8CJPw", "JXlaAti2SdS1_C_iu9vCXw"] },
    },
  });
  console.log(`✅ Supprimé ${deletedStale.count} comptes obsolètes pour Abraham Are.`);

  // 4. Vérification finale
  const checkUsers = await prisma.user.findMany({
    include: {
      organization: true,
      accounts: true,
      prospectLists: {
        include: { _count: { select: { prospects: true } } },
      },
    },
  });

  for (const u of checkUsers) {
    console.log(`\nUtilisateur: ${u.name} (${u.email}) [Org: ${u.organization?.name}]`);
    console.log(`Comptes LinkedIn (${u.accounts.length}):`, u.accounts.map(a => `${a.accountName} (${a.unipileAccountId}) [${a.status}]`));
    console.log(`Listes (${u.prospectLists.length}):`, u.prospectLists.map(l => `${l.name} (${l._count.prospects} prospects)`));
  }

  console.log("\n=== Réaffectation terminée avec succès ===");
}

main()
  .catch((e) => console.error("Erreur:", e))
  .finally(() => prisma.$disconnect());
