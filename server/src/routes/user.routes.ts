import { Router } from "express";
import { getProfile, updateProfile, getUserDashboardStats } from "../controllers/user.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/profile", getProfile);
router.put("/profile", updateProfile);
router.get("/dashboard-stats", getUserDashboardStats);

export default router;
