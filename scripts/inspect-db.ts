import "dotenv/config";
import { prisma } from "../lib/prisma.js";

async function main() {
  const users = await prisma.user.findMany({
    include: {
      organization: true,
      accounts: true,
    },
  });

  console.log("=== USERS & LINKEDIN ACCOUNTS ===");
  for (const u of users) {
    console.log(JSON.stringify({
      id: u.id,
      name: u.name,
      email: u.email,
      linkedinEmail: u.linkedinEmail,
      avatarUrl: u.avatarUrl,
      orgRole: u.orgRole,
      role: u.role,
      orgName: u.organization?.name,
      accounts: u.accounts.map(a => ({
        id: a.id,
        unipileAccountId: a.unipileAccountId,
        accountName: a.accountName,
        profilePicture: a.profilePicture,
        headline: a.headline,
        status: a.status,
      }))
    }, null, 2));
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
