import React, { useState, useEffect } from "react";
import {
  X,
  Search,
  Send,
  User,
  Sparkles,
  ExternalLink,
  MessageSquare,
  Building,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { apiRequest } from "../../services/api";
import { InboxConversation, ProspectItem } from "../../types";

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConversationCreated: (conversation: InboxConversation) => void;
}

export const NewConversationModal: React.FC<NewConversationModalProps> = ({
  isOpen,
  onClose,
  onConversationCreated,
}) => {
  const [activeTab, setActiveTab] = useState<"PROSPECT" | "LINKEDIN_URL">("PROSPECT");
  const [prospects, setProspects] = useState<ProspectItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProspect, setSelectedProspect] = useState<ProspectItem | null>(null);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [initialMessage, setInitialMessage] = useState("");
  const [loadingProspects, setLoadingProspects] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && activeTab === "PROSPECT") {
      fetchProspects();
    }
  }, [isOpen, activeTab]);

  const fetchProspects = async () => {
    setLoadingProspects(true);
    setError(null);
    try {
      const res = await apiRequest<{ success: boolean; prospects: ProspectItem[] }>(
        "/prospects?limit=50"
      );
      if (res.success && Array.isArray(res.prospects)) {
        setProspects(res.prospects);
      }
    } catch (err: any) {
      console.error("Erreur chargement prospects:", err);
    } finally {
      setLoadingProspects(false);
    }
  };

  if (!isOpen) return null;

  const filteredProspects = prospects.filter((p) => {
    const q = searchQuery.toLowerCase();
    const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
    const company = (p.company || "").toLowerCase();
    const headline = (p.headline || "").toLowerCase();
    return fullName.includes(q) || company.includes(q) || headline.includes(q);
  });

  const handleStartConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initialMessage.trim()) {
      setError("Veuillez saisir un message pour démarrer la discussion.");
      return;
    }

    if (activeTab === "PROSPECT" && !selectedProspect) {
      setError("Veuillez sélectionner un prospect dans la liste.");
      return;
    }

    if (activeTab === "LINKEDIN_URL" && !linkedinUrl.trim()) {
      setError("Veuillez saisir l'URL du profil LinkedIn.");
      return;
    }

    setSending(true);
    setError(null);

    try {
      const payload: any = {
        text: initialMessage.trim(),
      };

      if (activeTab === "PROSPECT" && selectedProspect) {
        payload.prospectId = selectedProspect.id;
      } else {
        payload.linkedinUrl = linkedinUrl.trim();
      }

      const res = await apiRequest<{
        success: boolean;
        conversation: InboxConversation;
        error?: string;
      }>("/inbox/conversations/new", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.success && res.conversation) {
        onConversationCreated(res.conversation);
        onClose();
      } else {
        setError(res.error || "Impossible de démarrer la conversation sur LinkedIn.");
      }
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'envoi du message.");
    } finally {
      setSending(false);
    }
  };

  const insertVariable = (variable: string) => {
    let nameToUse = "Bonjour";
    if (selectedProspect) {
      if (variable === "{{firstName}}") nameToUse = selectedProspect.firstName;
      if (variable === "{{lastName}}") nameToUse = selectedProspect.lastName;
      if (variable === "{{company}}") nameToUse = selectedProspect.company || "votre entreprise";
    }
    setInitialMessage((prev) => prev + (prev.endsWith(" ") || prev === "" ? "" : " ") + nameToUse + " ");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Nouvelle conversation LinkedIn
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Démarrez une discussion directe synchronisée avec votre compte LinkedIn
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 pt-2 bg-slate-50/30 dark:bg-slate-900/30">
          <button
            onClick={() => {
              setActiveTab("PROSPECT");
              setError(null);
            }}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "PROSPECT"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <User className="w-4 h-4" />
            Depuis mes prospects Bime Link
          </button>
          <button
            onClick={() => {
              setActiveTab("LINKEDIN_URL");
              setError(null);
            }}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "LINKEDIN_URL"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <ExternalLink className="w-4 h-4" />
            URL profil LinkedIn direct
          </button>
        </div>

        <form onSubmit={handleStartConversation} className="p-6 flex-1 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 text-xs bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60 rounded-xl">
              {error}
            </div>
          )}

          {activeTab === "PROSPECT" ? (
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Sélectionner le destinataire
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher par nom, poste, entreprise..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                />
              </div>

              {/* Prospects list */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {loadingProspects ? (
                  <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                    Chargement des prospects...
                  </div>
                ) : filteredProspects.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    Aucun prospect trouvé.
                  </div>
                ) : (
                  filteredProspects.map((p) => {
                    const isSelected = selectedProspect?.id === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedProspect(p)}
                        className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-indigo-50/80 dark:bg-indigo-950/40"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={
                              p.avatarUrl ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                `${p.firstName} ${p.lastName}`
                              )}&background=592eff&color=fff`
                            }
                            alt=""
                            className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                              {p.firstName} {p.lastName}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {p.headline || p.company || "Contact LinkedIn"}
                            </p>
                          </div>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                URL du profil LinkedIn du contact
              </label>
              <input
                type="url"
                placeholder="https://www.linkedin.com/in/nom-du-profil"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
              />
              <p className="text-[11px] text-slate-400">
                Bime Link récupérera automatiquement la photo, le nom et le titre du profil pour synchroniser l'échange.
              </p>
            </div>
          )}

          {/* Message Area */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Premier message
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400">Variables :</span>
                <button
                  type="button"
                  onClick={() => insertVariable("{{firstName}}")}
                  className="px-1.5 py-0.5 text-[10px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 rounded font-medium hover:bg-indigo-100"
                >
                  Prénom
                </button>
                <button
                  type="button"
                  onClick={() => insertVariable("{{company}}")}
                  className="px-1.5 py-0.5 text-[10px] bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 rounded font-medium hover:bg-purple-100"
                >
                  Entreprise
                </button>
              </div>
            </div>

            <textarea
              rows={4}
              placeholder="Bonjour, je vous contacte pour échanger au sujet de..."
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white resize-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={sending}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl shadow-md shadow-indigo-500/25 flex items-center gap-2 disabled:opacity-50 transition-all"
            >
              {sending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Envoi sur LinkedIn...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Démarrer la discussion
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
