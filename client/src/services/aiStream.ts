const API_BASE = import.meta.env.VITE_API_URL || "/api";

export type AiCard =
  | { type: "profiles"; query: string; totalCount: number; excludedCount: number; profiles: AiProfile[] }
  | { type: "list"; list: { id: string; name: string; prospectsCount: number }; imported?: number; duplicates?: number }
  | { type: "campaign_proposal"; campaign: { id: string; name: string; steps: AiDraftStep[]; listId: string | null; listName: string | null; prospectsCount: number } }
  | { type: "confirm_launch"; token: string; campaignId: string; summary: { name: string; listName: string | null; prospectsCount: number; steps: AiDraftStep[] } }
  | { type: "launch_result"; campaignId: string; name: string; prospectsEnrolled: number }
  | { type: "confirm_delete_list"; token: string; list: { id: string; name: string; prospectsCount: number } }
  | { type: "action_result"; ok: boolean; title: string; detail?: string }
  | { type: "campaign_steps"; campaign: AiCampaignSummary; changed?: number[] }
  | {
      type: "account_status";
      connected: boolean;
      accountName: string | null;
      accountType: string | null;
      plan: string;
      quotas: Array<{ kind: string; label: string; usedToday: number; target: number; usedWeek: number; limitWeek: number; usedMonth: number; limitMonth: number }>;
      warmup: { active: boolean; dayIndex: number; totalDays: number } | null;
    };

export interface AiProfile {
  providerProfileId: string;
  firstName: string;
  lastName: string;
  headline: string;
  company?: string;
  location?: string;
  linkedinUrl: string;
  avatarUrl?: string;
  connectionStatus?: string;
}

export type AiCampaignStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";

export interface AiCampaignSummary {
  id: string;
  name: string;
  status: AiCampaignStatus;
  steps: AiDraftStep[];
  prospectsCount: number;
}

export interface AiDraftStep {
  stepOrder: number;
  actionType: "INVITATION" | "MESSAGE" | "VISIT_PROFILE" | "FOLLOW" | "DELAY";
  delayDays: number;
  messageText: string | null;
}

export type AiStreamEvent =
  | { type: "delta"; text: string }
  | { type: "replace"; text: string }
  | { type: "tool_start"; name: string; label: string }
  | { type: "tool_end"; name: string; ok: boolean }
  | { type: "card"; card: AiCard; messageId: string }
  | { type: "message_saved"; messageId: string; role: string }
  | { type: "error"; message: string }
  | { type: "done"; conversationId: string; title: string };

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "text/event-stream" };
  const token = localStorage.getItem("bleadin_token") || localStorage.getItem("bime_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  const savedOrg = localStorage.getItem("bleadin_impersonated_org") || localStorage.getItem("bime_impersonated_org");
  if (savedOrg) {
    try {
      const org = JSON.parse(savedOrg);
      if (org?.id) headers["x-impersonate-org"] = org.id;
    } catch {
      // ignore
    }
  }
  return headers;
}

/**
 * Envoie un message à Bleadin IA et consomme la réponse SSE (fetch + ReadableStream :
 * EventSource ne permet ni POST ni en-tête Authorization).
 */
export async function streamAiMessage(
  conversationId: string,
  body: { content?: string; confirmToken?: string },
  onEvent: (event: AiStreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/ai/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
      signal,
    });
  } catch (err: any) {
    if (err?.name === "AbortError") return;
    onEvent({ type: "error", message: "Connexion au serveur impossible." });
    return;
  }

  if (!res.ok || !res.body) {
    let message = `Erreur (${res.status})`;
    try {
      const data = await res.json();
      message = data.error || message;
      if (data.code === "PLAN_UPGRADE_REQUIRED") message = "PLAN_UPGRADE_REQUIRED";
    } catch {
      // ignore
    }
    onEvent({ type: "error", message });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handleBlock = (block: string) => {
    const dataLines = block
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim());
    if (!dataLines.length) return;
    try {
      onEvent(JSON.parse(dataLines.join("\n")));
    } catch {
      // bloc non JSON (heartbeat)
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        handleBlock(block);
      }
    }
    if (buffer.trim()) handleBlock(buffer);
  } catch (err: any) {
    if (err?.name !== "AbortError") onEvent({ type: "error", message: "La connexion a été interrompue." });
  }
}
