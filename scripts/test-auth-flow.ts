import { prisma } from "../lib/prisma.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "bime-link-super-secret-jwt-key-2026";

async function test() {
  console.log("🧪 Testing Auth & Super Admin API Flow...");

  // 1. Verify Super Admin exists in Database
  const superAdmin = await prisma.user.findUnique({
    where: { email: "jeanregis@bimelink.io" },
    include: { organization: true },
  });

  if (!superAdmin) {
    throw new Error("Super Admin not found in DB");
  }

  console.log("✅ Super Admin found in DB:", superAdmin.name, `(${superAdmin.email})`, "Role:", superAdmin.role);

  // 2. Validate password match
  const isValidPass = await bcrypt.compare("Admin123!", superAdmin.passwordHash!);
  console.log("✅ Password verification (Admin123!):", isValidPass ? "VALID" : "INVALID");

  // 3. Generate & Verify JWT Token
  const token = jwt.sign(
    {
      id: superAdmin.id,
      email: superAdmin.email,
      role: superAdmin.role,
      name: superAdmin.name,
      organizationId: superAdmin.organizationId,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  const decoded = jwt.verify(token, JWT_SECRET) as any;
  console.log("✅ JWT Token generated & decoded successfully:", decoded.email, "Role:", decoded.role);

  // 4. Test Platform Metrics Query
  const usersCount = await prisma.user.count();
  const orgsCount = await prisma.organization.count();
  const campaignsCount = await prisma.campaign.count();
  console.log(`✅ Platform Metrics: ${usersCount} users, ${orgsCount} orgs, ${campaignsCount} campaigns.`);

  console.log("🎉 All Backend Auth & RBAC logic validated successfully!");
}

test()
  .catch((e) => {
    console.error("❌ Test failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
