import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { searchProfiles, getAccountHealth } from "../controllers/linkedin.controller.js";
const router = Router();
router.use(requireAuth);
router.post("/search", searchProfiles);
router.get("/account-health", getAccountHealth);
export default router;
