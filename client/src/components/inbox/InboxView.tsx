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
  X,
  FolderPlus,
} from "lucide-react";
import { InboxConversation, ChatMessage, InboxProspect } from "../../types";
import { initialsDataUrl } from "../ui/avatarFallback";
import { apiRequest } from "../../services/api";
import { NewConversationModal } from "./NewConversationModal";
import { useAuth } from "../../context/AuthContext";

export const InboxView: React.FC = () => {
  const { impersonatedOrg, user: currentUser } = useAuth();
  const currentUserAvatar =
    currentUser?.avatarUrl ||
    initialsDataUrl(currentUser?.name || currentUser?.email || "Moi");
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
  const [sendError, setSendError] = useState<string | null>(null);
  const [totalUnread, setTotalUnread] = useState<number>(0);
  const [showRightDrawer, setShowRightDrawer] = useState<boolean>(true);
  const [crmTab, setCrmTab] = useState<"INFOS" | "NOTES">("INFOS");
  const [isNewConvModalOpen, setIsNewConvModalOpen] = useState<boolean>(false);

  // CRM State for selected prospect
  const [availableLists, setAvailableLists] = useState<{ id: string; name: string; color?: string }[]>([]);
  const [showListSelector, setShowListSelector] = useState<boolean>(false);
  const [assigningList, setAssigningList] = useState<boolean>(false);
  const [listAssignSuccess, setListAssignSuccess] = useState<string | null>(null);

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

  // Charger les listes de prospects CRM disponibles
  const loadAvailableLists = async () => {
    try {
      const res = await apiRequest<{ success: boolean; lists: any[] }>("/lists");
      if (res.success && Array.isArray(res.lists)) {
        setAvailableLists(res.lists);
      }
    } catch (err) {
      console.warn("[InboxView] Erreur chargement listes:", err);
    }
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

  // Sélection instantanée d'une conversation avec effacement immédiat du badge non lu
  const handleSelectConversation = (convId: string) => {
    setSelectedConvId(convId);
    setShowListSelector(false);
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === convId && c.unreadCount > 0) {
          setTotalUnread((t) => Math.max(0, t - c.unreadCount));
          return { ...c, unreadCount: 0 };
        }
        return c;
      })
    );
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
          prev.map((c) => {
            if (c.id === convId && c.unreadCount > 0) {
              setTotalUnread((t) => Math.max(0, t - c.unreadCount));
              return { ...c, unreadCount: 0 };
            }
            return c;
          })
        );
      }
    } catch (err) {
      console.error("[InboxView] Erreur chargement messages:", err);
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  };

  // Assigner le prospect à une liste CRM
  const handleAssignToList = async (listId: string) => {
    if (!currentProspect || assigningList) return;
    setAssigningList(true);
    try {
      const res = await apiRequest<{ success: boolean; prospect: any }>(
        `/inbox/prospects/${currentProspect.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ listId }),
        }
      );
      if (res.success && res.prospect) {
        setConversations((prev) =>
          prev.map((c) =>
            c.prospect.id === currentProspect.id
              ? { ...c, prospect: { ...c.prospect, list: res.prospect.list } }
              : c
          )
        );
        setShowListSelector(false);
        setListAssignSuccess("Prospect assigné à la liste avec succès !");
        setTimeout(() => setListAssignSuccess(null), 3000);
      }
    } catch (err) {
      console.error("[InboxView] Erreur assignation liste:", err);
    } finally {
      setAssigningList(false);
    }
  };

  // Initialisation et filtres
  useEffect(() => {
    loadAvailableLists();
  }, []);

  useEffect(() => {
    setSelectedConvId(null);
    setMessages([]);
    loadConversations();
  }, [filterTab, searchQuery, impersonatedOrg?.id]);

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

  // Polling doux en arrière-plan toutes les 30 secondes pour le temps réel
  useEffect(() => {
    const interval = setInterval(() => {
      loadConversations(true);
      if (selectedConvId) {
        loadMessages(selectedConvId, true);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedConvId]);

  // Envoi d'un message avec mise à jour optimiste et tolérance aux pannes
  const handleSendMessage = async (e?: React.FormEvent, overrideText?: string, failedTempId?: string) => {
    if (e) e.preventDefault();
    const textToSend = (overrideText || inputMessage).trim();
    if (!textToSend || !selectedConvId || sending) return;

    if (!overrideText) {
      setInputMessage("");
    }
    setSending(true);
    setSendError(null);

    const tempId = failedTempId || `temp_${Date.now()}`;
    if (!failedTempId) {
      const tempMessage: ChatMessage = {
        id: tempId,
        senderType: "USER",
        text: textToSend,
        sentAt: new Date().toISOString(),
        status: "sending",
      };
      setMessages((prev) => [...prev, tempMessage]);
    } else {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: "sending" } : m))
      );
    }

    try {
      const res = await apiRequest<{ success: boolean; message?: ChatMessage; error?: string }>(
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
          prev.map((m) => (m.id === tempId ? { ...res.message!, status: "sent" } : m))
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
      } else {
        const errMsg = res.error || "Le service de messagerie LinkedIn est momentanément indisponible.";
        setSendError(errMsg);
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: "error" } : m))
        );
      }
    } catch (err: any) {
      console.error("[InboxView] Erreur envoi message:", err);
      const errMsg =
        err?.message ||
        "Échec d'envoi : la passerelle LinkedIn est temporairement inaccessible. Votre message a été conservé.";
      setSendError(errMsg);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: "error" } : m))
      );
    } finally {
      setSending(false);
      setTimeout(() => messageInputRef.current?.focus(), 50);
    }
  };

  // Réessayer un message en échec
  const handleRetryMessage = (msg: ChatMessage) => {
    handleSendMessage(undefined, msg.text, msg.id);
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
    <div className="flex h-full min-h-0 flex-1 overflow-hidden bg-canvas text-ink">
      {/* ========================================================= */}
      {/* COLONNE 1 : LISTE DES DISCUSSIONS (Gauche - 340px) */}
      {/* ========================================================= */}
      <div className="w-80 lg:w-96 flex flex-col border-r border-line bg-white shrink-0 select-none">
        {/* Header Discussions */}
        <div className="p-4 border-b border-line space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-ink">
                Discussions
              </h2>
              {totalUnread > 0 && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-accent text-white rounded-full">
                  {totalUnread}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleSyncAll}
                disabled={syncing}
                title="Synchroniser avec LinkedIn"
                className="p-2 text-muted hover:text-accent hover:bg-surface-2 rounded-xl transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin text-accent" : ""}`} />
              </button>

              <button
                onClick={() => setIsNewConvModalOpen(true)}
                className="px-2.5 py-1.5 text-xs font-semibold bg-accent-soft text-accent hover:bg-accent-soft rounded-xl transition-all flex items-center gap-1.5 border border-line"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Nouvelle</span>
              </button>
            </div>
          </div>

          {syncSuccessMsg && (
            <div className="p-2 text-xs bg-ok-soft text-ok border border-ok/30 rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              {syncSuccessMsg}
            </div>
          )}

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-muted-2 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher un contact, message..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-canvas border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/20 text-ink placeholder:text-muted-2 transition-all"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-surface-2 p-1 rounded-xl">
            <button
              onClick={() => setFilterTab("ALL")}
              className={`flex-1 py-1 text-xs font-medium rounded-lg transition-all ${
                filterTab === "ALL"
                  ? "bg-white text-ink font-semibold"
                  : "text-muted hover:text-ink"
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setFilterTab("UNREAD")}
              className={`flex-1 py-1 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1 ${
                filterTab === "UNREAD"
                  ? "bg-white text-ink font-semibold"
                  : "text-muted hover:text-ink"
              }`}
            >
              Non lu
              {totalUnread > 0 && (
                <span className="w-4 h-4 rounded-full bg-danger text-white text-xs font-semibold flex items-center justify-center">
                  {totalUnread}
                </span>
              )}
            </button>
            <button
              onClick={() => setFilterTab("IN_CAMPAIGN")}
              className={`flex-1 py-1 text-xs font-medium rounded-lg transition-all ${
                filterTab === "IN_CAMPAIGN"
                  ? "bg-white text-ink font-semibold"
                  : "text-muted hover:text-ink"
              }`}
            >
              En campagne
            </button>
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto divide-y divide-line">
          {loadingList && conversations.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin text-accent mx-auto" />
              <p className="text-xs text-muted-2">Chargement des conversations...</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <MessageSquare className="mx-auto h-5 w-5 text-muted" strokeWidth={1.75} />
              <p className="text-sm font-semibold text-ink">
                Aucune conversation
              </p>
              <p className="text-xs text-muted-2">
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
                  onClick={() => handleSelectConversation(conv.id)}
                  className={`p-3 flex items-start gap-2.5 cursor-pointer transition-all relative ${
                    isSelected
                      ? "bg-accent-soft border-l-3 border-accent"
                      : "hover:bg-canvas"
                  }`}
                >
                  {/* Prospect Avatar with connection ring */}
                  <div className="relative shrink-0">
                    <img
                      src={
                        prospect.avatarUrl ||
                        initialsDataUrl(`${prospect.firstName} ${prospect.lastName}`)
                      }
                      alt=""
                      className="w-10 h-10 rounded-full object-cover border border-line"
                    />
                    {prospect.connectionStatus === "CONNECTED" && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                    )}
                  </div>

                  {/* Conv Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h4
                        className={`text-xs truncate ${
                          hasUnread
                            ? "font-semibold text-ink"
                            : "font-semibold text-ink"
                        }`}
                      >
                        {prospect.firstName} {prospect.lastName}
                      </h4>
                      <span className="text-xs text-muted-2 font-medium shrink-0 ml-1">
                        {formatListDate(conv.lastMessageAt || conv.updatedAt)}
                      </span>
                    </div>

                    <p
                      className={`text-xs truncate line-clamp-1 mb-1 ${
                        hasUnread
                          ? "font-semibold text-ink"
                          : "text-muted"
                      }`}
                    >
                      {conv.lastMessageText || "Discussion synchronisée"}
                    </p>

                    {/* Meta badges */}
                    <div className="flex items-center gap-1.5">
                      {prospect.campaignState && (
                        <span className="px-1.5 py-0.5 text-xs font-medium bg-purple-50 text-purple-600 rounded border border-purple-200/60 truncate max-w-[120px]">
                          {prospect.campaignState.campaignName}
                        </span>
                      )}
                      {prospect.company && (
                        <span className="text-xs text-muted-2 truncate max-w-[100px]">
                          {prospect.company}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Unread counter badge */}
                  {hasUnread && (
                    <div className="shrink-0 self-center">
                      <span className="w-5 h-5 rounded-full bg-accent text-white text-xs font-semibold flex items-center justify-center">
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
        <div className="flex-1 flex flex-col bg-canvas/50 min-w-0">
          {/* Chat Header */}
          <div className="h-16 px-6 border-b border-line bg-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3.5 min-w-0">
              <img
                src={
                  currentProspect.avatarUrl ||
                  initialsDataUrl(`${currentProspect.firstName} ${currentProspect.lastName}`)
                }
                alt=""
                className="w-10 h-10 rounded-full object-cover border border-line shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-ink truncate">
                    {currentProspect.firstName} {currentProspect.lastName}
                  </h3>
                  <span className="px-2 py-0.5 text-xs font-semibold bg-ok-soft text-ok border border-ok/30 rounded-full">
                    {currentProspect.connectionStatus === "CONNECTED" ? "1er degré" : "Contact"}
                  </span>
                </div>
                <p className="text-xs text-muted truncate">
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
                className="px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-surface-2 rounded-xl border border-line flex items-center gap-1.5 transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5 text-accent" />
                <span className="hidden sm:inline">LinkedIn</span>
              </a>

              <button
                onClick={() => setShowRightDrawer(!showRightDrawer)}
                className={`p-2 rounded-xl border transition-all ${
                  showRightDrawer
                    ? "bg-accent-soft border-line text-accent"
                    : "bg-white border-line text-ink-2"
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
                <RefreshCw className="w-6 h-6 animate-spin text-accent mx-auto" />
                <p className="text-xs text-muted-2">Chargement de la discussion...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <MessageSquare className="mx-auto h-5 w-5 text-muted" strokeWidth={1.75} />
                <p className="text-sm font-semibold text-ink">
                  Début de la conversation
                </p>
                <p className="text-xs text-muted-2 max-w-sm mx-auto">
                  Envoyez un message pour démarrer ou poursuivre l'échange directement sur LinkedIn.
                </p>
              </div>
            ) : (
              messages.map((m, idx) => {
                // Convention Bleadin : messages de l'utilisateur à GAUCHE (avec sa photo),
                // messages du prospect à DROITE (avec la photo du prospect).
                const isUser = m.senderType === "USER";
                const prospectAvatar =
                  currentProspect.avatarUrl ||
                  initialsDataUrl(`${currentProspect.firstName} ${currentProspect.lastName}`);
                const avatarSrc = isUser ? currentUserAvatar : prospectAvatar;
                const avatarTitle = isUser
                  ? currentUser?.name || "Vous"
                  : `${currentProspect.firstName} ${currentProspect.lastName}`;
                return (
                  <div
                    key={m.id || idx}
                    className={`flex items-end gap-2 ${isUser ? "justify-start" : "justify-end flex-row-reverse"}`}
                  >
                    <img
                      src={avatarSrc}
                      alt=""
                      title={avatarTitle}
                      className={`w-6 h-6 rounded-full object-cover mb-1 shrink-0 border ${
                        "border-line"
                      }`}
                    />

                    <div className={`max-w-[75%] sm:max-w-[65%] space-y-1 flex flex-col ${isUser ? "items-start" : "items-end"}`}>
                      <div
                        className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed break-words ${
                          isUser
                            ? "bg-ink text-white rounded-tl-md"
                            : "bg-surface border border-line text-ink rounded-tr-md"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.text}</p>

                        {/* Attachments if any */}
                        {m.attachments && m.attachments.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-white/20 space-y-1">
                            {m.attachments.map((att, attIdx) => (
                              <div
                                key={attIdx}
                                className="flex items-center gap-2 p-1.5 bg-black/10 rounded-lg text-xs"
                              >
                                <Paperclip className="w-3.5 h-3.5" />
                                <span className="truncate">{att.file_name || "Pièce jointe"}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div
                        className={`flex items-center gap-1 text-xs text-muted-2 px-1 ${
                          isUser ? "justify-start" : "justify-end"
                        }`}
                      >
                        <span>{formatMessageTime(m.sentAt)}</span>
                        {isUser && (
                          <span>
                            {m.status === "sending" ? (
                              <Clock className="w-3 h-3 text-muted-2 animate-pulse" />
                            ) : m.status === "error" ? (
                              <button
                                type="button"
                                onClick={() => handleRetryMessage(m)}
                                className="inline-flex items-center gap-1 text-xs text-rose-500 hover:text-rose-600 font-semibold cursor-pointer transition-colors"
                                title="Échec de transmission LinkedIn — Cliquer pour réessayer"
                              >
                                <AlertCircle className="w-3 h-3 text-rose-500" />
                                <span>Échec • Réessayer</span>
                              </button>
                            ) : (
                              <CheckCheck className="w-3.5 h-3.5 text-accent" />
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

          {/* Chat Input Footer */}
          <div className="p-3 bg-white border-t border-line space-y-2">
            {sendError && (
              <div className="p-2.5 px-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between text-xs text-rose-700">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span className="truncate">{sendError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSendError(null)}
                  className="text-rose-400 hover:text-rose-600 font-semibold ml-2 text-xs shrink-0 cursor-pointer"
                  title="Fermer"
                >
                  ✕
                </button>
              </div>
            )}
            <form onSubmit={handleSendMessage} className="space-y-2">
              <div className="relative border border-line rounded-2xl bg-canvas/70 focus-within:ring-2 focus-within:ring-accent focus-within:border-transparent transition-all overflow-hidden">
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
                  className="w-full p-3 text-xs bg-transparent focus:outline-none text-ink placeholder:text-muted-2 resize-none max-h-32"
                />

                <div className="px-3 py-1.5 flex items-center justify-end border-t border-line bg-white/40">
                  <button
                    type="submit"
                    disabled={!inputMessage.trim() || sending}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-accent hover:bg-accent-hover rounded-xl flex items-center gap-1.5 disabled:opacity-40 transition-all cursor-pointer"
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
        <div className="flex-1 flex flex-col items-center justify-center bg-canvas/50 text-center p-8 space-y-4">
          <MessageSquare className="h-6 w-6 text-muted" strokeWidth={1.75} />
          <div>
            <h3 className="text-base font-semibold text-ink">
              Sélectionnez une discussion
            </h3>
            <p className="text-xs text-muted-2 max-w-sm mt-1">
              Choisissez un contact dans la liste de gauche ou démarrez une nouvelle discussion pour synchroniser vos échanges en direct.
            </p>
          </div>
          <button
            onClick={() => setIsNewConvModalOpen(true)}
            className="px-4 py-2 text-xs font-semibold text-white bg-accent hover:bg-accent-hover rounded-xl flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            Nouvelle conversation
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* COLONNE 3 : VOLET PROSPECT CRM (Droite - Compact & Rétractable) */}
      {/* ========================================================= */}
      {showRightDrawer && currentProspect && (
        <div className="w-72 lg:w-80 flex flex-col border-l border-line bg-white shrink-0 overflow-y-auto select-none">
          {/* Brand Header */}
          <div className="h-14 px-4 border-b border-line flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold text-accent">
              Fiche Prospect CRM
            </span>
            <div className="flex items-center gap-1">
              <a
                href={currentProspect.linkedinUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 text-muted-2 hover:text-accent rounded-lg hover:bg-surface-2 transition-colors"
                title="Voir le profil sur LinkedIn"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => setShowRightDrawer(false)}
                className="p-1.5 text-muted-2 hover:text-ink-2 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer"
                title="Masquer le volet"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4 flex-1">
            {/* Profile Hero Card */}
            <div className="flex flex-col items-center text-center space-y-2 pb-3 border-b border-line">
              <div className="relative">
                <img
                  src={
                    currentProspect.avatarUrl ||
                    initialsDataUrl(`${currentProspect.firstName} ${currentProspect.lastName}`)
                  }
                  alt=""
                  className="w-12 h-12 rounded-full object-cover border border-line"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent text-white flex items-center justify-center text-xs font-semibold ring-2 ring-white">
                  in
                </span>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-ink">
                  {currentProspect.firstName} {currentProspect.lastName}
                </h3>
                <p className="text-xs text-muted mt-0.5 line-clamp-2">
                  {currentProspect.headline || "Contact LinkedIn"}
                </p>
                {currentProspect.company && (
                  <p className="text-xs font-medium text-accent mt-0.5 flex items-center justify-center gap-1">
                    <Building className="w-3 h-3" />
                    {currentProspect.company}
                  </p>
                )}
              </div>

              <div className="w-full pt-1">
                <a
                  href={currentProspect.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-1.5 text-xs font-semibold bg-accent-soft text-accent hover:bg-violet-100 rounded-xl transition-all border border-violet-200/50 flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-3 h-3" />
                  Voir sur LinkedIn
                </a>
              </div>
            </div>

            {/* Section Liste CRM */}
            <div className="p-3 bg-canvas/80 rounded-2xl border border-line space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-2 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-accent" />
                  Liste CRM
                </span>
                {currentProspect.list && (
                  <button
                    onClick={() => setShowListSelector(!showListSelector)}
                    className="text-xs text-accent hover:underline font-medium cursor-pointer"
                  >
                    Changer
                  </button>
                )}
              </div>

              {listAssignSuccess && (
                <div className="p-2 text-xs text-ok bg-ok-soft rounded-lg border border-ok/30/60">
                  {listAssignSuccess}
                </div>
              )}

              {currentProspect.list ? (
                <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-line">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: currentProspect.list.color || "#592eff" }}
                    />
                    <span className="text-xs font-semibold text-ink truncate">
                      {currentProspect.list.name}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted">
                    Ce contact n'appartient à aucune liste de prospection CRM.
                  </p>
                  {!showListSelector && (
                    <button
                      onClick={() => setShowListSelector(true)}
                      className="w-full py-1.5 px-3 text-xs font-semibold text-white bg-accent hover:bg-accent-hover rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Ajouter à une liste CRM
                    </button>
                  )}
                </div>
              )}

              {showListSelector && (
                <div className="mt-2 p-2 bg-white rounded-xl border border-line space-y-1.5">
                  <div className="flex items-center justify-between pb-1 border-b border-line">
                    <span className="text-xs font-semibold text-ink-2">
                      Choisir une liste :
                    </span>
                    <button
                      onClick={() => setShowListSelector(false)}
                      className="text-muted-2 hover:text-ink-2 text-xs cursor-pointer"
                    >
                      Annuler
                    </button>
                  </div>
                  {availableLists.length === 0 ? (
                    <p className="text-xs text-muted-2 p-1">Aucune liste disponible.</p>
                  ) : (
                    <div className="max-h-32 overflow-y-auto space-y-1 no-scrollbar">
                      {availableLists.map((l) => (
                        <button
                          key={l.id}
                          disabled={assigningList}
                          onClick={() => handleAssignToList(l.id)}
                          className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg flex items-center justify-between hover:bg-accent-soft transition-colors cursor-pointer ${
                            currentProspect.list?.id === l.id
                              ? "bg-accent-soft text-accent font-semibold"
                              : "text-ink-2"
                          }`}
                        >
                          <span className="flex items-center gap-2 truncate">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: l.color || "#592eff" }}
                            />
                            <span className="truncate">{l.name}</span>
                          </span>
                          {currentProspect.list?.id === l.id && (
                            <Check className="w-3.5 h-3.5 text-accent" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tags Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-ink-2 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-accent" />
                  Tags & Segments
                </label>
                <button
                  onClick={() => setShowAddTag(!showAddTag)}
                  className="text-xs text-accent hover:underline font-medium cursor-pointer"
                >
                  + Ajouter
                </button>
              </div>

              {showAddTag && (
                <div className="flex items-center gap-1.5">
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
                    className="flex-1 px-3 py-1.5 text-xs bg-canvas border border-line rounded-lg focus:outline-none focus:ring-1 focus:ring-accent text-ink"
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-2.5 py-1.5 text-xs bg-accent hover:bg-accent-hover text-white rounded-lg font-medium cursor-pointer"
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
                      className="px-2 py-0.5 text-xs font-medium bg-surface-2 text-ink-2 rounded-lg border border-line flex items-center gap-1.5 group"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="text-muted-2 hover:text-danger transition-colors cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))
                ) : (
                  <p className="text-xs text-muted-2 italic">Aucun tag pour le moment.</p>
                )}
              </div>
            </div>

            {/* Campaign Widget */}
            <div className="p-3 bg-purple-50/70 border border-purple-200/60 rounded-2xl space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-purple-900 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-purple-600" />
                  Campagne en cours
                </span>
                <span className="px-2 py-0.5 text-xs font-semibold bg-purple-200/60 text-purple-700 rounded-md">
                  {currentProspect.campaignState?.status || "Hors campagne"}
                </span>
              </div>

              {currentProspect.campaignState ? (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-purple-900">
                    {currentProspect.campaignState.campaignName}
                  </p>
                  <p className="text-xs text-purple-700">
                    Séquence active synchronisée. Les campagnes s'arrêtent automatiquement dès que le prospect répond.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-purple-700">
                  Ce prospect n'est associé à aucune campagne active.
                </p>
              )}
            </div>

            {/* Tabs Infos / Notes */}
            <div className="space-y-2.5 pt-1">
              <div className="flex border-b border-line">
                <button
                  onClick={() => setCrmTab("INFOS")}
                  className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                    crmTab === "INFOS"
                      ? "border-accent text-accent"
                      : "border-transparent text-muted-2 hover:text-ink-2"
                  }`}
                >
                  Infos Prospect
                </button>
                <button
                  onClick={() => setCrmTab("NOTES")}
                  className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                    crmTab === "NOTES"
                      ? "border-accent text-accent"
                      : "border-transparent text-muted-2 hover:text-ink-2"
                  }`}
                >
                  Notes & Historique
                </button>
              </div>

              {crmTab === "INFOS" ? (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-xl hover:bg-canvas">
                    <span className="text-muted-2 flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5" /> Email
                    </span>
                    <div className="flex items-center gap-1.5 font-medium text-ink">
                      <span>{currentProspect.email || "Non renseigné"}</span>
                      {currentProspect.email && (
                        <button
                          onClick={() => handleCopy(currentProspect.email!, "email")}
                          className="text-muted-2 hover:text-accent cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl hover:bg-canvas">
                    <span className="text-muted-2 flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5" /> Téléphone
                    </span>
                    <span className="font-medium text-ink">
                      {currentProspect.phone || "Non renseigné"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl hover:bg-canvas">
                    <span className="text-muted-2 flex items-center gap-2">
                      <Building className="w-3.5 h-3.5" /> Entreprise
                    </span>
                    <span className="font-medium text-ink">
                      {currentProspect.company || "Non renseigné"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl hover:bg-canvas">
                    <span className="text-muted-2 flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5" /> Région
                    </span>
                    <span className="font-medium text-ink">
                      {currentProspect.location || "Côte d'Ivoire / International"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl hover:bg-canvas">
                    <span className="text-muted-2 flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5" /> Liste CRM
                    </span>
                    <span className="font-medium text-accent">
                      {currentProspect.list?.name || "Non assigné"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted">
                      Notes internes sur ce prospect :
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Notez des détails clés (besoins, budget, rappel convenu)..."
                      value={prospectNote}
                      onChange={(e) => setProspectNote(e.target.value)}
                      className="w-full p-2 text-xs bg-canvas border border-line rounded-xl focus:outline-none focus:ring-1 focus:ring-accent text-ink resize-none"
                    />
                  </div>
                  <button
                    onClick={() => {
                      setSavingNote(true);
                      setTimeout(() => setSavingNote(false), 800);
                    }}
                    className="w-full py-2 text-xs font-semibold bg-surface-2 hover:bg-line text-ink rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {savingNote ? <CheckCircle2 className="w-3.5 h-3.5 text-ok" /> : <FileText className="w-3.5 h-3.5" />}
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
