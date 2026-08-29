import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
  getCampaigns,
  getCampaignDetails,
  createCampaign,
  updateCampaign,
  toggleCampaignStatus,
  deleteCampaign,
} from "../controllers/campaign.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", getCampaigns);
router.get("/:id", getCampaignDetails);
router.post("/", createCampaign);
router.put("/:id", updateCampaign);
router.patch("/:id/toggle-status", toggleCampaignStatus);
router.delete("/:id", deleteCampaign);

export default router;
