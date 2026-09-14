import { Router } from "express";
import {
  inviteMember,
  getTeamMembers,
  removeMember,
  cancelInvitation,
  getInvitationInfo,
  getTeamMetrics,
  updateMemberRole,
} from "../controllers/team.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/members", requireAuth, getTeamMembers);
router.get("/metrics", requireAuth, getTeamMetrics);
router.post("/invite", requireAuth, inviteMember);
router.put("/members/:userId/role", requireAuth, updateMemberRole);
router.delete("/members/:userId", requireAuth, removeMember);
router.delete("/invitations/:invitationId", requireAuth, cancelInvitation);
router.get("/invitation-info/:token", getInvitationInfo); // public (pas de requireAuth)

export default router;
