import { prisma } from "../../../../lib/prisma.js";
import type { AuthenticatedUser } from "../../middlewares/auth.middleware.js";
import { chat, AiProviderError, DEFAULT_NUM_CTX, type ChatMessage, type ChatToolCall } from "./ollama.client.js";
import { requireActiveProvider, recordProviderFailure } from "./provider.service.js";
import { getCoreKnowledge, searchKnowledge } from "./knowledge.service.js";
import { buildSystemPrompt, titleFromMessage } from "./prompts.js";
import { hasTechnicalJargon, sanitizeAssistantText, REWRITE_INSTRUCTION } from "./sanitize.js";
import {
  AGENT_TOOLS,
  TOOL_DEFINITIONS,
  findTool,
  executeConfirmedAction,
  type AgentCard,
  type AgentWorkspace,
  type ToolOutcome,
} from "./tools.js";

export type AgentEvent =
  | { type: "delta"; text: string }
  /** Remplace intégralement le texte de la bulle en cours ("" = effacer un texte streamé qui n'aurait pas dû l'être). */
  | { type: "replace"; text: string }
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
/** Estimation prudente pour le français : ~3 caractères par token. */
const CHARS_PER_TOKEN = 3;
/** Tokens réservés à la réponse du modèle (et aux appels d'outils). */
const RESPONSE_RESERVE_TOKENS = 1500;

/**
 * Tronque l'historique (du plus ancien au plus récent) pour que prompt système + historique tiennent dans la
 * fenêtre de contexte du provider. Un contexte saturé se manifeste par une réponse vide (le modèle est coupé
 * avant d'émettre son appel d'outil), ce qui donnait l'impression que l'agent « oubliait » la demande.
 */
function fitHistoryToContext(system: string, history: ChatMessage[], numCtx: number): ChatMessage[] {
  const budgetChars = (numCtx - RESPONSE_RESERVE_TOKENS) * CHARS_PER_TOKEN - system.length;
  const size = (m: ChatMessage) => (m.content || "").length + JSON.stringify(m.tool_calls || "").length + 20;
  let total = history.reduce((s, m) => s + size(m), 0);
  let start = 0;
  while (total > budgetChars && start < history.length - 2) {
    total -= size(history[start]);
    start++;
  }
  if (start === 0) return history;
  // Repartir d'un message utilisateur pour ne pas laisser un résultat d'outil orphelin en tête
  while (start < history.length - 1 && history[start].role !== "user") start++;
  console.warn(`[Bleadin IA] historique tronqué de ${start} message(s) pour tenir dans ${numCtx} tokens`);
  return history.slice(start);
}

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
  for (const obj of extractJsonObjects(content)) {
    const name = obj.name ?? obj.function ?? obj.tool;
    if (typeof name !== "string" || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) continue;
    const rawArgs = obj.parameters ?? obj.arguments ?? obj.args ?? {};
    const args = rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs) ? (rawArgs as Record<string, unknown>) : {};
    // Les noms inconnus sont conservés : la boucle renverra « outil inconnu » au modèle au lieu d'afficher le JSON brut.
    calls.push({ id: `call_text_${calls.length + 1}_${Date.now()}`, name, arguments: args });
  }
  return calls;
}

/** Extrait les objets JSON de premier niveau d'un texte (accolades équilibrées, chaînes respectées, arguments imbriqués acceptés). */
function extractJsonObjects(text: string): Array<Record<string, any>> {
  const objects: Array<Record<string, any>> = [];
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf("{", i);
    if (start < 0) break;
    let depth = 0;
    let inString = false;
    let end = -1;
    for (let j = start; j < text.length; j++) {
      const ch = text[j];
      if (inString) {
        if (ch === "\\") j++;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }
    if (end < 0) break;
    try {
      const parsed = JSON.parse(text.slice(start, end + 1));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) objects.push(parsed);
    } catch {
      // fragment non JSON : on continue après l'accolade ouvrante
    }
    i = end + 1;
  }
  return objects;
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
    /** Vrai si du texte a déjà été affiché à l'utilisateur pendant cette réponse. */
    streamed() {
      return decided === "stream";
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
    const pendingKind = workspace.pendingConfirmation?.kind || "launch";
    const action = await executeConfirmedAction(user, workspace, params.confirmToken);
    const userRow = await prisma.aiMessage.create({ data: { conversationId, role: "user", content: action.userText } });
    emit({ type: "message_saved", messageId: userRow.id, role: "user" });

    emit({ type: "tool_start", name: action.name, label: action.label });
    workspace = applyPatch(workspace, action.outcome.workspacePatch);
    await saveWorkspace(conversationId, workspace);
    emit({ type: "tool_end", name: action.name, ok: action.outcome.ok });

    const callId = `call_${action.name}_${Date.now()}`;
    await prisma.aiMessage.create({
      data: { conversationId, role: "assistant", content: "", toolCalls: [{ id: callId, name: action.name, arguments: {} }] as any },
    });
    await persistToolResult(conversationId, callId, action.name, action.outcome, emit);
    retrievalQuery = pendingKind === "delete_list" ? "supprimer liste prospects" : "lancement campagne quotas heures de travail";
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
  /** Texte effectivement affiché en streaming pour la réponse finale (pour savoir s'il faut le remplacer). */
  let streamedFinal = "";
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
      const numCtx = provider.numCtx ?? DEFAULT_NUM_CTX;
      const history = fitHistoryToContext(system, await loadHistory(conversationId), numCtx);
      const allowTools = iteration < MAX_TOOL_ITERATIONS;

      const gate = createDeltaGate(emit);
      const result = await chatWithRetry({
        provider,
        messages: [{ role: "system", content: system }, ...history],
        tools: allowTools ? TOOL_DEFINITIONS : undefined,
        signal,
        onDelta: (text) => gate.push(text),
      });

      if (result.promptTokens && result.promptTokens > numCtx * 0.92) {
        console.warn(`[Bleadin IA] contexte presque saturé : ${result.promptTokens}/${numCtx} tokens (augmentez la fenêtre de contexte du provider)`);
      }
      if (!result.content.trim() && result.toolCalls.length === 0) {
        console.warn(`[Bleadin IA] réponse vide du modèle (prompt ${result.promptTokens ?? "?"} tokens, ${result.completionTokens ?? "?"} générés) — contexte saturé ou réflexion coupée ?`);
      }
      let toolCalls = result.toolCalls.filter((tc) => tc.name);
      let assistantContent = result.content;
      if (toolCalls.length === 0 && allowTools && /\{\s*"(?:name|function|tool)"\s*:/.test(result.content)) {
        // Appel d'outil émis en texte (JSON seul, ou noyé dans une explication / un bloc de code)
        const recovered = extractTextualToolCalls(result.content);
        if (recovered.length > 0 && (looksLikeToolJson(result.content) || recovered.some((c) => findTool(c.name)))) {
          toolCalls = recovered;
          console.warn(`[Bleadin IA] appel d'outil textuel récupéré : ${result.content.slice(0, 300)}`);
          assistantContent = "";
          // Le texte d'accompagnement (« voici le code… ») a pu être streamé : on l'efface, l'action parle d'elle-même.
          if (gate.streamed()) emit({ type: "replace", text: "" });
        }
      }
      gate.flush(toolCalls.length > 0);

      if (toolCalls.length === 0) {
        // Jamais de JSON d'outil brut dans le chat : on laisse la relance finale reformuler.
        if (looksLikeToolJson(result.content)) console.warn(`[Bleadin IA] réponse JSON non reconnue comme appel d'outil, ignorée : ${result.content.slice(0, 500)}`);
        finalContent = looksLikeToolJson(result.content) ? "" : result.content;
        streamedFinal = gate.streamed() ? finalContent : "";
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
            {
              ok: false,
              result: {
                error: `Arguments invalides (${issue?.path?.join(".") || "paramètres"} : ${issue?.message || "format incorrect"}). Rappelle la même action avec des arguments conformes à sa description (les tableaux sont de vrais tableaux JSON, pas des chaînes).`,
                actionDone: false,
              },
            },
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
      streamedFinal = finalContent;
    }

    // Garde-fou : jamais de jargon technique (outils, paramètres, JSON) dans le texte final.
    if (finalContent.trim() && !signal?.aborted) {
      let clean = sanitizeAssistantText(finalContent);
      // Le nettoyage regex est lossy : dès que l'original contenait du jargon, on demande une vraie reformulation.
      if (hasTechnicalJargon(finalContent) || !clean.trim()) {
        console.warn(`[Bleadin IA] jargon détecté, reformulation demandée : ${clean.slice(0, 200)}`);
        const history = await loadHistory(conversationId);
        const rewrite = await chatWithRetry({
          provider,
          messages: [
            { role: "system", content: buildSystemPrompt({ userName: user.name || null, coreKnowledge, hits, workspace, today: new Date().toLocaleDateString("fr-FR") }) },
            ...history,
            { role: "assistant", content: clean },
            { role: "user", content: REWRITE_INSTRUCTION },
          ],
          signal,
        });
        const rewritten = sanitizeAssistantText(rewrite.content);
        if (rewritten.trim()) clean = rewritten;
      }
      if (clean !== finalContent) {
        finalContent = clean;
        if (streamedFinal !== clean) emit({ type: "replace", text: clean });
      }
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
