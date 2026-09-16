import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Plus, Trash2, Send, Square, Loader2, MessageSquare, Lock, Settings2, PanelLeftClose, PanelLeftOpen, AlertCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";
import { streamAiMessage, type AiCard, type AiDraftStep, type AiStreamEvent } from "../../services/aiStream";
import { renderMarkdown } from "./markdown";
import { AccountStatusCard, CampaignProposalCard, ConfirmLaunchCard, LaunchResultCard, ListCard, ProfilesCard } from "./AiCards";

interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

interface ChatItem {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  cards?: AiCard[];
  streaming?: boolean;
  error?: boolean;
}

interface AiStatus {
  planAllowed: boolean;
  providerConfigured: boolean;
  providerStatus: string | null;
}

const SUGGESTIONS = [
  "Je recherche 10 DG dans le secteur pétrolier en Côte d'Ivoire",
  "Propose-moi une séquence pour prendre des rendez-vous avec des DRH",
  "Quels sont mes quotas d'invitations cette semaine ?",
  "Aide-moi à rédiger une note d'invitation pour des directeurs financiers",
];

let idSeq = 0;
const localId = () => `local-${Date.now()}-${idSeq++}`;

export const BleadinIAView: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [status, setStatus] = useState<AiStatus | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [pendingCampaignId, setPendingCampaignId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const loadStatus = useCallback(async () => {
    const res = await apiRequest<AiStatus>("/ai/status");
    if (res.success) setStatus({ planAllowed: res.planAllowed, providerConfigured: res.providerConfigured, providerStatus: res.providerStatus });
    else setStatus({ planAllowed: false, providerConfigured: false, providerStatus: null });
  }, []);

  const loadConversations = useCallback(async () => {
    const res = await apiRequest<{ conversations: ConversationSummary[] }>("/ai/conversations");
    if (res.success) setConversations(res.conversations || []);
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (status?.planAllowed) loadConversations();
  }, [status?.planAllowed, loadConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items, activeTool]);

  const openConversation = async (id: string) => {
    if (sending) return;
    setActiveId(id);
    setLoadingConversation(true);
    setNotice(null);
    try {
      const res = await apiRequest<any>(`/ai/conversations/${id}`);
      if (res.success) {
        setItems(
          (res.messages || []).map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content || "",
            cards: Array.isArray(m.cards) ? m.cards : undefined,
          }))
        );
        setPendingCampaignId(res.conversation?.workspace?.pendingConfirmation?.campaignId || null);
      }
    } finally {
      setLoadingConversation(false);
    }
  };

  const startNewConversation = () => {
    if (sending) return;
    setActiveId(null);
    setItems([]);
    setPendingCampaignId(null);
    setNotice(null);
    textareaRef.current?.focus();
  };

  const deleteConversation = async (id: string) => {
    if (sending) return;
    if (!window.confirm("Supprimer cette conversation ?")) return;
    const res = await apiRequest(`/ai/conversations/${id}`, { method: "DELETE" });
    if (res.success) {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) startNewConversation();
    }
  };

  const ensureConversation = async (): Promise<string | null> => {
    if (activeId) return activeId;
    const res = await apiRequest<{ conversation: ConversationSummary }>("/ai/conversations", { method: "POST", body: {} });
    if (!res.success || !res.conversation) {
      setNotice(res.error || "Impossible de créer la conversation.");
      return null;
    }
    setActiveId(res.conversation.id);
    setConversations((prev) => [res.conversation, ...prev]);
    return res.conversation.id;
  };

  const runTurn = async (body: { content?: string; confirmToken?: string }, displayText: string) => {
    if (sending) return;
    const conversationId = await ensureConversation();
    if (!conversationId) return;

    setSending(true);
    setNotice(null);
    setActiveTool(null);
    const assistantId = localId();
    setItems((prev) => [...prev, { id: localId(), role: "user", content: displayText }, { id: assistantId, role: "assistant", content: "", streaming: true }]);

    const controller = new AbortController();
    abortRef.current = controller;

    const appendCard = (card: AiCard, messageId: string) => {
      setItems((prev) => {
        // La carte s'insère avant la bulle assistant en cours de génération
        const idx = prev.findIndex((m) => m.id === assistantId);
        const cardItem: ChatItem = { id: `${messageId}-${localId()}`, role: "tool", content: "", cards: [card] };
        if (idx < 0) return [...prev, cardItem];
        const streamingItem = prev[idx];
        // Si du texte a déjà été produit avant l'outil, on le fige et on ouvre une nouvelle bulle après la carte
        if (streamingItem.content.trim()) {
          const frozen: ChatItem = { ...streamingItem, id: localId(), streaming: false };
          const fresh: ChatItem = { id: assistantId, role: "assistant", content: "", streaming: true };
          return [...prev.slice(0, idx), frozen, cardItem, fresh, ...prev.slice(idx + 1)];
        }
        return [...prev.slice(0, idx), cardItem, ...prev.slice(idx)];
      });
      if (card.type === "confirm_launch") setPendingCampaignId(card.campaignId);
      if (card.type === "launch_result" || card.type === "campaign_proposal") setPendingCampaignId(null);
    };

    const onEvent = (event: AiStreamEvent) => {
      switch (event.type) {
        case "delta":
          setItems((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + event.text } : m)));
          break;
        case "tool_start":
          setActiveTool(event.label);
          break;
        case "tool_end":
          setActiveTool(null);
          break;
        case "card":
          appendCard(event.card, event.messageId);
          break;
        case "error":
          setActiveTool(null);
          if (event.message === "PLAN_UPGRADE_REQUIRED") {
            setStatus((s) => (s ? { ...s, planAllowed: false } : s));
            break;
          }
          setItems((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content || event.message, error: !m.content, streaming: false } : m)));
          if (/indisponible|provider/i.test(event.message)) loadStatus();
          break;
        case "done":
          setConversations((prev) => prev.map((c) => (c.id === event.conversationId ? { ...c, title: event.title, updatedAt: new Date().toISOString() } : c)));
          break;
        default:
          break;
      }
    };

    try {
      await streamAiMessage(conversationId, body, onEvent, controller.signal);
    } finally {
      setSending(false);
      setActiveTool(null);
      abortRef.current = null;
      setItems((prev) => prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)).filter((m) => !(m.id === assistantId && !m.content.trim())));
    }
  };

  const sendText = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setInput("");
    runTurn({ content: clean }, clean);
  };

  const stop = () => abortRef.current?.abort();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendText(input);
    }
  };

  const saveDraftSteps = async (steps: AiDraftStep[]): Promise<boolean> => {
    if (!activeId) return false;
    const res = await apiRequest<{ card: AiCard; messageId: string }>(`/ai/conversations/${activeId}/update-draft`, { method: "POST", body: { steps } });
    if (!res.success) {
      setNotice(res.error || "Impossible d'enregistrer le brouillon.");
      return false;
    }
    if (res.card) {
      setItems((prev) => [...prev, { id: res.messageId || localId(), role: "tool", content: "", cards: [res.card] }]);
      setPendingCampaignId(null);
    }
    return true;
  };

  const renderCard = (card: AiCard, key: string, isLast: boolean) => {
    switch (card.type) {
      case "profiles":
        return <ProfilesCard key={key} card={card} disabled={sending} onAddSelected={(sel) => sendText(sel === "all" ? "Ajoute tous les profils trouvés à une liste." : `Ajoute les profils ${sel.join(", ")} à une liste.`)} />;
      case "list":
        return <ListCard key={key} card={card} />;
      case "campaign_proposal":
        return <CampaignProposalCard key={key} card={card} disabled={sending} onSaveSteps={isLast ? saveDraftSteps : undefined} onLaunch={isLast ? () => sendText("Lance la campagne.") : undefined} />;
      case "confirm_launch":
        return (
          <ConfirmLaunchCard
            key={key}
            card={card}
            disabled={sending}
            consumed={!isLast || pendingCampaignId !== card.campaignId}
            onConfirm={(token) => runTurn({ confirmToken: token }, "Je confirme le lancement de la campagne.")}
            onCancel={() => sendText("Annule le lancement, je ne veux pas lancer maintenant.")}
          />
        );
      case "launch_result":
        return <LaunchResultCard key={key} card={card} />;
      case "account_status":
        return <AccountStatusCard key={key} card={card} />;
      default:
        return null;
    }
  };

  // ─── États bloquants ───────────────────────────────────────────────────────

  if (!status) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#592eff] animate-spin" />
      </div>
    );
  }

  if (!status.planAllowed) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-[32px] bg-white border border-[#e0e0db] p-8 text-center shadow-xs">
          <div className="w-14 h-14 mx-auto rounded-3xl bg-[#ffaae6] flex items-center justify-center">
            <Lock className="w-6 h-6 text-[#21164c]" />
          </div>
          <h2 className="mt-5 text-xl font-extrabold text-[#21164c]">Bleadin IA est réservé aux offres Pro et Business</h2>
          <p className="mt-2 text-[13px] text-[#5f5f69]">Votre assistant de prospection : recherche de profils, création de listes, séquences et messages rédigés pour vous, lancement guidé des campagnes.</p>
          <button type="button" onClick={() => navigate("/settings?tab=billing")} className="mt-6 inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-[#592eff] text-white text-[13px] font-semibold hover:bg-[#4a22e0]">
            <Sparkles className="w-4 h-4" />
            Découvrir les offres
          </button>
        </div>
      </div>
    );
  }

  if (!status.providerConfigured) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-[32px] bg-white border border-[#e0e0db] p-8 text-center shadow-xs">
          <div className="w-14 h-14 mx-auto rounded-3xl bg-[#bcf2ff] flex items-center justify-center">
            <Settings2 className="w-6 h-6 text-[#21164c]" />
          </div>
          <h2 className="mt-5 text-xl font-extrabold text-[#21164c]">Bleadin IA n'est pas encore activé</h2>
          <p className="mt-2 text-[13px] text-[#5f5f69]">
            {isSuperAdmin ? "Configurez et activez un provider IA dans les paramètres de la plateforme." : "L'assistant sera disponible dès que l'administrateur de la plateforme aura activé un provider IA."}
          </p>
          {isSuperAdmin && (
            <button type="button" onClick={() => navigate("/admin/settings")} className="mt-6 inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-[#592eff] text-white text-[13px] font-semibold hover:bg-[#4a22e0]">
              Configurer les providers IA
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── Chat ──────────────────────────────────────────────────────────────────

  const lastCardItemId = [...items].reverse().find((m) => m.cards?.length)?.id;

  return (
    <div className="flex-1 min-h-0 flex bg-[#f8f9fc]">
      {/* Conversations */}
      <aside className={`${sidebarOpen ? "w-64" : "w-0"} shrink-0 transition-all duration-200 overflow-hidden border-r border-[#e0e0db] bg-white hidden md:flex flex-col`}>
        <div className="p-3 border-b border-[#e0e0db]/70">
          <button type="button" onClick={startNewConversation} disabled={sending} className="w-full inline-flex items-center justify-center gap-2 h-9 rounded-xl bg-[#21164c] text-white text-[12px] font-semibold hover:bg-[#2c1f66] disabled:opacity-60">
            <Plus className="w-4 h-4" />
            Nouvelle conversation
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {conversations.length === 0 && <p className="px-3 py-6 text-center text-[11px] text-[#5f5f69]">Aucune conversation pour l'instant.</p>}
          {conversations.map((c) => (
            <div key={c.id} className={`group flex items-center gap-2 rounded-xl px-3 py-2 cursor-pointer ${activeId === c.id ? "bg-[#592eff]/10 text-[#592eff]" : "hover:bg-[#f5f5f7] text-[#353241]"}`} onClick={() => openConversation(c.id)}>
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1 min-w-0 truncate text-[12px] font-semibold">{c.title}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteConversation(c.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-[#5f5f69] hover:text-red-600"
                title="Supprimer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Zone de chat */}
      <section className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[#e0e0db]/70 bg-white/70">
          <button type="button" onClick={() => setSidebarOpen((v) => !v)} className="hidden md:inline-flex w-8 h-8 items-center justify-center rounded-lg text-[#5f5f69] hover:bg-[#f5f5f7]" title={sidebarOpen ? "Masquer les conversations" : "Afficher les conversations"}>
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>
          <div className="w-7 h-7 rounded-xl bg-[#592eff] flex items-center justify-center text-white">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-[#21164c] leading-tight">Bleadin IA</p>
            <p className="text-[10px] text-[#5f5f69] leading-tight">Expert prospection LinkedIn</p>
          </div>
          <button type="button" onClick={startNewConversation} disabled={sending} className="md:hidden ml-auto inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-[#21164c] text-white text-[11px] font-semibold">
            <Plus className="w-3.5 h-3.5" /> Nouveau
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
            {loadingConversation ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-5 h-5 text-[#592eff] animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="py-10 text-center">
                <div className="w-16 h-16 mx-auto rounded-[28px] bg-[#592eff] flex items-center justify-center text-white shadow-lg shadow-[#592eff]/30">
                  <Sparkles className="w-7 h-7" />
                </div>
                <h2 className="mt-5 text-2xl font-extrabold text-[#21164c]">Bonjour{user?.firstName ? ` ${user.firstName}` : ""}, qui prospectons-nous aujourd'hui ?</h2>
                <p className="mt-2 text-[13px] text-[#5f5f69] max-w-md mx-auto">Décrivez votre cible : je cherche les profils, je crée la liste, je propose la séquence et je rédige les messages. Vous validez, puis vous lancez.</p>
                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => sendText(s)} className="text-left rounded-2xl border border-[#e0e0db] bg-white px-4 py-3 text-[12px] font-semibold text-[#353241] hover:border-[#592eff] hover:text-[#592eff] transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              items.map((m) => {
                if (m.cards?.length) {
                  const isLast = m.id === lastCardItemId;
                  return (
                    <div key={m.id} className="space-y-3">
                      {m.role === "user" && m.content && (
                        <div className="flex justify-end">
                          <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[#592eff] text-white px-4 py-2.5 text-[13px] whitespace-pre-wrap">{m.content}</div>
                        </div>
                      )}
                      {m.cards.map((card, i) => renderCard(card, `${m.id}-${i}`, isLast))}
                    </div>
                  );
                }
                if (m.role === "user") {
                  return (
                    <div key={m.id} className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[#592eff] text-white px-4 py-2.5 text-[13px] whitespace-pre-wrap">{m.content}</div>
                    </div>
                  );
                }
                if (m.role !== "assistant" || (!m.content && !m.streaming)) return null;
                return (
                  <div key={m.id} className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-[#592eff] flex items-center justify-center text-white shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div className={`max-w-[85%] rounded-2xl rounded-tl-md border px-4 py-2.5 text-[13px] text-[#353241] ${m.error ? "bg-red-50 border-red-200 text-red-700" : "bg-white border-[#e0e0db]"}`}>
                      {m.error && <AlertCircle className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />}
                      {m.content ? renderMarkdown(m.content) : null}
                      {m.streaming && (
                        <span className="inline-flex items-center gap-1 text-[#5f5f69] mt-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#592eff] animate-bounce [animation-delay:-0.3s]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#592eff] animate-bounce [animation-delay:-0.15s]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#592eff] animate-bounce" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {activeTool && (
              <div className="flex items-center gap-2 pl-10 text-[12px] text-[#5f5f69]">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#592eff]" />
                {activeTool}…
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="border-t border-[#e0e0db]/70 bg-white/80 backdrop-blur px-4 py-3">
          <div className="max-w-3xl mx-auto">
            {notice && (
              <p className="mb-2 text-[12px] text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {notice}
              </p>
            )}
            <div className="flex items-end gap-2 rounded-3xl border border-[#e0e0db] bg-white px-4 py-2 focus-within:border-[#592eff] shadow-xs">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Décrivez votre cible ou posez une question…"
                className="flex-1 resize-none bg-transparent text-[13px] text-[#353241] placeholder:text-[#5f5f69]/70 focus:outline-none max-h-40 py-1.5"
                style={{ height: "auto" }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
                }}
              />
              {sending ? (
                <button type="button" onClick={stop} className="w-9 h-9 rounded-2xl bg-[#21164c] text-white flex items-center justify-center shrink-0" title="Arrêter">
                  <Square className="w-3.5 h-3.5" fill="currentColor" />
                </button>
              ) : (
                <button type="button" onClick={() => sendText(input)} disabled={!input.trim()} className="w-9 h-9 rounded-2xl bg-[#592eff] text-white flex items-center justify-center shrink-0 hover:bg-[#4a22e0] disabled:opacity-40" title="Envoyer">
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="mt-1.5 text-[10px] text-[#5f5f69] text-center">Bleadin IA prépare, vous validez : aucune campagne n'est lancée sans votre confirmation.</p>
          </div>
        </div>
      </section>
    </div>
  );
};
