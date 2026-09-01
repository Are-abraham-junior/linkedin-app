import { prisma } from "../../../lib/prisma.js";

async function testQueueBackend() {
  console.log("=== TEST QUEUE BACKEND ===");

  // 1. Check user and schedule fields
  const user = await prisma.user.findFirst({
    include: { accounts: true },
  });

  if (!user) {
    console.log("No user found");
    return;
  }

  console.log(`User: ${user.name} (${user.email})`);
  console.log(`Working days:`, user.workingDays);
  console.log(`Working hours: ${user.workingHoursStart} - ${user.workingHoursEnd}`);
  console.log(`Max daily: ${user.maxDailyInvites} invites / ${user.maxDailyMsg} messages`);

  // 2. Count queued actions
  const accountIds = user.accounts.map((a) => a.id);
  const queuedCount = await prisma.actionQueue.count({
    where: { accountId: { in: accountIds } },
  });
  console.log(`Total action queues in DB for user accounts: ${queuedCount}`);

  // 3. Fetch actions with relations
  const actions = await prisma.actionQueue.findMany({
    where: { accountId: { in: accountIds } },
    include: {
      prospect: { select: { firstName: true, lastName: true, company: true } },
      campaign: { select: { name: true, status: true } },
    },
    take: 5,
  });

  console.log(`Found ${actions.length} sample actions:`);
  for (const a of actions) {
    console.log(`- [${a.actionType}] ${a.prospect?.firstName} ${a.prospect?.lastName} | Campaign: "${a.campaign?.name}" | Status: ${a.status} | Scheduled: ${a.scheduledFor.toISOString()}`);
  }

  console.log("\n✅ Backend query test completed successfully!");
  await prisma.$disconnect();
}

testQueueBackend().catch(console.error);
