import { Router } from "express";
import { getSetupStatus, setupSuperAdmin, register, login, getMe, linkedinAuth, linkedinAuthCheckpoint, linkedinAuthResendCheckpoint, acceptInvitation, forgotPassword, resetPassword, } from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
const router = Router();
router.get("/setup-status", getSetupStatus);
router.post("/setup-superadmin", setupSuperAdmin);
router.post("/register", register);
router.post("/login", login);
router.get("/me", requireAuth, getMe);
router.post("/linkedin", linkedinAuth);
// Checkpoint 2FA après /linkedin : résolution sur le même account_id (pas de nouveau compte Unipile)
router.post("/linkedin/checkpoint", linkedinAuthCheckpoint);
router.post("/linkedin/checkpoint/resend", linkedinAuthResendCheckpoint);
router.post("/join", acceptInvitation);
// Mot de passe oublié (public) : demande de lien, puis réinitialisation via le jeton reçu par e-mail
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
export default router;
