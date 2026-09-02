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
  Sparkles,
  Tag,
  Building,
  MapPin,
  Filter,
  Plus,
  Mail,
  Phone,
  Calendar,
  Briefcase,
  FileText,
  Paperclip,
  Smile,
  ChevronRight,
  Shield,
  Layers,
  AlertCircle,
  Copy,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { InboxConversation, ChatMessage, InboxProspect } from "../../types";
import { apiRequest } from "../../services/api";
import { NewConversationModal } from "./NewConversationModal";

const QUICK_TEMPLATES = [
  { label: "Demande de dispo", text: "Bonjour {{firstName}}, seriez-vous disponible pour un court appel de 10 min cette semaine ?" },
  { label: "Remerciement", text: "Merci pour votre retour {{firstName}} ! Quelles sont vos disponibilités pour échanger ?" },
  { label: "Partage lien", text: "Ravi d'échanger avec vous ! Voici le lien vers notre documentation : https://croixance.net" },
  { label: "Clôture polie", text: "Parfait, je note cela. Je reste à votre entière disposition !" },
];

export const InboxView: React.FC = () => {
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<"ALL" | "UNREAD" | "IN_CAMPAIGN">("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [inputMessage, setInputMessage] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);
  const [totalUnread, setTotalUnread] = useState<number>(0);
  const [showRightDrawer, setShowRightDrawer] = useState<boolean>(true);
  const [crmTab, setCrmTab] = useState<"INFOS" | "NOTES">("INFOS");
  const [isNewConvModalOpen, setIsNewConvModalOpen] = useState<boolean>(false);

  // CRM State for selected prospect
  const [newTagInput, setNewTagInput] = useState<string>("");
  const [showAddTag, setShowAddTag] = useState<boolean>(false);
  const [prospectNote, setProspectNote] = useState<string>("");
  const [savingNote, setSavingNote] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  const selectedConversation = conversations.find((c) => c.id === selectedConvId) || null;
  const currentProspect: InboxProspect | undefined = selectedConversation?.prospect;

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
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
    }
  };

  // 2. Synchronisation complète avec Unipile
  const handleSyncAll = async () => {
    setSyncing(true);
    setSyncSuccessMsg(null);
    try {
      const res = await apiRequest<{ success: boolean; synced: number; message: string }>("/inbox/sync", {
        method: "POST",
      });
      if (res.success) {
        setSyncSuccessMsg(res.message || "Synchronisation terminée !");
        setTimeout(() => setSyncSuccessMsg(null), 4000);
        await loadConversations(true);
      }
    } catch (err) {
      console.error("[InboxView] Erreur synchronisation manuelle:", err);
    } finally {
      setSyncing(false);
    }
  };

  // 3. Charger les messages de la conversation sélectionnée
  const loadMessages = async (convId: string, silent: boolean = false) => {
    if (!silent) setLoadingMessages(true);
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
      if (!silent) setLoadingMessages(false);
    }
  };

  // Initialisation et filtres
  useEffect(() => {
    loadConversations();
  }, [filterTab, searchQuery]);

  // Chargement des messages au changement de sélection
  useEffect(() => {
    if (selectedConvId) {
      loadMessages(selectedConvId);
    }
  }, [selectedConvId]);

  // Auto-scroll en bas de discussion
  useEffect(() => {
    scrollToBottom("auto");
  }, [messages]);

  // Polling doux en arrière-plan toutes les 10 secondes pour le temps réel
  useEffect(() => {
    const interval = setInterval(() => {
      loadConversations(true);
      if (selectedConvId) {
        loadMessages(selectedConvId, true);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedConvId]);

  // Envoi d'un message avec mise à jour optimiste
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || !selectedConvId || sending) return;

    const textToSend = inputMessage.trim();
    setInputMessage("");
    setSending(true);

    // Message optimiste dans l'UI
    const tempMessage: ChatMessage = {
      id: `temp_${Date.now()}`,
      senderType: "USER",
      text: textToSend,
      sentAt: new Date().toISOString(),
      status: "sending",
    };
    setMessages((prev) => [...prev, tempMessage]);

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
        setMessages((prev) =>
          prev.map((m) => (m.id === tempMessage.id ? { ...res.message, status: "sent" } : m))
        );
        // Mettre à jour le dernier message dans la liste de gauche
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
      setTimeout(() => messageInputRef.current?.focus(), 50);
    }
  };

  // Insertion d'un template de réponse rapide avec variables
  const handleApplyTemplate = (tplText: string) => {
    let replaced = tplText;
    if (currentProspect) {
      replaced = replaced.replace(/\{\{firstName\}\}/g, currentProspect.firstName || "");
      replaced = replaced.replace(/\{\{lastName\}\}/g, currentProspect.lastName || "");
      replaced = replaced.replace(/\{\{company\}\}/g, currentProspect.company || "votre entreprise");
    }
    setInputMessage((prev) => (prev ? `${prev} ${replaced}` : replaced));
    messageInputRef.current?.focus();
  };

  // Gestion des Tags CRM
  const handleAddTag = async () => {
    if (!newTagInput.trim() || !currentProspect) return;
    const cleanTag = newTagInput.trim();
    const currentTags = currentProspect.tags || [];
    if (currentTags.includes(cleanTag)) {
      setNewTagInput("");
      setShowAddTag(false);
      return;
    }
    const updatedTags = [...currentTags, cleanTag];

    try {
      const res = await apiRequest<{ success: boolean; prospect: InboxProspect }>(
        `/inbox/prospects/${currentProspect.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ tags: updatedTags }),
        }
      );
      if (res.success) {
        setConversations((prev) =>
          prev.map((c) =>
            c.prospect.id === currentProspect.id
              ? { ...c, prospect: { ...c.prospect, tags: updatedTags } }
              : c
          )
        );
      }
    } catch (err) {
      console.error("Erreur ajout tag:", err);
    } finally {
      setNewTagInput("");
      setShowAddTag(false);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!currentProspect) return;
    const updatedTags = (currentProspect.tags || []).filter((t) => t !== tagToRemove);

    try {
      await apiRequest(`/inbox/prospects/${currentProspect.id}`, {
        method: "PATCH",
        body: JSON.stringify({ tags: updatedTags }),
      });
      setConversations((prev) =>
        prev.map((c) =>
          c.prospect.id === currentProspect.id
            ? { ...c, prospect: { ...c.prospect, tags: updatedTags } }
            : c
        )
      );
    } catch (err) {
      console.error("Erreur suppression tag:", err);
    }
  };

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Formatage des dates relatives
  const formatMessageTime = (dateStr?: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatListDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const diffHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24 && d.getDate() === now.getDate()) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays <= 7) return `${diffDays}j`;
    return d.toLocaleDateString([], { day: "2-digit", month: "short" });
  };

  return (
    <div className="flex h-[calc(100vh-5rem)] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
      {/* ========================================================= */}
      {/* COLONNE 1 : LISTE DES DISCUSSIONS (Gauche - 340px) */}
      {/* ========================================================= */}
      <div className="w-80 lg:w-96 flex flex-col border-r border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900 shrink-0 select-none">
        {/* Header Discussions */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Discussions
              </h2>
              {totalUnread > 0 && (
                <span className="px-2 py-0.5 text-xs font-bold bg-indigo-600 text-white rounded-full shadow-sm">
                  {totalUnread}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleSyncAll}
                disabled={syncing}
                title="Synchroniser avec LinkedIn"
                className="p-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin text-indigo-600" : ""}`} />
              </button>

              <button
                onClick={() => setIsNewConvModalOpen(true)}
                className="px-2.5 py-1.5 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-xl transition-all flex items-center gap-1.5 border border-indigo-200/60 dark:border-indigo-800/50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Nouvelle</span>
              </button>
            </div>
          </div>

          {syncSuccessMsg && (
            <div className="p-2 text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 rounded-lg flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              {syncSuccessMsg}
            </div>
          )}

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher un contact, message..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-slate-400 transition-all"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl">
            <button
              onClick={() => setFilterTab("ALL")}
              className={`flex-1 py-1 text-xs font-medium rounded-lg transition-all ${
                filterTab === "ALL"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setFilterTab("UNREAD")}
              className={`flex-1 py-1 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1 ${
                filterTab === "UNREAD"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Non lu
              {totalUnread > 0 && (
                <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {totalUnread}
                </span>
              )}
            </button>
            <button
              onClick={() => setFilterTab("IN_CAMPAIGN")}
              className={`flex-1 py-1 text-xs font-medium rounded-lg transition-all ${
                filterTab === "IN_CAMPAIGN"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              En campagne
            </button>
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50">
          {loadingList && conversations.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500 mx-auto" />
              <p className="text-xs text-slate-400">Chargement des conversations...</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                <MessageSquare className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Aucune conversation
              </p>
              <p className="text-xs text-slate-400">
                Les messages reçus ou envoyés sur LinkedIn apparaîtront ici automatiquement.
              </p>
            </div>
          ) : (
            conversations.map((conv) => {
              const isSelected = conv.id === selectedConvId;
              const prospect = conv.prospect;
              const hasUnread = conv.unreadCount > 0;

              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`p-3.5 flex items-start gap-3 cursor-pointer transition-all relative ${
                    isSelected
                      ? "bg-indigo-50/70 dark:bg-indigo-950/30 border-l-4 border-indigo-600"
                      : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  }`}
                >
                  {/* Prospect Avatar with connection ring */}
                  <div className="relative shrink-0">
                    <img
                      src={
                        prospect.avatarUrl ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          `${prospect.firstName} ${prospect.lastName}`
                        )}&background=592eff&color=fff`
                      }
                      alt=""
                      className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
                    />
                    {prospect.connectionStatus === "CONNECTED" && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
                    )}
                  </div>

                  {/* Conv Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h4
                        className={`text-xs truncate ${
                          hasUnread
                            ? "font-bold text-slate-900 dark:text-white"
                            : "font-semibold text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        {prospect.firstName} {prospect.lastName}
                      </h4>
                      <span className="text-[11px] text-slate-400 font-medium shrink-0 ml-1">
                        {formatListDate(conv.lastMessageAt || conv.updatedAt)}
                      </span>
                    </div>

                    <p
                      className={`text-xs truncate line-clamp-1 mb-1.5 ${
                        hasUnread
                          ? "font-semibold text-slate-900 dark:text-white"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {conv.lastMessageText || "Discussion synchronisée"}
                    </p>

                    {/* Meta badges */}
                    <div className="flex items-center gap-1.5">
                      {prospect.campaignState && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 rounded border border-purple-200/60 dark:border-purple-800/40 truncate max-w-[120px]">
                          {prospect.campaignState.campaignName}
                        </span>
                      )}
                      {prospect.company && (
                        <span className="text-[10px] text-slate-400 truncate max-w-[100px]">
                          {prospect.company}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Unread counter badge */}
                  {hasUnread && (
                    <div className="shrink-0 self-center">
                      <span className="w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shadow-xs">
                        {conv.unreadCount}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* COLONNE 2 : ZONE DE DISCUSSION ACTIVE (Centre - Flex 1) */}
      {/* ========================================================= */}
      {selectedConversation && currentProspect ? (
        <div className="flex-1 flex flex-col bg-slate-50/50 dark:bg-slate-950/50 min-w-0">
          {/* Chat Header */}
          <div className="h-16 px-6 border-b border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center gap-3.5 min-w-0">
              <img
                src={
                  currentProspect.avatarUrl ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    `${currentProspect.firstName} ${currentProspect.lastName}`
                  )}&background=592eff&color=fff`
                }
                alt=""
                className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-xs shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {currentProspect.firstName} {currentProspect.lastName}
                  </h3>
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-full">
                    {currentProspect.connectionStatus === "CONNECTED" ? "1er degré" : "Contact"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {currentProspect.headline || currentProspect.company || "Profil LinkedIn"}
                </p>
              </div>
            </div>

            {/* Actions top bar */}
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={currentProspect.linkedinUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/80 flex items-center gap-1.5 transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5 text-indigo-500" />
                <span className="hidden sm:inline">LinkedIn</span>
              </a>

              <button
                onClick={() => setShowRightDrawer(!showRightDrawer)}
                className={`p-2 rounded-xl border transition-all ${
                  showRightDrawer
                    ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                }`}
                title="Afficher/Masquer les détails du prospect"
              >
                <User className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Timeline */}
          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            {loadingMessages ? (
              <div className="py-16 text-center space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-500 mx-auto" />
                <p className="text-xs text-slate-400">Chargement de la discussion...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                  <Sparkles className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Début de la conversation
                </p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Envoyez un message pour démarrer ou poursuivre l'échange directement sur LinkedIn.
                </p>
              </div>
            ) : (
              messages.map((m, idx) => {
                const isUser = m.senderType === "USER";
                return (
                  <div
                    key={m.id || idx}
                    className={`flex items-end gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    {!isUser && (
                      <img
                        src={
                          currentProspect.avatarUrl ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(
                            `${currentProspect.firstName} ${currentProspect.lastName}`
                          )}&background=592eff&color=fff`
                        }
                        alt=""
                        className="w-7 h-7 rounded-full object-cover mb-1 shrink-0 border border-slate-200 dark:border-slate-700"
                      />
                    )}

                    <div className={`max-w-md lg:max-w-lg space-y-1 ${isUser ? "items-end" : "items-start"}`}>
                      <div
                        className={`px-4 py-3 rounded-2xl text-xs leading-relaxed shadow-xs ${
                          isUser
                            ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-xs"
                            : "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/80 rounded-bl-xs"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.text}</p>

                        {/* Attachments if any */}
                        {m.attachments && m.attachments.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-white/20 space-y-1">
                            {m.attachments.map((att, attIdx) => (
                              <div
                                key={attIdx}
                                className="flex items-center gap-2 p-1.5 bg-black/10 rounded-lg text-[11px]"
                              >
                                <Paperclip className="w-3.5 h-3.5" />
                                <span className="truncate">{att.file_name || "Pièce jointe"}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div
                        className={`flex items-center gap-1.5 text-[10px] text-slate-400 px-1 ${
                          isUser ? "justify-end" : "justify-start"
                        }`}
                      >
                        <span>{formatMessageTime(m.sentAt)}</span>
                        {isUser && (
                          <span>
                            {m.status === "sending" ? (
                              <Clock className="w-3 h-3 text-slate-400 animate-pulse" />
                            ) : (
                              <CheckCheck className="w-3.5 h-3.5 text-indigo-500" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Replies Bar */}
          <div className="px-6 py-2 bg-white/60 dark:bg-slate-900/60 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-semibold text-slate-400 shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-500" />
              Réponses rapides :
            </span>
            {QUICK_TEMPLATES.map((tpl, tIdx) => (
              <button
                key={tIdx}
                onClick={() => handleApplyTemplate(tpl.text)}
                className="px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 dark:hover:text-indigo-300 rounded-lg transition-all shrink-0 border border-slate-200/50 dark:border-slate-700/50"
              >
                {tpl.label}
              </button>
            ))}
          </div>

          {/* Rich Chat Input Footer */}
          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800/80">
            <form onSubmit={handleSendMessage} className="space-y-2">
              <div className="relative border border-slate-200 dark:border-slate-700/80 rounded-2xl bg-slate-50 dark:bg-slate-800/60 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all overflow-hidden">
                <textarea
                  ref={messageInputRef}
                  rows={2}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Écrivez votre message LinkedIn... (Entrée pour envoyer, Shift+Entrée pour saut de ligne)"
                  className="w-full p-3 text-xs bg-transparent focus:outline-none text-slate-900 dark:text-white placeholder-slate-400 resize-none max-h-32"
                />

                <div className="px-3 py-2 flex items-center justify-between border-t border-slate-200/50 dark:border-slate-700/50 bg-white/40 dark:bg-slate-900/40">
                  <div className="flex items-center gap-2 text-slate-400">
                    <button
                      type="button"
                      onClick={() => handleApplyTemplate("Bonjour {{firstName}}, ")}
                      className="px-2 py-1 text-[11px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded hover:bg-indigo-100 font-medium"
                    >
                      + {currentProspect.firstName || "Prénom"}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={!inputMessage.trim() || sending}
                    className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl shadow-md shadow-indigo-500/20 flex items-center gap-1.5 disabled:opacity-40 transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Envoyer</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-950/50 text-center p-8 space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/10">
            <MessageSquare className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Sélectionnez une discussion
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              Choisissez un contact dans la liste de gauche ou démarrez une nouvelle discussion pour synchroniser vos échanges en direct.
            </p>
          </div>
          <button
            onClick={() => setIsNewConvModalOpen(true)}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            Nouvelle conversation
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* COLONNE 3 : VOLET PROSPECT CRM (Droite - 360px) */}
      {/* ========================================================= */}
      {showRightDrawer && currentProspect && (
        <div className="w-80 lg:w-96 flex flex-col border-l border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900 shrink-0 overflow-y-auto select-none">
          {/* Brand Header */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Fiche Prospect CRM
              </span>
            </div>
            <a
              href={currentProspect.linkedinUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Voir le profil sur LinkedIn"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          <div className="p-5 space-y-6 flex-1">
            {/* Profile Hero Card */}
            <div className="flex flex-col items-center text-center space-y-3 pb-5 border-b border-slate-100 dark:border-slate-800">
              <div className="relative">
                <img
                  src={
                    currentProspect.avatarUrl ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      `${currentProspect.firstName} ${currentProspect.lastName}`
                    )}&background=592eff&color=fff`
                  }
                  alt=""
                  className="w-20 h-20 rounded-full object-cover border-2 border-indigo-500/30 shadow-md"
                />
                <span className="absolute bottom-0 right-1 w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold ring-2 ring-white dark:ring-slate-900">
                  in
                </span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {currentProspect.firstName} {currentProspect.lastName}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                  {currentProspect.headline || "Contact LinkedIn"}
                </p>
                {currentProspect.company && (
                  <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mt-1 flex items-center justify-center gap-1">
                    <Building className="w-3.5 h-3.5" />
                    {currentProspect.company}
                  </p>
                )}
              </div>

              <div className="w-full flex items-center gap-2 pt-1">
                <a
                  href={currentProspect.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-2 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-xl transition-all border border-indigo-200/50 flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Voir sur LinkedIn
                </a>
              </div>
            </div>

            {/* Tags Section */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-500" />
                  Tags & Segments
                </label>
                <button
                  onClick={() => setShowAddTag(!showAddTag)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                >
                  + Ajouter
                </button>
              </div>

              {showAddTag && (
                <div className="flex items-center gap-1.5 animate-fade-in">
                  <input
                    type="text"
                    placeholder="Nom du tag..."
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-white"
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-2.5 py-1.5 text-xs bg-indigo-600 text-white rounded-lg font-medium"
                  >
                    OK
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                {currentProspect.tags && currentProspect.tags.length > 0 ? (
                  currentProspect.tags.map((tag, tIdx) => (
                    <span
                      key={tIdx}
                      className="px-2.5 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-1.5 group"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                      >
                        ×
                      </button>
                    </span>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">Aucun tag pour le moment.</p>
                )}
              </div>
            </div>

            {/* Campaign Widget */}
            <div className="p-3.5 bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-900/40 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-purple-600" />
                  Campagne en cours
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-200/60 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 rounded-md">
                  {currentProspect.campaignState?.status || "Hors campagne"}
                </span>
              </div>

              {currentProspect.campaignState ? (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-purple-900 dark:text-purple-200">
                    {currentProspect.campaignState.campaignName}
                  </p>
                  <p className="text-[11px] text-purple-700 dark:text-purple-400">
                    Séquence active synchronisée. Les campagnes s'arrêtent automatiquement dès que le prospect répond.
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-purple-700 dark:text-purple-400">
                  Ce prospect n'est associé à aucune campagne active.
                </p>
              )}
            </div>

            {/* Tabs Infos / Notes */}
            <div className="space-y-3 pt-2">
              <div className="flex border-b border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setCrmTab("INFOS")}
                  className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all ${
                    crmTab === "INFOS"
                      ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  Infos Prospect
                </button>
                <button
                  onClick={() => setCrmTab("NOTES")}
                  className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all ${
                    crmTab === "NOTES"
                      ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  Notes & Historique
                </button>
              </div>

              {crmTab === "INFOS" ? (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <span className="text-slate-400 flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5" /> Email
                    </span>
                    <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                      <span>{currentProspect.email || "Non renseigné"}</span>
                      {currentProspect.email && (
                        <button
                          onClick={() => handleCopy(currentProspect.email!, "email")}
                          className="text-slate-400 hover:text-indigo-600"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <span className="text-slate-400 flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5" /> Téléphone
                    </span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {currentProspect.phone || "Non renseigné"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <span className="text-slate-400 flex items-center gap-2">
                      <Building className="w-3.5 h-3.5" /> Entreprise
                    </span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {currentProspect.company || "Non renseigné"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <span className="text-slate-400 flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5" /> Région
                    </span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {currentProspect.location || "Côte d'Ivoire / International"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <span className="text-slate-400 flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5" /> Liste Bime
                    </span>
                    <span className="font-medium text-indigo-600 dark:text-indigo-400">
                      {currentProspect.list?.name || "Messagerie LinkedIn"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-500">
                      Notes internes sur ce prospect :
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Notez des détails clés (besoins, budget, rappel convenu)..."
                      value={prospectNote}
                      onChange={(e) => setProspectNote(e.target.value)}
                      className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-white resize-none"
                    />
                  </div>
                  <button
                    onClick={() => {
                      setSavingNote(true);
                      setTimeout(() => setSavingNote(false), 800);
                    }}
                    className="w-full py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl transition-all flex items-center justify-center gap-1.5"
                  >
                    {savingNote ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <FileText className="w-3.5 h-3.5" />}
                    {savingNote ? "Note enregistrée !" : "Enregistrer la note"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Conversation Modal */}
      <NewConversationModal
        isOpen={isNewConvModalOpen}
        onClose={() => setIsNewConvModalOpen(false)}
        onConversationCreated={(newConv) => {
          setConversations((prev) => [newConv, ...prev.filter((c) => c.id !== newConv.id)]);
          setSelectedConvId(newConv.id);
        }}
      />
    </div>
  );
};
