import { prisma } from "../../../../lib/prisma.js";
import type { AuthenticatedUser } from "../../middlewares/auth.middleware.js";
import { chat, AiProviderError, type ChatMessage, type ChatToolCall } from "./ollama.client.js";
import { requireActiveProvider, recordProviderFailure } from "./provider.service.js";
import { getCoreKnowledge, searchKnowledge } from "./knowledge.service.js";
import { buildSystemPrompt, titleFromMessage } from "./prompts.js";
import {
  AGENT_TOOLS,
  TOOL_DEFINITIONS,
  findTool,
  launchDraftCampaign,
  type AgentCard,
  type AgentWorkspace,
  type ToolOutcome,
} from "./tools.js";

export type AgentEvent =
  | { type: "delta"; text: string }
  | { type: "tool_start"; name: string; label: string }
  | { type: "tool_end"; name: string; ok: boolean }
  | { type: "card"; card: AgentCard; messageId: string }
  | { type: "message_saved"; messageId: string; role: string }
  | { type: "error"; message: string }
  | { type: "done"; conversationId: string; title: string };

export type Emit = (event: AgentEvent) => void;

const MAX_TOOL_ITERATIONS = 6;
const HISTORY_LIMIT = 24;
const TOOL_CONTENT_LIMIT = 1500;

interface RunTurnParams {
  conversationId: string;
  user: AuthenticatedUser;
  content?: string;
  confirmToken?: string;
  emit: Emit;
  signal?: AbortSignal;
}

/**
 * Les petits modèles émettent parfois l'appel d'outil en texte (`{"name": "...", "parameters": {...}}`)
 * au lieu d'un tool_call structuré. On le récupère ici, en tolérant des arguments mal formés.
 */
export function extractTextualToolCalls(content: string): ChatToolCall[] {
  const calls: ChatToolCall[] = [];
  const regex = /\{\s*"(?:name|function|tool)"\s*:\s*"([a-zA-Z_]+)"\s*(?:,\s*"(?:parameters|arguments|args)"\s*:\s*(\{[\s\S]*?\})\s*)?\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const name = match[1];
    if (!findTool(name)) continue;
    let args: Record<string, unknown> = {};
    if (match[2]) {
      try {
        args = JSON.parse(match[2]);
      } catch {
        args = {};
      }
    }
    calls.push({ id: `call_text_${calls.length + 1}_${Date.now()}`, name, arguments: args });
  }
  return calls;
}

function looksLikeToolJson(text: string): boolean {
  const t = text.trimStart();
  return t.startsWith("{") || t.startsWith("```") || t.startsWith("[");
}

/** Retient les deltas tant que le début ressemble à du JSON d'appel d'outil (rien n'est affiché si c'en est un). */
function createDeltaGate(emit: Emit) {
  let buffer = "";
  let decided: "stream" | "hold" | null = null;
  return {
    push(text: string) {
      if (decided === "stream") {
        emit({ type: "delta", text });
        return;
      }
      buffer += text;
      if (decided === null) {
        const trimmed = buffer.trimStart();
        if (!trimmed) return;
        decided = looksLikeToolJson(trimmed) ? "hold" : "stream";
        if (decided === "stream") {
          emit({ type: "delta", text: buffer });
          buffer = "";
        }
      }
    },
    /** À appeler en fin de réponse : renvoie le texte retenu si ce n'était finalement pas un appel d'outil. */
    flush(wasToolCall: boolean) {
      if (decided === "hold" && !wasToolCall && buffer.trim()) emit({ type: "delta", text: buffer });
      buffer = "";
    },
  };
}

/** Un seul nouvel essai sur erreur réseau/5xx (tunnel instable), jamais sur annulation ni 4xx. */
async function chatWithRetry(opts: Parameters<typeof chat>[0]): ReturnType<typeof chat> {
  try {
    return await chat(opts);
  } catch (err: any) {
    const retriable = err instanceof AiProviderError && !opts.signal?.aborted && (err.status === undefined || err.status >= 500) && !/annulée/i.test(err.message);
    if (!retriable) throw err;
    console.warn(`[Bleadin IA] provider en erreur, nouvel essai : ${err.message}`);
    await new Promise((r) => setTimeout(r, 1500));
    return chat(opts);
  }
}

function applyPatch(ws: AgentWorkspace, patch?: Partial<AgentWorkspace>): AgentWorkspace {
  if (!patch) return ws;
  const next: AgentWorkspace = { ...ws };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete (next as any)[key];
    else (next as any)[key] = value;
  }
  return next;
}

async function saveWorkspace(conversationId: string, ws: AgentWorkspace): Promise<void> {
  await prisma.aiConversation.update({ where: { id: conversationId }, data: { workspace: ws as any } });
}

async function loadHistory(conversationId: string): Promise<ChatMessage[]> {
  const rows = await prisma.aiMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
  });
  rows.reverse();
  const firstUser = rows.findIndex((r) => r.role === "user");
  const usable = firstUser >= 0 ? rows.slice(firstUser) : [];

  return usable.map((r) => {
    if (r.role === "assistant") {
      const toolCalls = Array.isArray(r.toolCalls) ? (r.toolCalls as unknown as ChatToolCall[]) : undefined;
      return { role: "assistant", content: r.content, ...(toolCalls?.length ? { tool_calls: toolCalls } : {}) };
    }
    if (r.role === "tool") {
      return {
        role: "tool",
        content: r.content.length > TOOL_CONTENT_LIMIT ? r.content.slice(0, TOOL_CONTENT_LIMIT) + "…" : r.content,
        tool_name: r.toolName || undefined,
        tool_call_id: (r.toolCalls as any)?.id,
      };
    }
    return { role: "user", content: r.content };
  });
}

async function persistToolResult(conversationId: string, callId: string, toolName: string, outcome: ToolOutcome, emit: Emit) {
  const row = await prisma.aiMessage.create({
    data: {
      conversationId,
      role: "tool",
      toolName,
      toolCalls: { id: callId } as any,
      content: JSON.stringify(outcome.result),
      cards: outcome.card ? ([outcome.card] as any) : undefined,
    },
  });
  if (outcome.card) emit({ type: "card", card: outcome.card, messageId: row.id });
  return row;
}

export async function runTurn(params: RunTurnParams): Promise<void> {
  const { conversationId, user, emit, signal } = params;

  const conversation = await prisma.aiConversation.findUnique({ where: { id: conversationId } });
  if (!conversation) {
    emit({ type: "error", message: "Conversation introuvable." });
    return;
  }
  let workspace = (conversation.workspace || {}) as AgentWorkspace;

  let provider;
  try {
    provider = await requireActiveProvider();
  } catch (err: any) {
    emit({ type: "error", message: err.message });
    return;
  }

  const userText = (params.content || "").trim();
  let retrievalQuery = userText;

  if (params.confirmToken) {
    const userRow = await prisma.aiMessage.create({
      data: { conversationId, role: "user", content: "J'ai cliqué sur « Confirmer le lancement »." },
    });
    emit({ type: "message_saved", messageId: userRow.id, role: "user" });

    emit({ type: "tool_start", name: "launch_campaign", label: "Lancement de la campagne" });
    const outcome = await launchDraftCampaign(user, workspace, params.confirmToken);
    workspace = applyPatch(workspace, outcome.workspacePatch);
    await saveWorkspace(conversationId, workspace);
    emit({ type: "tool_end", name: "launch_campaign", ok: outcome.ok });

    const callId = `call_launch_${Date.now()}`;
    await prisma.aiMessage.create({
      data: {
        conversationId,
        role: "assistant",
        content: "",
        toolCalls: [{ id: callId, name: "launch_campaign", arguments: {} }] as any,
      },
    });
    await persistToolResult(conversationId, callId, "launch_campaign", outcome, emit);
    retrievalQuery = "lancement campagne quotas heures de travail";
  } else {
    if (!userText) {
      emit({ type: "error", message: "Message vide." });
      return;
    }
    const userRow = await prisma.aiMessage.create({ data: { conversationId, role: "user", content: userText } });
    emit({ type: "message_saved", messageId: userRow.id, role: "user" });
  }

  const isFirstMessage = (await prisma.aiMessage.count({ where: { conversationId, role: "user" } })) === 1;
  let title = conversation.title;
  if (isFirstMessage && userText) {
    title = titleFromMessage(userText);
    await prisma.aiConversation.update({ where: { id: conversationId }, data: { title } });
  }

  const [coreKnowledge, hits] = await Promise.all([getCoreKnowledge(), searchKnowledge(retrievalQuery, 3)]);

  let finalContent = "";
  try {
    for (let iteration = 0; iteration <= MAX_TOOL_ITERATIONS; iteration++) {
      if (signal?.aborted) break;

      const system = buildSystemPrompt({
        userName: user.name || null,
        coreKnowledge,
        hits,
        workspace,
        today: new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
      });
      const history = await loadHistory(conversationId);
      const allowTools = iteration < MAX_TOOL_ITERATIONS;

      const gate = createDeltaGate(emit);
      const result = await chatWithRetry({
        provider,
        messages: [{ role: "system", content: system }, ...history],
        tools: allowTools ? TOOL_DEFINITIONS : undefined,
        signal,
        onDelta: (text) => gate.push(text),
      });

      let toolCalls = result.toolCalls.filter((tc) => tc.name);
      let assistantContent = result.content;
      if (toolCalls.length === 0 && allowTools && looksLikeToolJson(result.content)) {
        toolCalls = extractTextualToolCalls(result.content);
        if (toolCalls.length > 0) {
          console.warn(`[Bleadin IA] appel d'outil textuel récupéré : ${result.content.slice(0, 300)}`);
          assistantContent = "";
        }
      }
      gate.flush(toolCalls.length > 0);

      if (toolCalls.length === 0) {
        finalContent = result.content;
        break;
      }

      const assistantRow = await prisma.aiMessage.create({
        data: { conversationId, role: "assistant", content: assistantContent, toolCalls: toolCalls as any },
      });
      emit({ type: "message_saved", messageId: assistantRow.id, role: "assistant" });

      for (const call of toolCalls) {
        if (signal?.aborted) break;
        const tool = findTool(call.name);
        if (!tool) {
          await persistToolResult(
            conversationId,
            call.id,
            call.name,
            { ok: false, result: { error: `Outil inconnu « ${call.name} ». Outils disponibles : ${AGENT_TOOLS.map((t) => t.name).join(", ")}.` } },
            emit
          );
          continue;
        }

        const parsed = tool.schema.safeParse(call.arguments || {});
        if (!parsed.success) {
          const issue = parsed.error.issues[0];
          await persistToolResult(
            conversationId,
            call.id,
            tool.name,
            { ok: false, result: { error: `Arguments invalides pour ${tool.name} : ${issue?.path?.join(".") || ""} ${issue?.message || ""}`.trim() } },
            emit
          );
          continue;
        }

        emit({ type: "tool_start", name: tool.name, label: tool.label });
        let outcome: ToolOutcome;
        try {
          outcome = await tool.execute({ user, workspace }, parsed.data);
        } catch (err: any) {
          console.error(`[Bleadin IA] outil ${tool.name}:`, err);
          outcome = { ok: false, result: { error: err?.message || "Erreur interne pendant l'exécution de l'action." } };
        }
        workspace = applyPatch(workspace, outcome.workspacePatch);
        await saveWorkspace(conversationId, workspace);
        emit({ type: "tool_end", name: tool.name, ok: outcome.ok });
        await persistToolResult(conversationId, call.id, tool.name, outcome, emit);
      }
    }

    if (!finalContent.trim() && !signal?.aborted) {
      const history = await loadHistory(conversationId);
      const nudge = await chatWithRetry({
        provider,
        messages: [
          { role: "system", content: buildSystemPrompt({ userName: user.name || null, coreKnowledge, hits, workspace, today: new Date().toLocaleDateString("fr-FR") }) },
          ...history,
          { role: "user", content: "Résume en 2-3 phrases ce qui vient d'être fait et propose la prochaine étape. Ne réutilise aucun outil." },
        ],
        signal,
        onDelta: (text) => emit({ type: "delta", text }),
      });
      finalContent = nudge.content;
    }

    if (finalContent.trim()) {
      const row = await prisma.aiMessage.create({ data: { conversationId, role: "assistant", content: finalContent } });
      emit({ type: "message_saved", messageId: row.id, role: "assistant" });
    }
    await prisma.aiConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    emit({ type: "done", conversationId, title });
  } catch (err: any) {
    if (err instanceof AiProviderError) {
      if (!signal?.aborted) await recordProviderFailure(provider.id, err.message);
      emit({ type: "error", message: signal?.aborted ? "Génération interrompue." : `Bleadin IA est indisponible : ${err.message}` });
      return;
    }
    console.error("[Bleadin IA] runTurn:", err);
    emit({ type: "error", message: "Une erreur inattendue est survenue. Réessayez dans un instant." });
  }
}
