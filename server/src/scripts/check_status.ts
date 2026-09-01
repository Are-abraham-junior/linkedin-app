import { prisma } from "../../../lib/prisma.js";

async function check() {
  const actions = await prisma.actionQueue.findMany({
    where: { campaignId: "f7619341-dded-4e6b-9cec-26e37ecb26c8" },
  });
  for (const a of actions) {
    console.log("Action:", a.actionType, "| Status:", a.status, "| Error:", a.errorMessage || "none");
  }
  await prisma.$disconnect();
}
check();
