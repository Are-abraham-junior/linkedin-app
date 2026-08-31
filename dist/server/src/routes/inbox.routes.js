import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { getConversations, getMessages, sendMessage, } from "../controllers/inbox.controller.js";
const router = Router();
router.use(requireAuth);
router.get("/conversations", getConversations);
router.get("/conversations/:id/messages", getMessages);
router.post("/messages/send", sendMessage);
export default router;
