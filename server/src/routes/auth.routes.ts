import { Router } from "express";
import { getSetupStatus, setupSuperAdmin, login, getMe, linkedinAuth, acceptInvitation } from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/setup-status", getSetupStatus);
router.post("/setup-superadmin", setupSuperAdmin);
router.post("/login", login);
router.get("/me", requireAuth, getMe);
router.post("/linkedin", linkedinAuth);
router.post("/join", acceptInvitation);

export default router;
