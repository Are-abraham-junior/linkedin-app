import { Response } from "express";
import { prisma } from "../../../lib/prisma.js";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { hasAiAccess } from "../middlewares/aiAccess.middleware.js";
import { getActiveProvider } from "../services/ai/provider.service.js";
import { runTurn, type AgentEvent } from "../services/ai/agent.service.js";
import { updateDraftSteps, type AgentWorkspace } from "../services/ai/tools.js";

const HEARTBEAT_MS = 15_000;

function ownedConversationWhere(req: AuthenticatedRequest, id: string) {
  return { id, userId: req.user!.id };
}

function serializeMessage(m: any) {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    toolName: m.toolName,
    toolCalls: m.toolCalls,
    cards: m.cards,
    createdAt: m.createdAt,
  };
}

export async function getAiStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const [allowed, provider] = await Promise.all([hasAiAccess(req.user!), getActiveProvider()]);
    res.json({
      success: true,
      planAllowed: allowed,
      providerConfigured: Boolean(provider),
      providerStatus: provider?.status || null,
      model: provider?.model || null,
      enabled: allowed && Boolean(provider),
    });
  } catch (err) {
    console.error("[ai.controller:getAiStatus]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue." });
  }
}

export async function listConversations(req: AuthenticatedRequest, res: Response) {
  try {
    const conversations = await prisma.aiConversation.findMany({
      where: { userId: req.user!.id },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
    res.json({ success: true, conversations });
  } catch (err) {
    console.error("[ai.controller:listConversations]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue." });
  }
}

export async function createConversation(req: AuthenticatedRequest, res: Response) {
  try {
    const title = typeof req.body?.title === "string" && req.body.title.trim() ? req.body.title.trim().slice(0, 80) : undefined;
    const conversation = await prisma.aiConversation.create({
      data: { userId: req.user!.id, ...(title ? { title } : {}) },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
    res.status(201).json({ success: true, conversation });
  } catch (err) {
    console.error("[ai.controller:createConversation]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue." });
  }
}

export async function getConversation(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const conversation = await prisma.aiConversation.findFirst({
      where: ownedConversationWhere(req, id),
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!conversation) {
      res.status(404).json({ success: false, error: "Conversation introuvable." });
      return;
    }
    const ws = (conversation.workspace || {}) as AgentWorkspace;
    res.json({
      success: true,
      conversation: {
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        workspace: {
          currentList: ws.currentList || null,
          draft: ws.draft ? { campaignId: ws.draft.campaignId, name: ws.draft.name, steps: ws.draft.steps } : null,
          pendingConfirmation: ws.pendingConfirmation ? { campaignId: ws.pendingConfirmation.campaignId, expiresAt: ws.pendingConfirmation.expiresAt } : null,
          lastSearchCount: ws.lastSearch?.profiles.length || 0,
        },
      },
      messages: conversation.messages.map(serializeMessage),
    });
  } catch (err) {
    console.error("[ai.controller:getConversation]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue." });
  }
}

export async function renameConversation(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 80) : "";
    if (!title) {
      res.status(400).json({ success: false, error: "Titre requis." });
      return;
    }
    const result = await prisma.aiConversation.updateMany({ where: ownedConversationWhere(req, id), data: { title } });
    if (result.count === 0) {
      res.status(404).json({ success: false, error: "Conversation introuvable." });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error("[ai.controller:renameConversation]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue." });
  }
}

export async function deleteConversation(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const result = await prisma.aiConversation.deleteMany({ where: ownedConversationWhere(req, id) });
    if (result.count === 0) {
      res.status(404).json({ success: false, error: "Conversation introuvable." });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error("[ai.controller:deleteConversation]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue." });
  }
}

/**
 * Envoi d'un message (ou d'une confirmation de lancement). Réponse en SSE par défaut,
 * ou JSON complet avec `stream: false` (repli si un proxy bufferise).
 */
export async function postMessage(req: AuthenticatedRequest, res: Response) {
  const id = req.params.id as string;
  const conversation = await prisma.aiConversation.findFirst({ where: ownedConversationWhere(req, id), select: { id: true } });
  if (!conversation) {
    res.status(404).json({ success: false, error: "Conversation introuvable." });
    return;
  }

  const content = typeof req.body?.content === "string" ? req.body.content.trim().slice(0, 4000) : "";
  const confirmToken = typeof req.body?.confirmToken === "string" ? req.body.confirmToken : undefined;
  const stream = req.body?.stream !== false;

  if (!content && !confirmToken) {
    res.status(400).json({ success: false, error: "Message vide." });
    return;
  }

  const abort = new AbortController();
  req.on("close", () => abort.abort());

  if (!stream) {
    const events: AgentEvent[] = [];
    let text = "";
    await runTurn({
      conversationId: id,
      user: req.user!,
      content,
      confirmToken,
      signal: abort.signal,
      emit: (e) => {
        if (e.type === "delta") text += e.text;
        else events.push(e);
      },
    });
    const error = events.find((e) => e.type === "error") as Extract<AgentEvent, { type: "error" }> | undefined;
    res.json({ success: !error, text, events, error: error?.message });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  const send = (event: AgentEvent) => {
    if (res.writableEnded) return;
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  };
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(": ping\n\n");
  }, HEARTBEAT_MS);

  try {
    await runTurn({ conversationId: id, user: req.user!, content, confirmToken, signal: abort.signal, emit: send });
  } catch (err: any) {
    console.error("[ai.controller:postMessage]", err);
    send({ type: "error", message: "Une erreur inattendue est survenue." });
  } finally {
    clearInterval(heartbeat);
    if (!res.writableEnded) res.end();
  }
}

export async function updateDraft(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const conversation = await prisma.aiConversation.findFirst({ where: ownedConversationWhere(req, id) });
    if (!conversation) {
      res.status(404).json({ success: false, error: "Conversation introuvable." });
      return;
    }
    const workspace = (conversation.workspace || {}) as AgentWorkspace;
    const outcome = await updateDraftSteps(req.user!, workspace, req.body?.steps);
    if (!outcome.ok) {
      res.status(400).json({ success: false, error: (outcome.result as any)?.error || "Mise à jour impossible." });
      return;
    }
    const next = { ...workspace, ...outcome.workspacePatch };
    if (outcome.workspacePatch && "pendingConfirmation" in outcome.workspacePatch && !outcome.workspacePatch.pendingConfirmation) {
      delete (next as any).pendingConfirmation;
    }
    await prisma.aiConversation.update({ where: { id }, data: { workspace: next as any } });

    const row = await prisma.aiMessage.create({
      data: {
        conversationId: id,
        role: "user",
        content: "J'ai modifié les messages du brouillon de campagne depuis l'interface.",
        cards: outcome.card ? ([outcome.card] as any) : undefined,
      },
    });
    res.json({ success: true, card: outcome.card, messageId: row.id });
  } catch (err) {
    console.error("[ai.controller:updateDraft]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue." });
  }
}
