import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireAiAccess } from "../middlewares/aiAccess.middleware.js";
import {
  getAiStatus,
  listConversations,
  createConversation,
  getConversation,
  renameConversation,
  deleteConversation,
  postMessage,
  updateDraft,
} from "../controllers/ai.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/status", getAiStatus);

router.use(requireAiAccess);

router.get("/conversations", listConversations);
router.post("/conversations", createConversation);
router.get("/conversations/:id", getConversation);
router.patch("/conversations/:id", renameConversation);
router.delete("/conversations/:id", deleteConversation);
router.post("/conversations/:id/messages", postMessage);
router.post("/conversations/:id/update-draft", updateDraft);

export default router;
