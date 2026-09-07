import { prisma } from "../lib/prisma.js";

async function main() {
  const envAccountId = process.env.UNIPILE_ACCOUNT_ID;
  const envDsn = process.env.UNIPILE_DSN;
  const envKey = process.env.UNIPILE_API_KEY;

  console.log("=== ENV INFO ===");
  console.log("UNIPILE_DSN:", envDsn);
  console.log("UNIPILE_ACCOUNT_ID in .env:", envAccountId);
  console.log("UNIPILE_API_KEY prefix:", envKey?.slice(0, 10));

  const accounts = await prisma.linkedInAccount.findMany({
    include: {
      user: {
        select: { id: true, email: true, name: true }
      }
    }
  });

  console.log("\n=== DATABASE LINKEDIN ACCOUNTS ===");
  console.log(JSON.stringify(accounts, null, 2));

  // Test account status directly on Unipile with the new credentials
  console.log("\n=== TEST UNIPILE CALL WITH NEW CREDENTIALS ===");
  const base = envDsn?.replace(/\/$/, "");
  const res = await fetch(`${base}/api/v1/accounts`, {
    headers: {
      "X-API-KEY": envKey || "",
      "Accept": "application/json"
    }
  });

  console.log("Unipile /api/v1/accounts HTTP status:", res.status);
  if (res.ok) {
    const data: any = await res.json();
    console.log("Accounts on new Unipile subscription:", JSON.stringify(data, null, 2));
  } else {
    console.log("Error response:", await res.text());
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
