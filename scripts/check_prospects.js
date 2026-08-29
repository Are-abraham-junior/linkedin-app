import { prisma } from "../lib/prisma.js";

async function main() {
  const prospects = await prisma.prospect.findMany({
    take: 10,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      headline: true,
      company: true,
      providerProfileId: true,
      linkedinUrl: true,
    }
  });
  console.log(JSON.stringify(prospects, null, 2));
}

main().finally(() => prisma.$disconnect());
