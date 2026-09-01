import { Router } from "express";
import {
  inviteMember,
  getTeamMembers,
  removeMember,
  cancelInvitation,
  getInvitationInfo,
} from "../controllers/team.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/members", requireAuth, getTeamMembers);
router.post("/invite", requireAuth, inviteMember);
router.delete("/members/:userId", requireAuth, removeMember);
router.delete("/invitations/:invitationId", requireAuth, cancelInvitation);
router.get("/invitation-info/:token", getInvitationInfo); // public (pas de requireAuth)

export default router;
