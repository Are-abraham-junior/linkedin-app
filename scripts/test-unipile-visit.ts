import { prisma } from "../lib/prisma.js";

const UNIPILE_DSN = process.env.UNIPILE_DSN || "https://api43.unipile.com:17317";
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY || "YSlLiQEj.nWSRIuxNb2mkDrVAzWcyNXP38jcr4+tFt9OpgGykHI8=";
const BASE_URL = UNIPILE_DSN.replace(/\/$/, "");

async function main() {
  const account = await prisma.linkedInAccount.findFirst({
    where: { status: "CONNECTED" },
    orderBy: { updatedAt: "desc" },
  });

  if (!account) {
    console.error("Aucun compte LinkedIn connecté trouvé !");
    process.exit(1);
  }

  console.log("Compte LinkedIn connecté:", account.accountName, account.unipileAccountId);

  // Test avec linkedin_sections=*
  const identifier = "christian-jordy-d-59654117b";
  console.log(`\nTest 1 : Appel avec linkedin_sections=* pour ${identifier}...`);
  const res1 = await fetch(`${BASE_URL}/api/v1/users/${encodeURIComponent(identifier)}?account_id=${account.unipileAccountId}&linkedin_sections=*`, {
    headers: {
      "X-API-KEY": UNIPILE_API_KEY,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
  });

  console.log("Statut HTTP Test 1:", res1.status, res1.statusText);
  if (!res1.ok) {
    console.error("Erreur Test 1:", await res1.text());
  } else {
    const data1: any = await res1.json();
    console.log("Succès Test 1 ! Nom:", data1?.first_name, data1?.last_name);
    console.log("Contact info présent ?", Boolean(data1?.contact_info));
  }

  // Test sans linkedin_sections
  console.log(`\nTest 2 : Appel sans paramètre linkedin_sections...`);
  const res2 = await fetch(`${BASE_URL}/api/v1/users/${encodeURIComponent(identifier)}?account_id=${account.unipileAccountId}`, {
    headers: {
      "X-API-KEY": UNIPILE_API_KEY,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
  });
  console.log("Statut HTTP Test 2:", res2.status, res2.statusText);
  if (res2.ok) {
    const data2: any = await res2.json();
    console.log("Succès Test 2 ! Nom:", data2?.first_name, data2?.last_name);
    console.log("Contact info présent ?", Boolean(data2?.contact_info));
  }

  process.exit(0);
}

main().catch(err => {
  console.error("Crash test:", err);
  process.exit(1);
});
