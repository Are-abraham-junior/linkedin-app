import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { disconnectAccount } from "../controllers/linkedin.controller.js";
import {
  getWorkspaceSettings,
  updateWorkspaceSettings,
  getAccountSettings,
  updateAccountSettings,
  getLinkedInSettings,
  reconnectLinkedInDirect,
  resolveLinkedInCheckpoint,
  resendLinkedInCheckpoint,
  getImportHistory,
  getImportDetails,
  getApiKeys,
  createApiKey,
  revokeApiKey,
  getIntegrations,
  saveIntegration,
  testIntegrationConnection,
  getBillingInfo,
  downloadInvoicePdf,
} from "../controllers/settings.controller.js";

const router = Router();

router.use(requireAuth);

// 0. Espace de travail (photo de profil de l'organisation)
router.get("/workspace", getWorkspaceSettings);
router.put("/workspace", updateWorkspaceSettings);

// 1. Compte Bleadin
router.get("/account", getAccountSettings);
router.put("/account", updateAccountSettings);

// 2. Reconnexion & Santé LinkedIn
router.get("/linkedin", getLinkedInSettings);
router.post("/linkedin/reconnect", reconnectLinkedInDirect);
router.post("/linkedin/checkpoint", resolveLinkedInCheckpoint);
router.post("/linkedin/checkpoint/resend", resendLinkedInCheckpoint);
// Déconnexion depuis Paramètres (le client appelait cette route inexistante → compte Unipile jamais supprimé)
router.post("/linkedin/disconnect", disconnectAccount);

// 3. Historique des importations
router.get("/imports", getImportHistory);
router.get("/imports/:id", getImportDetails);

// 4. Clés API & Intégrations
router.get("/api-keys", getApiKeys);
router.post("/api-keys", createApiKey);
router.delete("/api-keys/:id", revokeApiKey);

router.get("/integrations", getIntegrations);
router.post("/integrations", saveIntegration);
router.post("/integrations/test", testIntegrationConnection);

// 5. Facturation & Abonnement
router.get("/billing", getBillingInfo);
router.get("/billing/invoices/:id/pdf", downloadInvoicePdf);

export default router;
