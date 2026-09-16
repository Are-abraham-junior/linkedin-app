import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { enrich, getEnrichmentBalance, getEnrichmentHistory } from "../controllers/enrichment.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/balance", getEnrichmentBalance);
router.post("/enrich", enrich);
router.get("/history", getEnrichmentHistory);

export default router;
