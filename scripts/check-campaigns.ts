import { prisma } from "../lib/prisma.js";

async function main() {
  const campaigns = await prisma.campaign.findMany({
    include: {
      user: {
        select: { id: true, email: true, name: true, organizationId: true }
      }
    }
  });
  console.log("=== CAMPAGNES ===");
  console.log(JSON.stringify(campaigns.map(c => ({
    id: c.id,
    name: c.name,
    status: c.status,
    userId: c.userId,
    userEmail: c.user?.email,
    userOrg: c.user?.organizationId
  })), null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
