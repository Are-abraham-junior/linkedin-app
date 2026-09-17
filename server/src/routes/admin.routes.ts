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
  grantEnrichmentTokens,
} from "../controllers/admin.controller.js";
import {
  listAiProviders,
  createAiProvider,
  updateAiProvider,
  deleteAiProvider,
  activateAiProvider,
  deactivateAiProvider,
  testAiProviderConfig,
  testAiProviderById,
  listKnowledgeDocs,
  createKnowledgeDoc,
  updateKnowledgeDoc,
  deleteKnowledgeDoc,
  reseedKnowledgeDocs,
} from "../controllers/adminAi.controller.js";
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
router.post("/organizations/:id/enrichment-grant", grantEnrichmentTokens);
router.get("/organizations/:id/members", getOrganizationMembers);
router.post("/organizations/:id/members", addOrganizationMember);
router.delete("/organizations/:orgId/members/:userId", removeOrganizationMember);
router.post("/impersonate-workspace/:id", impersonateWorkspace);

// Comptes Unipile (facturation)
router.get("/unipile/accounts", getUnipileAccounts);
router.delete("/unipile/accounts/:id", deleteUnipileAccount);
router.post("/unipile/reconcile", runUnipileReconcile);

// Bleadin IA — providers et base de connaissances
router.get("/ai-providers", listAiProviders);
router.post("/ai-providers", createAiProvider);
router.post("/ai-providers/test", testAiProviderConfig);
router.put("/ai-providers/:id", updateAiProvider);
router.delete("/ai-providers/:id", deleteAiProvider);
router.post("/ai-providers/:id/activate", activateAiProvider);
router.post("/ai-providers/:id/deactivate", deactivateAiProvider);
router.post("/ai-providers/:id/test", testAiProviderById);

router.get("/ai-knowledge", listKnowledgeDocs);
router.post("/ai-knowledge", createKnowledgeDoc);
router.post("/ai-knowledge/reseed", reseedKnowledgeDocs);
router.put("/ai-knowledge/:id", updateKnowledgeDoc);
router.delete("/ai-knowledge/:id", deleteKnowledgeDoc);

export default router;
