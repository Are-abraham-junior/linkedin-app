import "dotenv/config";
import { prisma } from "../lib/prisma.js";

async function main() {
  console.log("Cleaning up test accounts for yao konan and pierre koffi...");

  // 1. Find yao konan
  const yao = await prisma.user.findUnique({
    where: { email: "yao.konan@test.com" },
    include: { accounts: true },
  });

  if (yao) {
    console.log(`Found Yao Konan (id: ${yao.id}). Removing attached test LinkedIn accounts...`);
    await prisma.linkedInAccount.deleteMany({
      where: { userId: yao.id },
    });
    await prisma.user.update({
      where: { id: yao.id },
      data: {
        avatarUrl: null,
        linkedinEmail: null,
        linkedinProfileId: null,
      },
    });
    console.log("✓ Yao Konan reset to clean initial state (no LinkedIn account, no avatar).");
  }

  // 2. Find pierre koffi
  const pierre = await prisma.user.findUnique({
    where: { email: "pierre.koffi@test.com" },
    include: { accounts: true },
  });

  if (pierre) {
    console.log(`Found Pierre Koffi (id: ${pierre.id}). Resetting avatarUrl...`);
    await prisma.linkedInAccount.deleteMany({
      where: { userId: pierre.id },
    });
    await prisma.user.update({
      where: { id: pierre.id },
      data: {
        avatarUrl: null,
        linkedinEmail: null,
        linkedinProfileId: null,
      },
    });
    console.log("✓ Pierre Koffi reset to clean initial state.");
  }

  console.log("Cleanup completed successfully.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Cleanup error:", err);
    process.exit(1);
  });
