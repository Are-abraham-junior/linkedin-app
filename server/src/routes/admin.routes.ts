import { Router } from "express";
import {
  getUnipileAccounts,
  deleteUnipileAccount,
  runUnipileReconcile,
  getPlatformMetrics,
  getUsers,
  getUserDetails,
  createUser,
  updateUser,
  deleteUser,
  getOrganizations,
  getOrganizationMembers,
  addOrganizationMember,
  removeOrganizationMember,
  impersonateWorkspace,
  deleteOrganization,
} from "../controllers/admin.controller.js";
import { requireSuperAdmin } from "../middlewares/auth.middleware.js";

const router = Router();

// Toutes ces routes sont strictement protégées et réservées au SUPER_ADMIN
router.use(requireSuperAdmin);

router.get("/metrics", getPlatformMetrics);
router.get("/users", getUsers);
router.get("/users/:id", getUserDetails);
router.post("/users", createUser);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);
router.get("/organizations", getOrganizations);
router.delete("/organizations/:id", deleteOrganization);
router.get("/organizations/:id/members", getOrganizationMembers);
router.post("/organizations/:id/members", addOrganizationMember);
router.delete("/organizations/:orgId/members/:userId", removeOrganizationMember);
router.post("/impersonate-workspace/:id", impersonateWorkspace);

// Comptes Unipile (facturation)
router.get("/unipile/accounts", getUnipileAccounts);
router.delete("/unipile/accounts/:id", deleteUnipileAccount);
router.post("/unipile/reconcile", runUnipileReconcile);

export default router;
