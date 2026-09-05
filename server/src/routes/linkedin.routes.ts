import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { searchProfiles, getAccountHealth, getSearchParameters, disconnectAccount } from "../controllers/linkedin.controller.js";

const router = Router();

router.use(requireAuth);

router.post("/search", searchProfiles);
router.get("/parameters", getSearchParameters);
router.get("/account-health", getAccountHealth);
router.post("/disconnect", disconnectAccount);

export default router;
