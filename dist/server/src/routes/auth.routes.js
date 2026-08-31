import { Router } from "express";
import { getSetupStatus, setupSuperAdmin, login, getMe } from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
const router = Router();
router.get("/setup-status", getSetupStatus);
router.post("/setup-superadmin", setupSuperAdmin);
router.post("/login", login);
router.get("/me", requireAuth, getMe);
export default router;
