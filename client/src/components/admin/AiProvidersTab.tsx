import React, { useEffect, useState } from "react";
import { Plus, Loader2, Zap, CheckCircle2, AlertTriangle, Trash2, Pencil, X, Cpu, KeyRound, Link2, Gauge, Power, PowerOff } from "lucide-react";
import { apiRequest } from "../../services/api";
import { ConfirmModal } from "../common/ConfirmModal";

interface AiProvider {
  id: string;
  name: string;
  kind: "OLLAMA" | "OPENAI_COMPATIBLE";
  baseUrl: string;
  apiKeyMasked: string | null;
  hasApiKey: boolean;
  model: string;
  temperature: number;
  numCtx: number;
  thinking: boolean;
  isActive: boolean;
  status: "UNTESTED" | "OK" | "ERROR";
  lastTestedAt: string | null;
  lastLatencyMs: number | null;
  lastError: string | null;
}

interface TestResult {
  ok: boolean;
  latencyMs: number;
  models: string[];
  modelAvailable: boolean | null;
  error?: string;
}

interface FormState {
  id?: string;
  name: string;
  kind: "OLLAMA" | "OPENAI_COMPATIBLE";
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: string;
  numCtx: string;
  thinking: boolean;
}

const EMPTY_FORM: FormState = { name: "Ollama", kind: "OLLAMA", baseUrl: "", apiKey: "", model: "llama3.1:8b", temperature: "0.2", numCtx: "16384", thinking: false };

const inputCls = "w-full h-10 px-3 rounded-xl border border-line bg-white text-sm text-ink-2 focus:outline-none focus:border-ink";
const labelCls = "block text-xs font-medium text-muted mb-1.5";

const StatusBadge: React.FC<{ status: AiProvider["status"] }> = ({ status }) => {
  if (status === "OK") return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-surface-2 text-ok border border-line"><CheckCircle2 className="w-3 h-3" /> OK</span>;
  if (status === "ERROR") return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-surface-2 text-danger border border-line"><AlertTriangle className="w-3 h-3" /> Erreur</span>;
  return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-surface-2 text-muted border border-line">Non testé</span>;
};

export const AiProvidersTab: React.FC = () => {
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<AiProvider | null>(null);
  const [rowResults, setRowResults] = useState<Record<string, TestResult>>({});

  const load = async () => {
    setLoading(true);
    const res = await apiRequest<{ providers: AiProvider[] }>("/admin/ai-providers");
    if (res.success) setProviders(res.providers || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setTestResult(null);
    setError(null);
  };

  const openEdit = (p: AiProvider) => {
    setForm({ id: p.id, name: p.name, kind: p.kind, baseUrl: p.baseUrl, apiKey: "", model: p.model, temperature: String(p.temperature), numCtx: String(p.numCtx ?? 16384), thinking: Boolean(p.thinking) });
    setTestResult(null);
    setError(null);
  };

  const payload = (f: FormState) => ({ id: f.id, name: f.name, kind: f.kind, baseUrl: f.baseUrl, apiKey: f.apiKey || undefined, model: f.model, temperature: parseFloat(f.temperature) || 0.2, numCtx: parseInt(f.numCtx, 10) || 16384, thinking: f.thinking });

  const testForm = async () => {
    if (!form) return;
    setTesting(true);
    setError(null);
    setTestResult(null);
    const res = await apiRequest<{ result: TestResult }>("/admin/ai-providers/test", { method: "POST", body: payload(form) });
    setTesting(false);
    if (!res.success) {
      setError(res.error || "Test impossible.");
      return;
    }
    setTestResult(res.result);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    const res = form.id
      ? await apiRequest(`/admin/ai-providers/${form.id}`, { method: "PUT", body: payload(form) })
      : await apiRequest("/admin/ai-providers", { method: "POST", body: payload(form) });
    setSaving(false);
    if (!res.success) {
      setError(res.error || "Enregistrement impossible.");
      return;
    }
    setForm(null);
    load();
  };

  const testRow = async (p: AiProvider) => {
    setBusyId(p.id);
    const res = await apiRequest<{ result: TestResult; provider: AiProvider }>(`/admin/ai-providers/${p.id}/test`, { method: "POST" });
    setBusyId(null);
    if (res.success) {
      setRowResults((prev) => ({ ...prev, [p.id]: res.result }));
      if (res.provider) setProviders((prev) => prev.map((x) => (x.id === p.id ? res.provider : x)));
    }
  };

  const activate = async (p: AiProvider) => {
    setBusyId(p.id);
    const res = await apiRequest(`/admin/ai-providers/${p.id}/activate`, { method: "POST" });
    setBusyId(null);
    if (res.success) load();
  };

  const deactivate = async (p: AiProvider) => {
    setBusyId(p.id);
    const res = await apiRequest(`/admin/ai-providers/${p.id}/deactivate`, { method: "POST" });
    setBusyId(null);
    if (res.success) load();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setBusyId(toDelete.id);
    await apiRequest(`/admin/ai-providers/${toDelete.id}`, { method: "DELETE" });
    setBusyId(null);
    setToDelete(null);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Providers IA</h2>
          <p className="text-[12px] text-muted mt-0.5 max-w-xl">
            Modèles de langage utilisés par Bleadin IA. Un seul provider est actif à la fois. Ollama (API native) ou tout serveur compatible OpenAI (<code className="px-1 rounded bg-surface-2">/v1/chat/completions</code>). Le modèle doit supporter l'appel d'outils.
          </p>
        </div>
        <button type="button" onClick={openCreate} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-accent text-white text-[12px] font-semibold hover:bg-accent-hover">
          <Plus className="w-4 h-4" /> Ajouter un provider
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 text-ink animate-spin" />
        </div>
      ) : providers.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-ink bg-surface-2 p-10 text-center">
          <Cpu className="w-8 h-8 mx-auto text-ink" />
          <p className="mt-3 text-sm font-semibold text-ink">Aucun provider configuré</p>
          <p className="text-[12px] text-muted">Bleadin IA reste désactivé pour tous les utilisateurs tant qu'aucun provider n'est actif.</p>
        </div>
      ) : (
        <>
        {!providers.some((p) => p.isActive) && (
          <div className="mb-3 flex items-center gap-3 rounded-2xl border border-[#ffaae6] bg-[#ffaae6]/20 px-4 py-3">
            <PowerOff className="w-4 h-4 text-ink shrink-0" />
            <p className="text-[12px] text-ink">
              <span className="font-semibold">Bleadin IA est désactivé</span> : aucun provider n'est actif. Les utilisateurs voient un message d'indisponibilité. Cliquez sur « Activer » pour le remettre en service.
            </p>
          </div>
        )}
        <div className="grid gap-3 lg:grid-cols-2">
          {providers.map((p) => {
            const rr = rowResults[p.id];
            return (
              <div key={p.id} className={`rounded-2xl bg-white border p-5 ${p.isActive ? "border-ink" : "border-line"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-[15px] font-semibold text-ink truncate">{p.name}</h3>
                      {p.isActive && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-accent text-white">Actif</span>}
                      <StatusBadge status={p.status} />
                    </div>
                    <p className="text-xs text-muted mt-1">{p.kind === "OLLAMA" ? "Ollama" : "Compatible OpenAI"}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => openEdit(p)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:bg-surface-2 hover:text-ink" title="Modifier">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => setToDelete(p)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:bg-surface-2 hover:text-danger" title="Supprimer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <dl className="mt-4 space-y-1.5 text-[12px]">
                  <div className="flex items-center gap-2 min-w-0"><Link2 className="w-3.5 h-3.5 text-muted shrink-0" /><dd className="truncate text-ink-2">{p.baseUrl}</dd></div>
                  <div className="flex items-center gap-2"><Cpu className="w-3.5 h-3.5 text-muted shrink-0" /><dd className="text-ink-2 font-semibold">{p.model}</dd><span className="text-muted">· température {p.temperature} · contexte {p.numCtx ? `${Math.round(p.numCtx / 1024)}k` : "16k"}{p.thinking ? " · réflexion" : ""}</span></div>
                  <div className="flex items-center gap-2"><KeyRound className="w-3.5 h-3.5 text-muted shrink-0" /><dd className="text-ink-2">{p.hasApiKey ? p.apiKeyMasked : <span className="italic text-muted">sans clé</span>}</dd></div>
                  <div className="flex items-center gap-2"><Gauge className="w-3.5 h-3.5 text-muted shrink-0" /><dd className="text-ink-2">{p.lastTestedAt ? `Testé le ${new Date(p.lastTestedAt).toLocaleString("fr-FR")}${p.lastLatencyMs ? ` · ${p.lastLatencyMs} ms` : ""}` : "Jamais testé"}</dd></div>
                </dl>
                {p.lastError && <p className="mt-2 text-xs text-danger break-words">{p.lastError}</p>}
                {rr && rr.ok && (
                  <p className="mt-2 text-xs text-ok">
                    Réponse en {rr.latencyMs} ms{rr.models.length ? ` · ${rr.models.length} modèle(s) disponible(s)` : ""}
                    {rr.modelAvailable === false ? ` · attention : « ${p.model} » absent du serveur` : ""}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => testRow(p)} disabled={busyId === p.id} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-line text-[12px] font-semibold text-ink-2 hover:bg-surface-2 disabled:opacity-60">
                    {busyId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    Tester la connexion
                  </button>
                  {p.isActive ? (
                    <button
                      type="button"
                      onClick={() => deactivate(p)}
                      disabled={busyId === p.id}
                      title="Bleadin IA sera indisponible pour tous les utilisateurs jusqu'à la réactivation d'un provider"
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-line text-[12px] font-semibold text-ink-2 hover:bg-surface-2 disabled:opacity-60"
                    >
                      <PowerOff className="w-3.5 h-3.5" />
                      Désactiver
                    </button>
                  ) : (
                    <button type="button" onClick={() => activate(p)} disabled={busyId === p.id} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-ink text-white text-[12px] font-semibold disabled:opacity-60">
                      <Power className="w-3.5 h-3.5" />
                      Activer
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={() => !saving && setForm(null)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-[32px] bg-white border border-line p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-ink">{form.id ? "Modifier le provider" : "Nouveau provider IA"}</h3>
              <button type="button" onClick={() => setForm(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:bg-surface-2">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Nom</label>
                <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={80} />
              </div>
              <div>
                <label className={labelCls}>Type</label>
                <select className={inputCls} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as FormState["kind"] })}>
                  <option value="OLLAMA">Ollama (API native)</option>
                  <option value="OPENAI_COMPATIBLE">Compatible OpenAI</option>
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>URL de l'endpoint</label>
              <input className={inputCls} type="url" placeholder="https://mon-serveur.example.com" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} required />
              <p className="mt-1 text-xs text-muted">Sans le chemin : Bleadin ajoute <code>/api/chat</code> ou <code>/v1/chat/completions</code>.</p>
            </div>
            <div>
              <label className={labelCls}>Clé API {form.id && <span className="normal-case font-normal">(laisser vide pour conserver la clé actuelle)</span>}</label>
              <input className={inputCls} type="password" autoComplete="off" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder={form.id ? "••••••••" : "Optionnel"} />
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
              <div>
                <label className={labelCls}>Modèle</label>
                <input className={inputCls} list="ai-models" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required />
                {testResult?.models?.length ? (
                  <datalist id="ai-models">
                    {testResult.models.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                ) : null}
              </div>
              <div>
                <label className={labelCls}>Température</label>
                <input className={inputCls} type="number" step="0.1" min="0" max="2" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Fenêtre de contexte (tokens)</label>
                <select className={inputCls} value={form.numCtx} onChange={(e) => setForm({ ...form, numCtx: e.target.value })}>
                  {["8192", "16384", "32768", "65536"].map((v) => (
                    <option key={v} value={v}>
                      {Math.round(parseInt(v, 10) / 1024)}k{v === "16384" ? " (recommandé)" : v === "8192" ? " (trop court pour l'agent)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end pb-1">
                <label className="inline-flex items-center gap-2 text-[12px] text-ink-2 cursor-pointer">
                  <input type="checkbox" checked={form.thinking} onChange={(e) => setForm({ ...form, thinking: e.target.checked })} className="accent-[#592eff]" />
                  Mode réflexion (qwen3, deepseek-r1…) — plus lent, déconseillé
                </label>
              </div>
            </div>

            {testResult && (
              <div className={`rounded-2xl border p-3 text-[12px] ${testResult.ok ? "bg-surface-2 border-line text-ok" : "bg-surface-2 border-line text-danger"}`}>
                {testResult.ok ? (
                  <>
                    <p className="font-semibold">Connexion réussie en {testResult.latencyMs} ms.</p>
                    {testResult.models.length > 0 && (
                      <p className="mt-1">
                        Modèles disponibles : {testResult.models.join(", ")}
                        {testResult.modelAvailable === false && <span className="block mt-1 font-semibold text-warn">« {form.model} » n'est pas dans la liste : vérifiez le nom.</span>}
                      </p>
                    )}
                  </>
                ) : (
                  <p>{testResult.error || "Échec du test."}</p>
                )}
              </div>
            )}
            {error && <p className="text-[12px] text-danger">{error}</p>}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button type="button" onClick={testForm} disabled={testing || !form.baseUrl || !form.model} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl border border-line text-[12px] font-semibold text-ink-2 hover:bg-surface-2 disabled:opacity-60">
                {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                Tester
              </button>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-accent text-white text-[12px] font-semibold hover:bg-accent-hover disabled:opacity-60">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {form.id ? "Enregistrer" : "Créer"}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Supprimer ce provider ?"
        description={toDelete ? `« ${toDelete.name} » sera supprimé.${toDelete.isActive ? " Bleadin IA sera désactivé jusqu'à l'activation d'un autre provider." : ""}` : ""}
        variant="danger"
        confirmText="Supprimer"
        isLoading={busyId === toDelete?.id}
      />
    </div>
  );
};
