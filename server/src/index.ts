import express from "express";
import cors from "cors";
import morgan from "morgan";
import "dotenv/config";
import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import userRoutes from "./routes/user.routes.js";
import listRoutes from "./routes/list.routes.js";
import prospectRoutes from "./routes/prospect.routes.js";
import linkedinRoutes from "./routes/linkedin.routes.js";
import campaignRoutes from "./routes/campaign.routes.js";
import inboxRoutes from "./routes/inbox.routes.js";
import { handleUnipileWebhook } from "./controllers/webhook.controller.js";
import { startCampaignScheduler } from "./workers/campaign.worker.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan("dev"));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), service: "Bime Link API" });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/user", userRoutes);
app.use("/api/lists", listRoutes);
app.use("/api/prospects", prospectRoutes);
app.use("/api/linkedin", linkedinRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/inbox", inboxRoutes);
app.post("/api/webhooks/unipile", handleUnipileWebhook);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("🔥 Global Error Handler:", err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Erreur interne du serveur",
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Bime Link API Server running on port ${PORT}`);
  // Initialiser le planificateur de tâches de campagne
  startCampaignScheduler();
});

export default app;
