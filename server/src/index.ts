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
import teamRoutes from "./routes/team.routes.js";
import queueRoutes from "./routes/queue.routes.js";
import { handleUnipileWebhook } from "./controllers/webhook.controller.js";
import { startCampaignScheduler } from "./workers/campaign.worker.js";

import path from "path";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || "https://bimlink.croixance.net";

app.use(
  cors({
    origin: [FRONTEND_URL, "http://localhost:3000", "http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

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
app.use("/api/team", teamRoutes);
app.use("/api/queue", queueRoutes);
app.post("/api/webhooks/unipile", handleUnipileWebhook);

// Serve static client assets and SPA fallback (Production / Render)
const clientDistPath = path.resolve(process.cwd(), "client/dist");
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      return res.sendFile(path.join(clientDistPath, "index.html"));
    }
    next();
  });
}

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

  // Self-ping pour garder le processus actif (Passenger met en veille après inactivité)
  if (process.env.NODE_ENV === "production" && process.env.SELF_PING_URL) {
    setInterval(async () => {
      try {
        await fetch(process.env.SELF_PING_URL!);
      } catch {
        // Ignorer les erreurs de ping
      }
    }, 4 * 60 * 1000); // Ping toutes les 4 minutes
    console.log(`🏓 Self-ping activé vers ${process.env.SELF_PING_URL}`);
  }
});

export default app;
