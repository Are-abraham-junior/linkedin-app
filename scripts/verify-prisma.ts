import { prisma } from "../lib/prisma.js";

async function verify() {
  try {
    const userCount = await prisma.user.count();
    const prospectCount = await prisma.prospect.count();
    const campaignCount = await prisma.campaign.count();
    const messageCount = await prisma.message.count();

    console.log("✅ Connected");
    console.log(`📊 Statistiques de la base :`);
    console.log(`   - Utilisateurs : ${userCount}`);
    console.log(`   - Prospects : ${prospectCount}`);
    console.log(`   - Campagnes : ${campaignCount}`);
    console.log(`   - Messages synchronisés : ${messageCount}`);
  } catch (error: any) {
    console.error("❌ Failed to connect to Prisma Postgres:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
