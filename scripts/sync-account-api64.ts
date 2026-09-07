import "dotenv/config";
import { prisma } from "../lib/prisma.js";

async function main() {
  const newAccountId = process.env.UNIPILE_ACCOUNT_ID || "IbiDC9dvQyePtXoVMIFEqQ";
  console.log("Syncing database with account:", newAccountId);

  const user = await prisma.user.findFirst({
    where: { email: "areabraham225@gmail.com" },
    include: { accounts: true }
  });

  if (!user) {
    console.error("User not found");
    process.exit(1);
  }

  console.log("User:", user.id, user.name);

  // Update or create active LinkedIn account
  const account = await prisma.linkedInAccount.upsert({
    where: { unipileAccountId: newAccountId },
    create: {
      userId: user.id,
      unipileAccountId: newAccountId,
      accountName: "Abraham Are",
      status: "CONNECTED",
      headline: "Développeur Web & Passionné de Cybersécurité | React • JavaScript • Sécurité des applications | Automatisation & IA",
      profilePicture: "https://media.licdn.com/dms/image/v2/D4E03AQESK2GC7brzFg/profile-displayphoto-scale_400_400/B4EZ_nHWGCKUAg-/0/1786288891414?e=1790208000&v=beta&t=VEmkI5t9968pEkNepIz933pv3_cqOQUFz7mFdYb3oco",
    },
    update: {
      userId: user.id,
      accountName: "Abraham Are",
      status: "CONNECTED",
    },
  });

  // Delete old account associations for this user
  await prisma.linkedInAccount.deleteMany({
    where: {
      userId: user.id,
      unipileAccountId: { not: newAccountId },
    },
  });

  // Resume paused campaigns
  await prisma.campaign.updateMany({
    where: { userId: user.id, status: "PAUSED" },
    data: { status: "ACTIVE" },
  });

  console.log("✅ Successfully synced account:", account.unipileAccountId, "status:", account.status);
  process.exit(0);
}

main().catch((err) => {
  console.error("Sync error:", err);
  process.exit(1);
});
