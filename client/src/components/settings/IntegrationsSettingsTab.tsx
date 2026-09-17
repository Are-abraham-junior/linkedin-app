import React, { useState, useEffect } from "react";
import { useToast } from "../ui/Toast";
import { useConfirm } from "../ui/ConfirmProvider";
import { apiRequest } from "../../services/api";
import {
  KeyRound,
  Copy,
  Check,
  Trash2,
  Code,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ArrowLeftRight,
  Loader2,
  X,
  Sliders,
  ShieldCheck,
} from "lucide-react";

interface ApiKeyRecord {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface IntegrationApp {
  id: string;
  name: string;
  provider: "HUBSPOT" | "PIPEDRIVE" | "NOCRM" | "BREVO" | "GOOGLESHEETS" | "MCP";
  description: string;
  badge?: string;
  isMcp?: boolean;
}

const INTEGRATION_APPS: IntegrationApp[] = [
  {
    id: "hubspot",
    name: "Hubspot",
    provider: "HUBSPOT",
    description: "Envoyez les données que vous souhaitez de vos prospects directement sur votre compte Hubspot !",
  },
  {
    id: "pipedrive",
    name: "Pipedrive",
    provider: "PIPEDRIVE",
    description: "Envoyez les données que vous souhaitez de vos prospects directement sur votre compte Pipedrive !",
  },
  {
    id: "nocrm",
    name: "noCRM.io",
    provider: "NOCRM",
    description: "Envoyez les données que vous souhaitez de vos prospects directement sur votre compte noCRM.io !",
  },
  {
    id: "mcp",
    name: "Connecteur IA (MCP)",
    provider: "MCP",
    description:
      "Importez des prospects et ajoutez-les à des campagnes avec Claude, ChatGPT et d'autres modèles IA via le connecteur MCP Bleadin",
    badge: "Nouveau",
    isMcp: true,
  },
  {
    id: "brevo",
    name: "Brevo",
    provider: "BREVO",
    description: "Envoyez les données que vous souhaitez de vos prospects directement sur votre compte Brevo !",
  },
  {
    id: "googlesheets",
    name: "Google Sheet",
    provider: "GOOGLESHEETS",
    description: "Ajoutez automatiquement chaque prospect qualifié ou réponse dans votre feuille de calcul Google Sheets !",
  },
];

export const IntegrationsSettingsTab: React.FC = () => {
  const toast = useToast();
  const confirm = useConfirm();
  // Clés API State
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [generatingKey, setGeneratingKey] = useState(false);

  // Configurations existantes enregistrées en base
  const [configs, setConfigs] = useState<Record<string, any>>({});
  const [loadingConfigs, setLoadingConfigs] = useState(true);

  // Modale de connexion d'une application
  const [activeModalApp, setActiveModalApp] = useState<IntegrationApp | null>(null);
  const [modalFormToken, setModalFormToken] = useState("");
  const [modalFormSubdomain, setModalFormSubdomain] = useState("");
  const [modalFormListId, setModalFormListId] = useState("");
  const [modalFormAutoSync, setModalFormAutoSync] = useState(true);

  // État de test et sauvegarde dans la modale
  const [testingConnection, setTestingConnection] = useState(false);
  const [savingConnection, setSavingConnection] = useState(false);
  const [modalMessage, setModalMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modale MCP Instructions
  const [mcpModalOpen, setMcpModalOpen] = useState(false);
  const [copiedMcpConfig, setCopiedMcpConfig] = useState(false);

  const fetchKeys = async () => {
    setLoadingKeys(true);
    try {
      const res = await apiRequest<{ success: boolean; keys: ApiKeyRecord[] }>("/settings/api-keys");
      if (res.success) {
        setKeys(res.keys || []);
      }
    } catch (err: any) {
      console.warn("Notice loading API keys:", err.message);
    } finally {
      setLoadingKeys(false);
    }
  };

  const fetchIntegrations = async () => {
    setLoadingConfigs(true);
    try {
      const res = await apiRequest<{ success: boolean; integrations: any[] }>("/settings/integrations");
      if (res.success && Array.isArray(res.integrations)) {
        const mapped: Record<string, any> = {};
        res.integrations.forEach((item) => {
          mapped[item.provider] = item;
        });
        setConfigs(mapped);
      }
    } catch (err: any) {
      console.warn("Notice loading integrations:", err.message);
    } finally {
      setLoadingConfigs(false);
    }
  };

  useEffect(() => {
    fetchKeys();
    fetchIntegrations();
  }, []);

  const handleGenerateKey = async () => {
    setGeneratingKey(true);
    try {
      const res = await apiRequest<{
        success: boolean;
        secretKey: string;
        apiKey: ApiKeyRecord;
      }>("/settings/api-keys", {
        method: "POST",
        body: { name: `Clé API Bleadin - ${new Date().toLocaleDateString("fr-FR")}` },
      });

      if (res.success && res.secretKey) {
        setGeneratedSecret(res.secretKey);
        await fetchKeys();
      }
    } catch (err: any) {
      toast.error("Erreur lors de la génération de la clé", { description: err.message });
    } finally {
      setGeneratingKey(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!(await confirm({ title: "Révoquer cette clé d'API ?", description: "Tout service qui l'utilise cessera de fonctionner.", confirmText: "Révoquer" }))) {
      return;
    }

    try {
      const res = await apiRequest<{ success: boolean }>(`/settings/api-keys/${id}`, {
        method: "DELETE",
      });
      if (res.success) {
        await fetchKeys();
      }
    } catch (err: any) {
      toast.error("Erreur lors de la révocation", { description: err.message });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  // Ouverture de la modale de configuration
  const handleOpenModal = (app: IntegrationApp) => {
    setActiveModalApp(app);
    setModalMessage(null);
    const existing = configs[app.provider];
    if (existing && existing.config) {
      setModalFormToken(existing.config.token || existing.config.apiKey || existing.config.webhookUrl || "");
      setModalFormSubdomain(existing.config.subdomain || "");
      setModalFormListId(existing.config.listId || "");
      setModalFormAutoSync(existing.config.autoSync !== false);
    } else {
      setModalFormToken("");
      setModalFormSubdomain("");
      setModalFormListId("");
      setModalFormAutoSync(true);
    }
  };

  // Test de connexion dans la modale
  const handleTestModal = async () => {
    if (!activeModalApp) return;
    setTestingConnection(true);
    setModalMessage(null);

    const payloadConfig: any = {};
    if (activeModalApp.provider === "HUBSPOT" || activeModalApp.provider === "PIPEDRIVE") {
      payloadConfig.token = modalFormToken.trim();
    } else if (activeModalApp.provider === "BREVO" || activeModalApp.provider === "NOCRM") {
      payloadConfig.apiKey = modalFormToken.trim();
      payloadConfig.subdomain = modalFormSubdomain.trim();
    } else if (activeModalApp.provider === "GOOGLESHEETS") {
      payloadConfig.webhookUrl = modalFormToken.trim();
    }

    try {
      const res = await apiRequest<{ success: boolean; message?: string; error?: string }>(
        "/settings/integrations/test",
        {
          method: "POST",
          body: {
            provider: activeModalApp.provider,
            config: payloadConfig,
          },
        }
      );

      if (res.success) {
        setModalMessage({ type: "success", text: res.message || "Connexion validée avec succès !" });
      } else {
        setModalMessage({ type: "error", text: res.error || "Échec de la validation de la connexion." });
      }
    } catch (err: any) {
      setModalMessage({ type: "error", text: err.message || "Erreur de communication." });
    } finally {
      setTestingConnection(false);
    }
  };

  // Sauvegarde dans la modale
  const handleSaveModal = async () => {
    if (!activeModalApp) return;
    setSavingConnection(true);
    setModalMessage(null);

    const payloadConfig: any = {
      autoSync: modalFormAutoSync,
    };
    if (activeModalApp.provider === "HUBSPOT" || activeModalApp.provider === "PIPEDRIVE") {
      payloadConfig.token = modalFormToken.trim();
    } else if (activeModalApp.provider === "BREVO") {
      payloadConfig.apiKey = modalFormToken.trim();
      payloadConfig.listId = modalFormListId.trim();
    } else if (activeModalApp.provider === "NOCRM") {
      payloadConfig.apiKey = modalFormToken.trim();
      payloadConfig.subdomain = modalFormSubdomain.trim();
    } else if (activeModalApp.provider === "GOOGLESHEETS") {
      payloadConfig.webhookUrl = modalFormToken.trim();
    }

    try {
      const res = await apiRequest<{ success: boolean; message?: string; error?: string }>(
        "/settings/integrations",
        {
          method: "POST",
          body: {
            provider: activeModalApp.provider,
            config: payloadConfig,
          },
        }
      );

      if (res.success) {
        setModalMessage({ type: "success", text: "Configuration enregistrée et connectée !" });
        await fetchIntegrations();
        setTimeout(() => {
          setActiveModalApp(null);
        }, 1200);
      } else {
        setModalMessage({ type: "error", text: res.error || "Erreur lors de l'enregistrement." });
      }
    } catch (err: any) {
      setModalMessage({ type: "error", text: err.message || "Erreur réseau." });
    } finally {
      setSavingConnection(false);
    }
  };

  // Déconnexion
  const handleDisconnectModal = async () => {
    if (!activeModalApp) return;
    if (!(await confirm({ title: `Déconnecter ${activeModalApp.name} ?`, confirmText: "Déconnecter" }))) return;

    try {
      await apiRequest("/settings/integrations", {
        method: "POST",
        body: {
          provider: activeModalApp.provider,
          config: {},
        },
      });
      await fetchIntegrations();
      setActiveModalApp(null);
    } catch (err: any) {
      toast.error("Erreur lors de la déconnexion", { description: err.message });
    }
  };

  // Rendu de l'icône officielle
  const renderAppIcon = (provider: string) => {
    switch (provider) {
      case "HUBSPOT":
        return (
          <div className="w-12 h-12 rounded-2xl bg-[#ff7a59] flex items-center justify-center text-white shrink-0">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
              <path d="M17.44 7.7a3.48 3.48 0 0 0-1.85-3.08V3.03a1.53 1.53 0 1 0-1.28 0v1.59a3.5 3.5 0 0 0-1.83 3.08c0 1.25.65 2.35 1.63 2.97v4.6a3.5 3.5 0 0 0-1.63 2.98 3.5 3.5 0 1 0 3.5-3.5c-.37 0-.72.06-1.05.17v-4.25a3.48 3.48 0 0 0 2.51-3.47zm-2.85 10.45a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm-2.08-10.45a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zm7.9 3.04a2.95 2.95 0 1 0-2.95 2.95c.42 0 .82-.09 1.18-.25l2.42 2.42a1.05 1.05 0 0 0 1.48-1.48l-2.42-2.42c.18-.38.29-.8.29-1.22zm-2.95 1.05a1.05 1.05 0 1 1 0-2.1 1.05 1.05 0 0 1 0 2.1z" />
            </svg>
          </div>
        );
      case "PIPEDRIVE":
        return (
          <div className="w-12 h-12 rounded-2xl bg-[#00823a] flex items-center justify-center text-white shrink-0">
            <span className="text-2xl font-semibold font-sans leading-none pb-0.5">p</span>
          </div>
        );
      case "NOCRM":
        return (
          <div className="w-12 h-12 rounded-2xl bg-ink flex items-center justify-center text-white shrink-0">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
              <rect x="3" y="10" width="3" height="10" rx="1.5" />
              <rect x="8" y="6" width="3" height="14" rx="1.5" />
              <rect x="13" y="2" width="3" height="18" rx="1.5" />
              <rect x="18" y="8" width="3" height="12" rx="1.5" />
            </svg>
          </div>
        );
      case "MCP":
        return (
          <div className="w-12 h-12 rounded-2xl bg-[#2563eb] flex items-center justify-center text-white shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
        );
      case "BREVO":
        return (
          <div className="w-12 h-12 rounded-2xl bg-[#0b996e] flex items-center justify-center text-white shrink-0">
            <span className="text-xl font-semibold font-sans leading-none">B</span>
          </div>
        );
      case "GOOGLESHEETS":
        return (
          <div className="w-12 h-12 rounded-2xl bg-[#0f9d58] flex items-center justify-center text-white shrink-0">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
              <path d="M19 3H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H8V5h11v14z" />
              <path d="M10 7h7v2h-7zm0 3.5h7v2h-7zm0 3.5h7v2h-7z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-12 h-12 rounded-2xl bg-surface-2 text-ink flex items-center justify-center shrink-0">
            <Sliders className="w-6 h-6" />
          </div>
        );
    }
  };

  return (
    <div className="space-y-10 max-w-5xl">
      {/* ========================================== */}
      {/* 1. CLÉS D'API BLEADIN                      */}
      {/* ========================================== */}
      <div className="rounded-2xl border border-line bg-surface p-6 sm:p-7 bg-white rounded-2xl border border-line/80 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#f0f0f4] pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-surface-2 flex items-center justify-center text-ink">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-medium text-ink">Clé API Bleadin</h3>
              <p className="text-xs text-muted">Connectez vos flux Make, Zapier, n8n ou requêtes personnalisées</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerateKey}
            disabled={generatingKey}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white font-medium text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {generatingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>Générer une nouvelle clé API</span>
          </button>
        </div>

        {/* Alerte modale avec clé générée en clair */}
        {generatedSecret && (
          <div className="p-4 rounded-2xl bg-surface-2 border border-line text-xs space-y-3">
            <div className="flex items-center gap-2 font-medium text-amber-900">
              <Sparkles className="w-4 h-4 text-warn" />
              <span>Votre nouvelle clé secrète Bleadin a été générée</span>
            </div>
            <p className="text-warn">
              Copiez cette clé immédiatement. Par mesure de sécurité, elle ne vous sera plus jamais montrée en clair :
            </p>
            <div className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-line font-mono text-xs text-ink">
              <span className="flex-1 select-all break-all">{generatedSecret}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(generatedSecret)}
                className="px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent-hover transition-all flex items-center gap-1 shrink-0 cursor-pointer"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey ? "Copié !" : "Copier"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Liste des clés actives */}
        {loadingKeys ? (
          <div className="p-6 flex items-center justify-center gap-2 text-xs text-muted">
            <Loader2 className="w-4 h-4 animate-spin text-ink" />
            <span>Chargement des clés API...</span>
          </div>
        ) : keys.length === 0 ? (
          <p className="text-xs text-muted-2 italic py-2">
            Aucune clé API active. Cliquez sur le bouton ci-dessus pour générer votre première clé.
          </p>
        ) : (
          <div className="space-y-3">
            {keys.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-2 border border-line/60 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-ok"></span>
                  <div>
                    <p className="font-medium text-ink">{k.name}</p>
                    <p className="font-mono text-xs text-muted-2 mt-0.5">{k.prefix}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-2">
                    Créée le {new Date(k.createdAt).toLocaleDateString("fr-FR")}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRevokeKey(k.id)}
                    className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-surface-2 transition-colors cursor-pointer"
                    title="Révoquer cette clé"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Exemple cURL */}
        <div className="p-4 rounded-2xl bg-ink text-white text-xs font-mono space-y-2 overflow-x-auto">
          <div className="flex items-center gap-2 text-[#a594fd] text-xs font-sans font-medium">
            <Code className="w-3.5 h-3.5" />
            <span>Exemple d'utilisation de l'API Bleadin (cURL)</span>
          </div>
          <pre className="text-xs leading-relaxed text-gray-200">
{`curl -X GET "https://api.bleadin.com/api/prospects" \\
  -H "Authorization: Bearer bl_live_votre_cle_secrete" \\
  -H "Content-Type: application/json"`}
          </pre>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. APPLICATIONS & CRM CONNECTÉS (STYLE CONFORME IMAGE)   */}
      {/* ========================================================= */}
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-ink">Applications & CRM Connectés</h3>
          <p className="text-xs text-muted mt-0.5">
            Connectez vos plateformes préférées pour synchroniser vos prospects et automatiser vos flux
          </p>
        </div>

        {/* GRILLE DE CARTES CONFORME À LA CAPTURE FOURNIE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {INTEGRATION_APPS.map((app) => {
            const isConnected =
              !app.isMcp &&
              configs[app.provider] &&
              configs[app.provider].status === "CONNECTED";

            return (
              <div
                key={app.id}
                className="bg-white rounded-2xl p-6 border border-line/80 flex flex-col justify-between hover:border-[#2563eb]/40 transition-all min-h-[260px] relative group"
              >
                {/* Haut de la carte : Logo + Badge optionnel */}
                <div>
                  <div className="flex items-start justify-between">
                    {renderAppIcon(app.provider)}

                    {app.badge && (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#2563eb] text-white font-semibold text-xs">
                        {app.badge}
                      </span>
                    )}

                    {isConnected && !app.badge && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-2 text-ok font-medium text-xs border border-line">
                        <CheckCircle2 className="w-3 h-3" />
                        Connecté
                      </span>
                    )}
                  </div>

                  {/* Titre */}
                  <h4 className="text-base font-semibold text-ink mt-4 mb-2">
                    {app.name}
                  </h4>

                  {/* Description */}
                  <p className="text-xs text-muted leading-relaxed line-clamp-3">
                    {app.description}
                  </p>
                </div>

                {/* Bas de la carte : Bouton d'action bleu ou connecté */}
                <div className="pt-5">
                  {app.isMcp ? (
                    <button
                      type="button"
                      onClick={() => setMcpModalOpen(true)}
                      className="w-full py-2.5 px-4 rounded-xl border border-[#2563eb] text-[#2563eb] hover:bg-[#2563eb]/5 font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Comment se connecter ?</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenModal(app)}
                      className={`w-full py-2.5 px-4 rounded-xl border font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        isConnected
                          ? "border-emerald-500 bg-surface-2 text-ok hover:bg-surface-2"
                          : "border-[#2563eb] text-[#2563eb] hover:bg-[#2563eb]/5"
                      }`}
                    >
                      {isConnected ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-ok" />
                          <span>Gérer la connexion</span>
                        </>
                      ) : (
                        <>
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                          <span>Connecter l'application</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODALE DE CONFIGURATION DE CONNEXION                      */}
      {/* ========================================================= */}
      {activeModalApp && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50">
          <div className="rounded-2xl border border-line bg-surface bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 border border-line relative space-y-5">
            <button
              type="button"
              onClick={() => setActiveModalApp(null)}
              className="absolute right-5 top-5 p-1.5 rounded-full hover:bg-surface-2 text-muted hover:text-muted transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* En-tête de la modale */}
            <div className="flex items-center gap-3">
              {renderAppIcon(activeModalApp.provider)}
              <div>
                <h3 className="text-base font-semibold text-ink">
                  Connecter {activeModalApp.name}
                </h3>
                <p className="text-xs text-muted">Configuration des accès et de la synchronisation</p>
              </div>
            </div>

            {modalMessage && (
              <div
                className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
                  modalMessage.type === "success"
                    ? "bg-surface-2 text-ok border border-line"
                    : "bg-surface-2 text-danger border border-line"
                }`}
              >
                {modalMessage.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-ok shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-danger shrink-0" />
                )}
                <span>{modalMessage.text}</span>
              </div>
            )}

            {/* Formulaire spécifique */}
            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-medium text-ink">
                  {activeModalApp.provider === "HUBSPOT" && "Token d'application privée HubSpot (Private App Token)"}
                  {activeModalApp.provider === "PIPEDRIVE" && "Jeton d'API personnel Pipedrive (API Token)"}
                  {activeModalApp.provider === "NOCRM" && "Clé API noCRM.io"}
                  {activeModalApp.provider === "BREVO" && "Clé API v3 Brevo (xkeysib-...)"}
                  {activeModalApp.provider === "GOOGLESHEETS" && "URL Webhook Google Sheets / Make / Zapier"}
                </label>
                <input
                  type={activeModalApp.provider === "GOOGLESHEETS" ? "url" : "password"}
                  value={modalFormToken}
                  onChange={(e) => setModalFormToken(e.target.value)}
                  placeholder={
                    activeModalApp.provider === "HUBSPOT"
                      ? "pat-na1-..."
                      : activeModalApp.provider === "PIPEDRIVE"
                      ? "Jeton à récupérer dans Pipedrive > Paramètres > API"
                      : activeModalApp.provider === "NOCRM"
                      ? "Clé API à générer dans noCRM.io"
                      : activeModalApp.provider === "BREVO"
                      ? "xkeysib-..."
                      : "https://hook.eu1.make.com/... ou script.google.com/..."
                  }
                  className="w-full px-3.5 py-2.5 bg-surface-2 border border-line rounded-xl focus:outline-none focus:border-[#2563eb]"
                />
              </div>

              {activeModalApp.provider === "NOCRM" && (
                <div className="space-y-1.5">
                  <label className="font-medium text-ink">Sous-domaine de votre espace noCRM.io</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={modalFormSubdomain}
                      onChange={(e) => setModalFormSubdomain(e.target.value)}
                      placeholder="mon-entreprise"
                      className="w-full px-3.5 py-2.5 bg-surface-2 border border-line rounded-xl focus:outline-none focus:border-[#2563eb]"
                    />
                    <span className="text-muted-2 font-semibold text-xs whitespace-nowrap">.nocrm.io</span>
                  </div>
                </div>
              )}

              {activeModalApp.provider === "BREVO" && (
                <div className="space-y-1.5">
                  <label className="font-medium text-ink">ID de la Liste Brevo de destination (Optionnel)</label>
                  <input
                    type="text"
                    value={modalFormListId}
                    onChange={(e) => setModalFormListId(e.target.value)}
                    placeholder="Ex: 2"
                    className="w-full px-3.5 py-2.5 bg-surface-2 border border-line rounded-xl focus:outline-none focus:border-[#2563eb]"
                  />
                </div>
              )}

              <label className="flex items-center gap-2 text-xs text-ink-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={modalFormAutoSync}
                  onChange={(e) => setModalFormAutoSync(e.target.checked)}
                  className="w-4 h-4 accent-[#2563eb] rounded-md cursor-pointer"
                />
                <span>Synchroniser automatiquement chaque nouveau prospect qualifié</span>
              </label>
            </div>

            {/* Actions de la modale */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#f0f0f4]">
              {configs[activeModalApp.provider]?.status === "CONNECTED" ? (
                <button
                  type="button"
                  onClick={handleDisconnectModal}
                  className="text-xs text-danger hover:text-danger font-medium cursor-pointer"
                >
                  Déconnecter cette application
                </button>
              ) : (
                <div></div>
              )}

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleTestModal}
                  disabled={testingConnection || !modalFormToken}
                  className="px-4 py-2 bg-[#f0f0f4] hover:bg-[#e4e4e9] text-ink font-medium text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  {testingConnection ? "Test en cours..." : "Tester la connexion"}
                </button>
                <button
                  type="button"
                  onClick={handleSaveModal}
                  disabled={savingConnection || !modalFormToken}
                  className="px-5 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  {savingConnection ? "Enregistrement..." : "Connecter"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODALE MCP INSTRUCTIONS ("Comment se connecter ?")        */}
      {/* ========================================================= */}
      {mcpModalOpen && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50">
          <div className="rounded-2xl border border-line bg-surface bg-white rounded-2xl max-w-xl w-full p-6 sm:p-7 border border-line relative space-y-5">
            <button
              type="button"
              onClick={() => setMcpModalOpen(false)}
              className="absolute right-5 top-5 p-1.5 rounded-full hover:bg-surface-2 text-muted hover:text-muted transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#2563eb] flex items-center justify-center text-white">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-ink">Connecteur IA MCP (Model Context Protocol)</h3>
                <p className="text-xs text-muted">Contrôlez Bleadin depuis Claude Desktop, ChatGPT ou Cursor</p>
              </div>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Le protocole ouvert MCP vous permet de piloter vos campagnes, d'extraire des leads et d'envoyer des messages LinkedIn directement depuis vos modèles d'IA favoris (Claude 3.7 Sonnet, ChatGPT o3, Cursor).
            </p>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-ink">Configuration JSON pour Claude Desktop ou Cursor</span>
                <button
                  type="button"
                  onClick={() => {
                    const jsonConfig = JSON.stringify(
                      {
                        mcpServers: {
                          "bleadin": {
                            url: "https://api.bleadin.com/api/mcp",
                            headers: {
                              Authorization: "Bearer bl_live_VOTRE_CLE_API_ICI",
                            },
                          },
                        },
                      },
                      null,
                      2
                    );
                    navigator.clipboard.writeText(jsonConfig);
                    setCopiedMcpConfig(true);
                    setTimeout(() => setCopiedMcpConfig(false), 2500);
                  }}
                  className="px-3 py-1 bg-[#f0f0f4] hover:bg-[#e4e4e9] rounded-lg font-medium text-xs text-ink flex items-center gap-1 cursor-pointer"
                >
                  {copiedMcpConfig ? <Check className="w-3.5 h-3.5 text-ok" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedMcpConfig ? "Copié !" : "Copier le JSON"}</span>
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-ink text-gray-200 font-mono text-xs overflow-x-auto">
                <pre>{`{
  "mcpServers": {
    "bleadin": {
      "url": "https://api.bleadin.com/api/mcp",
      "headers": {
        "Authorization": "Bearer bl_live_VOTRE_CLE_API_ICI"
      }
    }
  }
}`}</pre>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-surface-2 border border-line text-xs text-muted space-y-1">
              <p className="font-medium text-ink">Étapes de mise en place :</p>
              <ol className="list-decimal pl-4 space-y-1 text-xs">
                <li>Générez une clé API Bleadin dans la section ci-dessus.</li>
                <li>Collez la clé dans le fichier de configuration de Claude Desktop (`claude_desktop_config.json`).</li>
                <li>Redémarrez Claude Desktop : vos outils Bleadin (import leads, listes, campagnes) seront prêts à l'emploi.</li>
              </ol>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setMcpModalOpen(false)}
                className="px-5 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium text-xs rounded-xl transition-colors cursor-pointer"
              >
                Compris
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
