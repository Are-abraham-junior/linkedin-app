import React, { useState, useEffect } from "react";
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
      "Importez des prospects et ajoutez-les à des campagnes avec Claude, ChatGPT et d'autres modèles IA via le connecteur MCP Bime Link",
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
        body: { name: `Clé API Bime Link - ${new Date().toLocaleDateString("fr-FR")}` },
      });

      if (res.success && res.secretKey) {
        setGeneratedSecret(res.secretKey);
        await fetchKeys();
      }
    } catch (err: any) {
      alert("Erreur lors de la génération de la clé : " + err.message);
    } finally {
      setGeneratingKey(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir révoquer cette clé d'API ? Tout service l'utilisant cessera de fonctionner.")) {
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
      alert("Erreur lors de la révocation : " + err.message);
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
    if (!window.confirm(`Voulez-vous vraiment déconnecter ${activeModalApp.name} ?`)) return;

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
      alert("Erreur lors de la déconnexion : " + err.message);
    }
  };

  // Rendu de l'icône officielle
  const renderAppIcon = (provider: string) => {
    switch (provider) {
      case "HUBSPOT":
        return (
          <div className="w-12 h-12 rounded-2xl bg-[#ff7a59] flex items-center justify-center text-white shadow-xs shrink-0">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
              <path d="M17.44 7.7a3.48 3.48 0 0 0-1.85-3.08V3.03a1.53 1.53 0 1 0-1.28 0v1.59a3.5 3.5 0 0 0-1.83 3.08c0 1.25.65 2.35 1.63 2.97v4.6a3.5 3.5 0 0 0-1.63 2.98 3.5 3.5 0 1 0 3.5-3.5c-.37 0-.72.06-1.05.17v-4.25a3.48 3.48 0 0 0 2.51-3.47zm-2.85 10.45a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm-2.08-10.45a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zm7.9 3.04a2.95 2.95 0 1 0-2.95 2.95c.42 0 .82-.09 1.18-.25l2.42 2.42a1.05 1.05 0 0 0 1.48-1.48l-2.42-2.42c.18-.38.29-.8.29-1.22zm-2.95 1.05a1.05 1.05 0 1 1 0-2.1 1.05 1.05 0 0 1 0 2.1z" />
            </svg>
          </div>
        );
      case "PIPEDRIVE":
        return (
          <div className="w-12 h-12 rounded-2xl bg-[#00823a] flex items-center justify-center text-white shadow-xs shrink-0">
            <span className="text-2xl font-black font-sans leading-none pb-0.5">p</span>
          </div>
        );
      case "NOCRM":
        return (
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00bfa5] to-[#028090] flex items-center justify-center text-white shadow-xs shrink-0">
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
          <div className="w-12 h-12 rounded-2xl bg-[#2563eb] flex items-center justify-center text-white shadow-xs shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
        );
      case "BREVO":
        return (
          <div className="w-12 h-12 rounded-2xl bg-[#0b996e] flex items-center justify-center text-white shadow-xs shrink-0">
            <span className="text-xl font-black font-sans leading-none">B</span>
          </div>
        );
      case "GOOGLESHEETS":
        return (
          <div className="w-12 h-12 rounded-2xl bg-[#0f9d58] flex items-center justify-center text-white shadow-xs shrink-0">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
              <path d="M19 3H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H8V5h11v14z" />
              <path d="M10 7h7v2h-7zm0 3.5h7v2h-7zm0 3.5h7v2h-7z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-12 h-12 rounded-2xl bg-[#592eff]/10 text-[#592eff] flex items-center justify-center shrink-0">
            <Sliders className="w-6 h-6" />
          </div>
        );
    }
  };

  return (
    <div className="space-y-10 max-w-5xl">
      {/* ========================================== */}
      {/* 1. CLÉS D'API BIME LINK                    */}
      {/* ========================================== */}
      <div className="adora-card p-6 sm:p-7 bg-white rounded-3xl border border-[#e0e0db]/80 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#f0f0f4] pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#592eff]/10 flex items-center justify-center text-[#592eff]">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#21164c]">Clé API Bime Link</h3>
              <p className="text-xs text-[#5f5f69]">Connectez vos flux Make, Zapier, n8n ou requêtes personnalisées</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerateKey}
            disabled={generatingKey}
            className="px-4 py-2 bg-[#592eff] hover:bg-[#4922db] text-white font-bold text-xs rounded-xl shadow-md shadow-[#592eff]/25 hover:shadow-[#592eff]/40 active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {generatingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>Générer une nouvelle clé API</span>
          </button>
        </div>

        {/* Alerte modale avec clé générée en clair */}
        {generatedSecret && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs space-y-3 animate-in fade-in">
            <div className="flex items-center gap-2 font-bold text-amber-900">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Votre nouvelle clé secrète Bime Link a été générée</span>
            </div>
            <p className="text-amber-800">
              Copiez cette clé immédiatement. Par mesure de sécurité, elle ne vous sera plus jamais montrée en clair :
            </p>
            <div className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-amber-300 font-mono text-xs text-[#21164c]">
              <span className="flex-1 select-all break-all">{generatedSecret}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(generatedSecret)}
                className="px-3 py-1.5 bg-[#592eff] text-white rounded-lg text-xs font-bold hover:bg-[#4922db] transition-all flex items-center gap-1 shrink-0 cursor-pointer"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey ? "Copié !" : "Copier"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Liste des clés actives */}
        {loadingKeys ? (
          <div className="p-6 flex items-center justify-center gap-2 text-xs text-[#5f5f69]">
            <Loader2 className="w-4 h-4 animate-spin text-[#592eff]" />
            <span>Chargement des clés API...</span>
          </div>
        ) : keys.length === 0 ? (
          <p className="text-xs text-[#7c7c88] italic py-2">
            Aucune clé API active. Cliquez sur le bouton ci-dessus pour générer votre première clé.
          </p>
        ) : (
          <div className="space-y-3">
            {keys.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-[#f8f9fc] border border-[#e0e0db]/60 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <div>
                    <p className="font-bold text-[#21164c]">{k.name}</p>
                    <p className="font-mono text-[11px] text-[#7c7c88] mt-0.5">{k.prefix}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-[#7c7c88]">
                    Créée le {new Date(k.createdAt).toLocaleDateString("fr-FR")}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRevokeKey(k.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
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
        <div className="p-4 rounded-2xl bg-[#21164c] text-white text-xs font-mono space-y-2 overflow-x-auto">
          <div className="flex items-center gap-2 text-[#a594fd] text-[11px] font-sans font-bold">
            <Code className="w-3.5 h-3.5" />
            <span>Exemple d'utilisation de l'API Bime Link (cURL)</span>
          </div>
          <pre className="text-[11px] leading-relaxed text-gray-200">
{`curl -X GET "https://bimelink.croixance.net/api/prospects" \\
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
          <h3 className="text-lg font-bold text-[#21164c]">Applications & CRM Connectés</h3>
          <p className="text-xs text-[#5f5f69] mt-0.5">
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
                className="bg-white rounded-3xl p-6 border border-[#e0e0db]/80 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-[#2563eb]/40 transition-all min-h-[260px] relative group"
              >
                {/* Haut de la carte : Logo + Badge optionnel */}
                <div>
                  <div className="flex items-start justify-between">
                    {renderAppIcon(app.provider)}

                    {app.badge && (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#2563eb] text-white font-extrabold text-[10px] tracking-wide">
                        {app.badge}
                      </span>
                    )}

                    {isConnected && !app.badge && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        Connecté
                      </span>
                    )}
                  </div>

                  {/* Titre */}
                  <h4 className="text-base font-extrabold text-[#21164c] mt-4 mb-2">
                    {app.name}
                  </h4>

                  {/* Description */}
                  <p className="text-xs text-[#5f5f69] leading-relaxed line-clamp-3">
                    {app.description}
                  </p>
                </div>

                {/* Bas de la carte : Bouton d'action bleu ou connecté */}
                <div className="pt-5">
                  {app.isMcp ? (
                    <button
                      type="button"
                      onClick={() => setMcpModalOpen(true)}
                      className="w-full py-2.5 px-4 rounded-xl border border-[#2563eb] text-[#2563eb] hover:bg-[#2563eb]/5 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Comment se connecter ?</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenModal(app)}
                      className={`w-full py-2.5 px-4 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs ${
                        isConnected
                          ? "border-emerald-500 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-100/60"
                          : "border-[#2563eb] text-[#2563eb] hover:bg-[#2563eb]/5"
                      }`}
                    >
                      {isConnected ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="adora-card bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-[#e0e0db] relative animate-in zoom-in-95 space-y-5">
            <button
              type="button"
              onClick={() => setActiveModalApp(null)}
              className="absolute right-5 top-5 p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* En-tête de la modale */}
            <div className="flex items-center gap-3">
              {renderAppIcon(activeModalApp.provider)}
              <div>
                <h3 className="text-base font-extrabold text-[#21164c]">
                  Connecter {activeModalApp.name}
                </h3>
                <p className="text-xs text-[#5f5f69]">Configuration des accès et de la synchronisation</p>
              </div>
            </div>

            {modalMessage && (
              <div
                className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
                  modalMessage.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                {modalMessage.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{modalMessage.text}</span>
              </div>
            )}

            {/* Formulaire spécifique */}
            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-[#21164c]">
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
                  className="w-full px-3.5 py-2.5 bg-[#f8f9fc] border border-[#e0e0db] rounded-xl focus:outline-none focus:border-[#2563eb]"
                />
              </div>

              {activeModalApp.provider === "NOCRM" && (
                <div className="space-y-1.5">
                  <label className="font-bold text-[#21164c]">Sous-domaine de votre espace noCRM.io</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={modalFormSubdomain}
                      onChange={(e) => setModalFormSubdomain(e.target.value)}
                      placeholder="mon-entreprise"
                      className="w-full px-3.5 py-2.5 bg-[#f8f9fc] border border-[#e0e0db] rounded-xl focus:outline-none focus:border-[#2563eb]"
                    />
                    <span className="text-[#7c7c88] font-semibold text-xs whitespace-nowrap">.nocrm.io</span>
                  </div>
                </div>
              )}

              {activeModalApp.provider === "BREVO" && (
                <div className="space-y-1.5">
                  <label className="font-bold text-[#21164c]">ID de la Liste Brevo de destination (Optionnel)</label>
                  <input
                    type="text"
                    value={modalFormListId}
                    onChange={(e) => setModalFormListId(e.target.value)}
                    placeholder="Ex: 2"
                    className="w-full px-3.5 py-2.5 bg-[#f8f9fc] border border-[#e0e0db] rounded-xl focus:outline-none focus:border-[#2563eb]"
                  />
                </div>
              )}

              <label className="flex items-center gap-2 text-xs text-[#353241] cursor-pointer pt-1">
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
                  className="text-xs text-red-600 hover:text-red-700 font-bold cursor-pointer"
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
                  className="px-4 py-2 bg-[#f0f0f4] hover:bg-[#e4e4e9] text-[#21164c] font-bold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  {testingConnection ? "Test en cours..." : "Tester la connexion"}
                </button>
                <button
                  type="button"
                  onClick={handleSaveModal}
                  disabled={savingConnection || !modalFormToken}
                  className="px-5 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer disabled:opacity-50"
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="adora-card bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-[#e0e0db] relative animate-in zoom-in-95 space-y-5">
            <button
              type="button"
              onClick={() => setMcpModalOpen(false)}
              className="absolute right-5 top-5 p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#2563eb] flex items-center justify-center text-white shadow-xs">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#21164c]">Connecteur IA MCP (Model Context Protocol)</h3>
                <p className="text-xs text-[#5f5f69]">Contrôlez Bime Link depuis Claude Desktop, ChatGPT ou Cursor</p>
              </div>
            </div>

            <p className="text-xs text-[#5f5f69] leading-relaxed">
              Le protocole ouvert MCP vous permet de piloter vos campagnes, d'extraire des leads et d'envoyer des messages LinkedIn directement depuis vos modèles d'IA favoris (Claude 3.7 Sonnet, ChatGPT o3, Cursor).
            </p>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-[#21164c]">Configuration JSON pour Claude Desktop ou Cursor</span>
                <button
                  type="button"
                  onClick={() => {
                    const jsonConfig = JSON.stringify(
                      {
                        mcpServers: {
                          "bime-link": {
                            url: "https://bimelink.croixance.net/api/mcp",
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
                  className="px-3 py-1 bg-[#f0f0f4] hover:bg-[#e4e4e9] rounded-lg font-bold text-xs text-[#21164c] flex items-center gap-1 cursor-pointer"
                >
                  {copiedMcpConfig ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedMcpConfig ? "Copié !" : "Copier le JSON"}</span>
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-[#21164c] text-gray-200 font-mono text-xs overflow-x-auto">
                <pre>{`{
  "mcpServers": {
    "bime-link": {
      "url": "https://bimelink.croixance.net/api/mcp",
      "headers": {
        "Authorization": "Bearer bl_live_VOTRE_CLE_API_ICI"
      }
    }
  }
}`}</pre>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#f8f9fc] border border-[#e0e0db] text-xs text-[#5f5f69] space-y-1">
              <p className="font-bold text-[#21164c]">Étapes de mise en place :</p>
              <ol className="list-decimal pl-4 space-y-1 text-[11px]">
                <li>Générez une clé API Bime Link dans la section ci-dessus.</li>
                <li>Collez la clé dans le fichier de configuration de Claude Desktop (`claude_desktop_config.json`).</li>
                <li>Redémarrez Claude Desktop : vos outils Bime Link (import leads, listes, campagnes) seront prêts à l'emploi.</li>
              </ol>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setMcpModalOpen(false)}
                className="px-5 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
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
