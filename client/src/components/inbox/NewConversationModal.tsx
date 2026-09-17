import React, { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
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
import { initialsDataUrl } from "../ui/avatarFallback";
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
    <Modal open={isOpen} onClose={onClose} size="md" title="Nouvelle conversation" description="Discussion directe, synchronisée avec votre compte LinkedIn." bodyClassName="px-6 pb-6">
      <div className="flex flex-col">
        {/* Tab Selection */}
        <div className="flex border-b border-line">
          <button
            onClick={() => {
              setActiveTab("PROSPECT");
              setError(null);
            }}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "PROSPECT"
                ? "border-accent text-ink"
                : "border-transparent text-muted hover:text-ink-2"
            }`}
          >
            <User className="w-4 h-4" />
            Depuis mes prospects Bleadin
          </button>
          <button
            onClick={() => {
              setActiveTab("LINKEDIN_URL");
              setError(null);
            }}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "LINKEDIN_URL"
                ? "border-accent text-ink"
                : "border-transparent text-muted hover:text-ink-2"
            }`}
          >
            <ExternalLink className="w-4 h-4" />
            URL profil LinkedIn direct
          </button>
        </div>

        <form onSubmit={handleStartConversation} className="space-y-4 pt-5">
          {error && (
            <div className="p-3 text-xs bg-danger-soft text-danger border border-danger-line rounded-xl">
              {error}
            </div>
          )}

          {activeTab === "PROSPECT" ? (
            <div className="space-y-3">
              <label className="text-xs font-semibold text-ink-2">
                Sélectionner le destinataire
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-muted-2 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher par nom, poste, entreprise..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm bg-canvas border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/20 text-ink"
                />
              </div>

              {/* Prospects list */}
              <div className="border border-line rounded-xl max-h-48 overflow-y-auto divide-y divide-line">
                {loadingProspects ? (
                  <div className="py-8 text-center text-xs text-muted-2 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-accent" />
                    Chargement des prospects...
                  </div>
                ) : filteredProspects.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-2">
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
                            ? "bg-accent-soft"
                            : "hover:bg-canvas"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={
                              p.avatarUrl ||
                              initialsDataUrl(`${p.firstName} ${p.lastName}`)
                            }
                            alt=""
                            className="w-8 h-8 rounded-full object-cover shrink-0 border border-line"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-ink truncate">
                              {p.firstName} {p.lastName}
                            </p>
                            <p className="text-xs text-muted truncate">
                              {p.headline || p.company || "Contact LinkedIn"}
                            </p>
                          </div>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-ink-2">
                URL du profil LinkedIn du contact
              </label>
              <input
                type="url"
                placeholder="https://www.linkedin.com/in/nom-du-profil"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-canvas border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/20 text-ink"
              />
              <p className="text-xs text-muted-2">
                Bleadin récupérera automatiquement la photo, le nom et le titre du profil pour synchroniser l'échange.
              </p>
            </div>
          )}

          {/* Message Area */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-ink-2">
                Premier message
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-2">Variables :</span>
                <button
                  type="button"
                  onClick={() => insertVariable("{{firstName}}")}
                  className="px-1.5 py-0.5 text-xs bg-accent-soft text-accent rounded font-medium hover:bg-accent-soft"
                >
                  Prénom
                </button>
                <button
                  type="button"
                  onClick={() => insertVariable("{{company}}")}
                  className="px-1.5 py-0.5 text-xs bg-purple-50 text-purple-600 rounded font-medium hover:bg-purple-100"
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
              className="w-full p-3 text-sm bg-canvas border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/20 text-ink resize-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-ink-2 hover:bg-surface-2 rounded-xl transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={sending}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-accent hover:bg-accent-hover rounded-xl flex items-center gap-2 disabled:opacity-50 transition-all"
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
    </Modal>
  );
};
