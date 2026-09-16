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
import { CAMPAIGN_TEMPLATES } from "../config/campaignTemplates.js";

const router = Router();

router.use(requireAuth);

router.get("/", getCampaigns);
router.get("/templates", (_req, res) => {
  res.json({ success: true, templates: CAMPAIGN_TEMPLATES });
});
router.get("/:id", getCampaignDetails);
router.post("/", createCampaign);
router.put("/:id", updateCampaign);
router.patch("/:id", updateCampaign);
router.patch("/:id/toggle-status", toggleCampaignStatus);
router.delete("/:id", deleteCampaign);

export default router;
