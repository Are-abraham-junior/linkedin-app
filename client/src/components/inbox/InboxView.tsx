import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Send,
  RefreshCw,
  MessageSquare,
  User,
  ExternalLink,
  Clock,
  Check,
  CheckCheck,
  ShieldCheck,
  Sparkles,
  Layers,
  Tag,
  FileText,
  AlertCircle,
  Briefcase,
  Building,
  MapPin,
  ChevronRight,
  Filter,
  Flame,
} from "lucide-react";
import { InboxConversation, ChatMessage } from "../../types";
import { apiRequest } from "../../services/api";

const QUICK_REPLIES = [
  "Merci pour votre retour ! Quelles sont vos disponibilités cette semaine pour échanger ?",
  "Bonjour {{firstName}}, seriez-vous disponible pour un court appel de 10 min ?",
  "Ravi d'échanger avec vous ! Voici le lien vers notre présentation :",
  "Parfait, je note cela. Je reste à votre entière disposition !",
];

export const InboxView: React.FC = () => {
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [filterTab, setFilterTab] = useState<"ALL" | "UNREAD" | "IN_CAMPAIGN">("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [inputMessage, setInputMessage] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);
  const [totalUnread, setTotalUnread] = useState<number>(0);
  const [noteText, setNoteText] = useState<string>("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 1. Charger la liste des conversations
  const loadConversations = async (silent: boolean = false) => {
    if (!silent) setLoadingList(true);
    try {
      let url = "/inbox/conversations";
      const params = new URLSearchParams();
      if (filterTab !== "ALL") params.append("status", filterTab);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());

      const qs = params.toString();
      if (qs) url += `?${qs}`;

      const res = await apiRequest<{
        success: boolean;
        conversations: InboxConversation[];
        totalUnread: number;
      }>(url);

      if (res.success && Array.isArray(res.conversations)) {
        setConversations(res.conversations);
        setTotalUnread(res.totalUnread || 0);

        // Sélectionner la première si aucune n'est sélectionnée
        if (!selectedConvId && res.conversations.length > 0) {
          setSelectedConvId(res.conversations[0].id);
        }
      }
    } catch (err) {
      console.error("[InboxView] Erreur chargement conversations:", err);
    } finally {
      if (!silent) setLoadingList(false);
      setSyncing(false);
    }
  };

  // 2. Charger les messages d'une conversation sélectionnée
  const loadMessages = async (convId: string) => {
    setLoadingMessages(true);
    try {
      const res = await apiRequest<{
        success: boolean;
        messages: ChatMessage[];
      }>(`/inbox/conversations/${convId}/messages`);

      if (res.success && Array.isArray(res.messages)) {
        setMessages(res.messages);
        // Mettre à jour l'état non-lu localement
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))
        );
      }
    } catch (err) {
      console.error("[InboxView] Erreur chargement messages:", err);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [filterTab]);

  useEffect(() => {
    if (selectedConvId) {
      loadMessages(selectedConvId);
    }
  }, [selectedConvId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Envoi d'un message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || !selectedConvId || sending) return;

    const textToSend = inputMessage.trim();
    setInputMessage("");
    setSending(true);

    try {
      const res = await apiRequest<{ success: boolean; message: ChatMessage }>(
        "/inbox/messages/send",
        {
          method: "POST",
          body: JSON.stringify({
            conversationId: selectedConvId,
            text: textToSend,
          }),
        }
      );

      if (res.success && res.message) {
        setMessages((prev) => [...prev, res.message]);
        // Mettre à jour le dernier message dans la liste
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConvId
              ? {
                  ...c,
                  lastMessageText: textToSend,
                  lastMessageAt: new Date().toISOString(),
                }
              : c
          )
        );
      }
    } catch (err) {
      console.error("[InboxView] Erreur envoi message:", err);
    } finally {
      setSending(false);
    }
  };

  const handleApplyQuickReply = (text: string) => {
    const selectedConv = conversations.find((c) => c.id === selectedConvId);
    const firstName = selectedConv?.prospect?.firstName || "";
    const personalized = text.replace(/{{firstName}}/g, firstName);
    setInputMessage(personalized);
  };

  const selectedConv = conversations.find((c) => c.id === selectedConvId);

  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div className="flex h-full w-full bg-[#fbfbfe] overflow-hidden">
      {/* ========================================================================= */}
      {/* VOLET 1 (GAUCHE) : Liste des conversations & Filtres                      */}
      {/* ========================================================================= */}
      <div className="w-80 sm:w-96 shrink-0 border-r border-[#e0e0db] bg-white flex flex-col h-full">
        {/* Header Volet Gauche */}
        <div className="p-5 border-b border-[#f0f0ed] space-y-3.5 shrink-0 bg-gradient-to-b from-[#fafafd] to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-[#592eff]/10 text-[#592eff] flex items-center justify-center border border-[#592eff]/20">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-base font-bold text-[#21164c] tracking-tight">
                  Messagerie
                </h1>
                <p className="text-[11px] text-[#5f5f69]">
                  {conversations.length} conversation(s) LinkedIn
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setSyncing(true);
                loadConversations(true);
              }}
              disabled={syncing}
              title="Synchroniser avec LinkedIn"
              className="p-2 rounded-xl text-[#5f5f69] hover:text-[#592eff] hover:bg-[#592eff]/5 border border-[#e0e0db] transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin text-[#592eff]" : ""}`} />
            </button>
          </div>

          {/* Barre de recherche */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#5f5f69] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadConversations()}
              placeholder="Rechercher un prospect, message..."
              className="w-full pl-8.5 pr-3 py-2 rounded-xl border border-[#e0e0db] text-xs text-[#21164c] focus:outline-none focus:border-[#592eff] bg-white font-medium placeholder:text-[#5f5f69]/60"
            />
          </div>

          {/* Filtres par Onglets Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-[#f5f5f7] rounded-xl">
            {[
              { key: "ALL", label: "Toutes" },
              { key: "UNREAD", label: `Non lues ${totalUnread > 0 ? `(${totalUnread})` : ""}` },
              { key: "IN_CAMPAIGN", label: "En campagne" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilterTab(tab.key as any)}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all text-center cursor-pointer ${
                  filterTab === tab.key
                    ? "bg-white text-[#592eff] shadow-xs"
                    : "text-[#5f5f69] hover:text-[#21164c]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Liste des conversations (scrollable) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-[#f0f0ed]">
          {loadingList ? (
            <div className="p-8 text-center space-y-2 text-[#5f5f69] text-xs">
              <RefreshCw className="w-5 h-5 animate-spin text-[#592eff] mx-auto mb-2" />
              <p>Synchronisation des discussions LinkedIn...</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 text-[#5f5f69] flex items-center justify-center mx-auto mb-2">
                <MessageSquare className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-[#21164c]">Aucune conversation trouvée</p>
              <p className="text-[11px] text-[#5f5f69]">
                Les messages reçus ou envoyés via vos campagnes apparaîtront automatiquement ici.
              </p>
            </div>
          ) : (
            conversations.map((conv) => {
              const isSelected = selectedConvId === conv.id;
              const isUnread = conv.unreadCount > 0;
              const hasCampaign = Boolean(conv.prospect?.campaignState);

              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`p-4 cursor-pointer transition-all flex items-start gap-3 relative ${
                    isSelected
                      ? "bg-[#592eff]/[0.04] border-l-4 border-l-[#592eff]"
                      : "hover:bg-slate-50/70"
                  }`}
                >
                  {/* Avatar avec indicateur en ligne */}
                  <div className="relative shrink-0">
                    {conv.prospect?.avatarUrl ? (
                      <img
                        src={conv.prospect.avatarUrl}
                        alt={conv.prospect.firstName}
                        className="w-10 h-10 rounded-2xl object-cover border border-[#e0e0db]"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#592eff]/20 to-[#592eff]/5 text-[#592eff] font-bold text-xs flex items-center justify-center border border-[#592eff]/20">
                        {conv.prospect?.firstName?.[0] || ""}
                        {conv.prospect?.lastName?.[0] || ""}
                      </div>
                    )}
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white absolute -bottom-0.5 -right-0.5" />
                  </div>

                  {/* Détails texte */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3
                        className={`text-xs truncate ${
                          isUnread ? "font-black text-[#21164c]" : "font-bold text-[#21164c]"
                        }`}
                      >
                        {conv.prospect?.firstName} {conv.prospect?.lastName}
                      </h3>
                      <span className="text-[10px] text-[#5f5f69] shrink-0 ml-1">
                        {formatTimestamp(conv.lastMessageAt)}
                      </span>
                    </div>

                    <p
                      className={`text-[11px] truncate mb-1.5 ${
                        isUnread ? "font-bold text-[#21164c]" : "text-[#5f5f69]"
                      }`}
                    >
                      {conv.lastMessageText || "Aucun message"}
                    </p>

                    {/* Badge de campagne si actif */}
                    {hasCampaign && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#592eff]/10 text-[#592eff]">
                        <Layers className="w-2.5 h-2.5" />
                        {conv.prospect.campaignState?.campaignName || "En campagne"}
                      </span>
                    )}
                  </div>

                  {/* Pastille non lue */}
                  {isUnread && (
                    <span className="w-2 h-2 rounded-full bg-[#592eff] shrink-0 mt-1.5" />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VOLET 2 (CENTRE) : Fil de discussion chronologique & Zone de saisie        */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col h-full bg-[#fafafd] min-w-0">
        {selectedConv ? (
          <>
            {/* Header de discussion */}
            <div className="px-6 py-4 bg-white border-b border-[#e0e0db] flex items-center justify-between shrink-0 shadow-2xs">
              <div className="flex items-center gap-3">
                {selectedConv.prospect?.avatarUrl ? (
                  <img
                    src={selectedConv.prospect.avatarUrl}
                    alt={selectedConv.prospect.firstName}
                    className="w-10 h-10 rounded-2xl object-cover border border-[#e0e0db]"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-2xl bg-[#592eff]/10 text-[#592eff] font-bold text-xs flex items-center justify-center">
                    {selectedConv.prospect?.firstName?.[0] || ""}
                    {selectedConv.prospect?.lastName?.[0] || ""}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-[#21164c]">
                      {selectedConv.prospect?.firstName} {selectedConv.prospect?.lastName}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Connecté
                    </span>
                  </div>
                  <p className="text-[11px] text-[#5f5f69] truncate max-w-md">
                    {selectedConv.prospect?.headline || selectedConv.prospect?.company || "LinkedIn Member"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={selectedConv.prospect?.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-1.5 rounded-xl border border-[#e0e0db] text-xs font-bold text-[#21164c] hover:border-[#592eff] hover:text-[#592eff] transition-colors flex items-center gap-1.5 bg-white shadow-2xs"
                >
                  <span>Profil LinkedIn</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Notification de sortie positive si le prospect a répondu */}
            {selectedConv.prospect?.campaignState?.status === "REPLIED" && (
              <div className="px-6 py-2.5 bg-emerald-50/90 border-b border-emerald-200/70 flex items-center justify-between text-xs text-emerald-800 shrink-0">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">
                    Réponse détectée ! La séquence automatisée a été arrêtée avec succès pour ce prospect.
                  </span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  Lead qualifié
                </span>
              </div>
            )}

            {/* Fil des messages chronologique */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full text-xs text-[#5f5f69] gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#592eff]" />
                  <span>Chargement des messages...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-[#e0e0db] text-[#592eff] flex items-center justify-center shadow-xs">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-[#21164c]">Démarrez la conversation</p>
                  <p className="text-[11px] text-[#5f5f69] max-w-xs">
                    Envoyez un message direct à {selectedConv.prospect?.firstName} pour initier l'échange.
                  </p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isUser = msg.senderType === "USER";
                  return (
                    <div
                      key={msg.id || index}
                      className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`max-w-[75%] p-4 text-xs leading-relaxed transition-all shadow-xs ${
                          isUser
                            ? "bg-[#592eff] text-white rounded-2xl rounded-tr-xs"
                            : "bg-white text-[#21164c] border border-[#e0e0db] rounded-2xl rounded-tl-xs"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      </div>
                      <div className="flex items-center gap-1 mt-1 px-1">
                        <span className="text-[10px] text-[#5f5f69]/80">
                          {formatTimestamp(msg.sentAt)}
                        </span>
                        {isUser && <CheckCheck className="w-3 h-3 text-[#592eff]" />}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Zone de saisie et réponses rapides */}
            <div className="p-5 bg-white border-t border-[#e0e0db] space-y-3 shrink-0">
              {/* Réponses rapides (Quick Replies Pills) */}
              <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#5f5f69] shrink-0 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#592eff]" /> Réponses rapides :
                </span>
                {QUICK_REPLIES.map((qr, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyQuickReply(qr)}
                    className="px-3 py-1 rounded-full text-[11px] font-medium bg-[#f5f5f7] text-[#21164c] hover:bg-[#592eff]/10 hover:text-[#592eff] transition-colors shrink-0 cursor-pointer border border-[#e0e0db]/60"
                  >
                    {qr.slice(0, 45)}...
                  </button>
                ))}
              </div>

              {/* Formulaire d'envoi */}
              <form onSubmit={handleSendMessage} className="flex items-end gap-3">
                <div className="flex-1 rounded-2xl border border-[#e0e0db] focus-within:border-[#592eff] focus-within:ring-2 focus-within:ring-[#592eff]/10 bg-white p-3 transition-all">
                  <textarea
                    rows={2}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={`Écrivez votre message à ${selectedConv.prospect?.firstName || "ce prospect"}... (Entrée pour envoyer)`}
                    className="w-full text-xs text-[#21164c] focus:outline-none resize-none font-medium leading-relaxed"
                  />
                  <div className="flex items-center justify-between pt-1 border-t border-[#f0f0ed] text-[10px] text-[#5f5f69]">
                    <span>Shift + Entrée pour saut de ligne</span>
                    <span>Directement transmis sur LinkedIn</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={sending || !inputMessage.trim()}
                  className="px-5 py-3.5 rounded-2xl bg-[#592eff] hover:bg-[#4d25e0] text-white text-xs font-bold transition-all shadow-md shadow-[#592eff]/25 disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer active:scale-95 shrink-0"
                >
                  <Send className="w-4 h-4" />
                  <span>{sending ? "Envoi..." : "Envoyer"}</span>
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3 text-[#5f5f69]">
            <div className="w-14 h-14 rounded-3xl bg-white border border-[#e0e0db] flex items-center justify-center text-[#592eff] shadow-sm">
              <MessageSquare className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-[#21164c]">Sélectionnez une discussion</h3>
            <p className="text-xs max-w-sm">
              Choisissez un contact dans la liste de gauche pour lire vos échanges et y répondre en direct.
            </p>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* VOLET 3 (DROITE) : Volet Contextuel Mini-CRM Prospect                     */}
      {/* ========================================================================= */}
      {selectedConv && (
        <div className="w-80 shrink-0 border-l border-[#e0e0db] bg-white hidden xl:flex flex-col h-full overflow-y-auto custom-scrollbar p-6 space-y-6">
          {/* Profil Sommaire */}
          <div className="text-center pb-5 border-b border-[#f0f0ed] space-y-3">
            {selectedConv.prospect?.avatarUrl ? (
              <img
                src={selectedConv.prospect.avatarUrl}
                alt={selectedConv.prospect.firstName}
                className="w-20 h-20 rounded-3xl object-cover mx-auto border-2 border-[#592eff]/30 shadow-sm"
              />
            ) : (
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#592eff]/20 to-[#592eff]/5 text-[#592eff] font-black text-xl flex items-center justify-center mx-auto border border-[#592eff]/20">
                {selectedConv.prospect?.firstName?.[0] || ""}
                {selectedConv.prospect?.lastName?.[0] || ""}
              </div>
            )}

            <div>
              <h3 className="text-base font-bold text-[#21164c]">
                {selectedConv.prospect?.firstName} {selectedConv.prospect?.lastName}
              </h3>
              <p className="text-xs text-[#5f5f69] mt-0.5 leading-relaxed">
                {selectedConv.prospect?.headline || "Profil LinkedIn"}
              </p>
            </div>

            <a
              href={selectedConv.prospect?.linkedinUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#592eff]/10 hover:bg-[#592eff]/20 text-[#592eff] text-xs font-bold transition-colors cursor-pointer"
            >
              <span>Voir sur LinkedIn</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Section Campagne & Séquence en cours */}
          <div className="space-y-3 pb-5 border-b border-[#f0f0ed]">
            <span className="text-[10px] font-bold text-[#21164c] uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#592eff]" />
              Campagne Bime Link
            </span>

            {selectedConv.prospect?.campaignState ? (
              <div className="p-4 rounded-2xl bg-[#fafafd] border border-[#e0e0db] space-y-2">
                <p className="text-xs font-bold text-[#21164c] truncate">
                  {selectedConv.prospect.campaignState.campaignName}
                </p>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#5f5f69]">Statut :</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                      selectedConv.prospect.campaignState.status === "REPLIED"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {selectedConv.prospect.campaignState.status === "REPLIED"
                      ? "A répondu"
                      : selectedConv.prospect.campaignState.status}
                  </span>
                </div>
                {selectedConv.prospect.campaignState.currentStepOrder && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#5f5f69]">Étape atteinte :</span>
                    <span className="font-bold text-[#21164c]">
                      Étape {selectedConv.prospect.campaignState.currentStepOrder}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-[#5f5f69] italic bg-slate-50 p-3 rounded-xl border border-[#e0e0db]/60">
                Ce prospect n'a pas été engagé via une campagne automatique.
              </p>
            )}
          </div>

          {/* Section Coordonnées & Entreprise */}
          <div className="space-y-3 pb-5 border-b border-[#f0f0ed]">
            <span className="text-[10px] font-bold text-[#21164c] uppercase tracking-wider flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-[#592eff]" />
              Informations B2B
            </span>

            <div className="space-y-2 text-xs">
              {selectedConv.prospect?.company && (
                <div className="flex items-center gap-2 text-[#21164c]">
                  <Building className="w-3.5 h-3.5 text-[#5f5f69]" />
                  <span className="font-semibold">{selectedConv.prospect.company}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-[#5f5f69]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Synchronisé avec l'API Unipile</span>
              </div>
            </div>
          </div>

          {/* Section Notes Internes */}
          <div className="space-y-3">
            <span className="text-[10px] font-bold text-[#21164c] uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#592eff]" />
              Notes & Remarques
            </span>
            <textarea
              rows={4}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Ajouter une note privée sur ce prospect..."
              className="w-full p-3 rounded-xl border border-[#e0e0db] text-xs text-[#21164c] focus:outline-none focus:border-[#592eff] resize-none font-medium bg-[#fafafd]"
            />
          </div>
        </div>
      )}
    </div>
  );
};
