/**
 * Client minimal pour Ollama (API native /api/chat) et les serveurs compatibles OpenAI
 * (/v1/chat/completions). Aucune dépendance : fetch natif de Node.
 */

export interface AiProviderConfig {
  kind: string; // OLLAMA | OPENAI_COMPATIBLE
  baseUrl: string;
  apiKey?: string | null;
  model: string;
  temperature?: number | null;
}

export interface ChatToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ChatToolCall[];
  tool_call_id?: string;
  tool_name?: string;
}

export interface ChatToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatResult {
  content: string;
  toolCalls: ChatToolCall[];
  promptTokens?: number;
  completionTokens?: number;
}

export interface ChatOptions {
  provider: AiProviderConfig;
  messages: ChatMessage[];
  tools?: ChatToolDefinition[];
  onDelta?: (text: string) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
  numCtx?: number;
}

export class AiProviderError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "AiProviderError";
  }
}

export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function authHeaders(provider: AiProviderConfig): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (provider.apiKey) headers.Authorization = `Bearer ${provider.apiKey}`;
  return headers;
}

function withTimeout(signal: AbortSignal | undefined, timeoutMs: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);
  const onAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", onAbort, { once: true });
  return {
    signal: controller.signal,
    clear: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}

async function readLines(body: ReadableStream<Uint8Array>, onLine: (line: string) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) onLine(line);
    }
  }
  const rest = buffer.trim();
  if (rest) onLine(rest);
}

function parseArguments(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function toOllamaMessages(messages: ChatMessage[]): unknown[] {
  return messages.map((m) => {
    if (m.role === "assistant" && m.tool_calls?.length) {
      return {
        role: "assistant",
        content: m.content,
        tool_calls: m.tool_calls.map((tc) => ({ function: { name: tc.name, arguments: tc.arguments } })),
      };
    }
    if (m.role === "tool") {
      return { role: "tool", content: m.content, tool_name: m.tool_name };
    }
    return { role: m.role, content: m.content };
  });
}

async function chatOllama(opts: ChatOptions): Promise<ChatResult> {
  const { provider } = opts;
  const url = `${normalizeBaseUrl(provider.baseUrl)}/api/chat`;
  const { signal, clear } = withTimeout(opts.signal, opts.timeoutMs ?? 120_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: authHeaders(provider),
      signal,
      body: JSON.stringify({
        model: provider.model,
        stream: true,
        keep_alive: "30m",
        messages: toOllamaMessages(opts.messages),
        ...(opts.tools?.length
          ? {
              tools: opts.tools.map((t) => ({
                type: "function",
                function: { name: t.name, description: t.description, parameters: t.parameters },
              })),
            }
          : {}),
        options: {
          temperature: provider.temperature ?? 0.2,
          num_ctx: opts.numCtx ?? 8192,
        },
      }),
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new AiProviderError(`Ollama ${res.status}: ${text.slice(0, 300) || res.statusText}`, res.status);
    }

    let content = "";
    const toolCalls: ChatToolCall[] = [];
    let promptTokens: number | undefined;
    let completionTokens: number | undefined;

    await readLines(res.body, (line) => {
      let json: any;
      try {
        json = JSON.parse(line);
      } catch {
        return;
      }
      if (json.error) throw new AiProviderError(String(json.error));
      const msg = json.message;
      if (msg?.content) {
        content += msg.content;
        opts.onDelta?.(msg.content);
      }
      if (Array.isArray(msg?.tool_calls)) {
        for (const tc of msg.tool_calls) {
          toolCalls.push({
            id: tc.id || `call_${toolCalls.length + 1}`,
            name: String(tc.function?.name || ""),
            arguments: parseArguments(tc.function?.arguments),
          });
        }
      }
      if (json.done) {
        promptTokens = json.prompt_eval_count;
        completionTokens = json.eval_count;
      }
    });

    return { content, toolCalls, promptTokens, completionTokens };
  } catch (err: any) {
    if (err instanceof AiProviderError) throw err;
    if (err?.name === "AbortError" || err?.message === "timeout" || signal.aborted) {
      throw new AiProviderError(opts.signal?.aborted ? "Requête annulée." : "Le modèle IA n'a pas répondu à temps.");
    }
    throw new AiProviderError(`Connexion au provider IA impossible : ${err?.message || err}`);
  } finally {
    clear();
  }
}

async function chatOpenAiCompatible(opts: ChatOptions): Promise<ChatResult> {
  const { provider } = opts;
  const url = `${normalizeBaseUrl(provider.baseUrl)}/v1/chat/completions`;
  const { signal, clear } = withTimeout(opts.signal, opts.timeoutMs ?? 120_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: authHeaders(provider),
      signal,
      body: JSON.stringify({
        model: provider.model,
        stream: true,
        temperature: provider.temperature ?? 0.2,
        messages: opts.messages.map((m) => {
          if (m.role === "assistant" && m.tool_calls?.length) {
            return {
              role: "assistant",
              content: m.content || null,
              tool_calls: m.tool_calls.map((tc) => ({
                id: tc.id,
                type: "function",
                function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
              })),
            };
          }
          if (m.role === "tool") return { role: "tool", content: m.content, tool_call_id: m.tool_call_id };
          return { role: m.role, content: m.content };
        }),
        ...(opts.tools?.length
          ? {
              tools: opts.tools.map((t) => ({
                type: "function",
                function: { name: t.name, description: t.description, parameters: t.parameters },
              })),
            }
          : {}),
      }),
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new AiProviderError(`Provider ${res.status}: ${text.slice(0, 300) || res.statusText}`, res.status);
    }

    let content = "";
    const partial = new Map<number, { id: string; name: string; args: string }>();

    await readLines(res.body, (line) => {
      if (!line.startsWith("data:")) return;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return;
      let json: any;
      try {
        json = JSON.parse(payload);
      } catch {
        return;
      }
      const delta = json.choices?.[0]?.delta;
      if (!delta) return;
      if (delta.content) {
        content += delta.content;
        opts.onDelta?.(delta.content);
      }
      if (Array.isArray(delta.tool_calls)) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          const cur = partial.get(idx) || { id: tc.id || `call_${idx + 1}`, name: "", args: "" };
          if (tc.id) cur.id = tc.id;
          if (tc.function?.name) cur.name += tc.function.name;
          if (tc.function?.arguments) cur.args += tc.function.arguments;
          partial.set(idx, cur);
        }
      }
    });

    const toolCalls = Array.from(partial.values()).map((p) => ({ id: p.id, name: p.name, arguments: parseArguments(p.args) }));
    return { content, toolCalls };
  } catch (err: any) {
    if (err instanceof AiProviderError) throw err;
    if (err?.name === "AbortError" || signal.aborted) {
      throw new AiProviderError(opts.signal?.aborted ? "Requête annulée." : "Le modèle IA n'a pas répondu à temps.");
    }
    throw new AiProviderError(`Connexion au provider IA impossible : ${err?.message || err}`);
  } finally {
    clear();
  }
}

export async function chat(opts: ChatOptions): Promise<ChatResult> {
  return opts.provider.kind === "OPENAI_COMPATIBLE" ? chatOpenAiCompatible(opts) : chatOllama(opts);
}

export interface ProviderTestResult {
  ok: boolean;
  latencyMs: number;
  models: string[];
  modelAvailable: boolean | null;
  error?: string;
}

export async function testProvider(provider: AiProviderConfig): Promise<ProviderTestResult> {
  const started = Date.now();
  const base = normalizeBaseUrl(provider.baseUrl);
  let models: string[] = [];
  let modelAvailable: boolean | null = null;

  try {
    const { signal, clear } = withTimeout(undefined, 20_000);
    try {
      const tagsUrl = provider.kind === "OPENAI_COMPATIBLE" ? `${base}/v1/models` : `${base}/api/tags`;
      const res = await fetch(tagsUrl, { headers: authHeaders(provider), signal });
      if (res.ok) {
        const data: any = await res.json();
        const list = Array.isArray(data?.models) ? data.models : Array.isArray(data?.data) ? data.data : [];
        models = list.map((m: any) => String(m.name || m.model || m.id || "")).filter(Boolean);
        modelAvailable = models.length ? models.includes(provider.model) : null;
      } else if (res.status === 401 || res.status === 403) {
        return { ok: false, latencyMs: Date.now() - started, models, modelAvailable, error: "Clé API refusée (401/403)." };
      }
    } finally {
      clear();
    }

    const result = await chat({
      provider,
      messages: [{ role: "user", content: "Réponds uniquement par le mot : OK" }],
      timeoutMs: 90_000,
    });
    const latencyMs = Date.now() - started;
    if (!result.content.trim()) {
      return { ok: false, latencyMs, models, modelAvailable, error: "Le modèle a répondu vide." };
    }
    return { ok: true, latencyMs, models, modelAvailable };
  } catch (err: any) {
    return { ok: false, latencyMs: Date.now() - started, models, modelAvailable, error: err?.message || String(err) };
  }
}
