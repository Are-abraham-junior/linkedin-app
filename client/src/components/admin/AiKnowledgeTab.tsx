import React, { useEffect, useState } from "react";
import { Plus, Loader2, BookOpen, Pencil, Trash2, X, RotateCcw, Star } from "lucide-react";
import { apiRequest } from "../../services/api";
import { ConfirmModal } from "../common/ConfirmModal";

type Category = "BLEADIN" | "PROSPECTION" | "REDACTION";

interface KnowledgeDoc {
  id: string;
  slug: string;
  title: string;
  category: Category;
  content: string;
  isCore: boolean;
  enabled: boolean;
  updatedAt: string;
}

interface FormState {
  id?: string;
  title: string;
  slug: string;
  category: Category;
  content: string;
  isCore: boolean;
  enabled: boolean;
}

const CATEGORY_LABELS: Record<Category, string> = { BLEADIN: "Application Bleadin", PROSPECTION: "Prospection LinkedIn", REDACTION: "Rédaction de messages" };
const inputCls = "w-full h-10 px-3 rounded-xl border border-line bg-white text-sm text-ink-2 focus:outline-none focus:border-ink";
const labelCls = "block text-xs font-medium text-muted mb-1.5";

export const AiKnowledgeTab: React.FC = () => {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [seedSlugs, setSeedSlugs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<KnowledgeDoc | null>(null);
  const [confirmReseed, setConfirmReseed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await apiRequest<{ docs: KnowledgeDoc[]; seedSlugs: string[] }>("/admin/ai-knowledge");
    if (res.success) {
      setDocs(res.docs || []);
      setSeedSlugs(res.seedSlugs || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setForm({ title: "", slug: "", category: "PROSPECTION", content: "", isCore: false, enabled: true });
    setError(null);
  };
  const openEdit = (d: KnowledgeDoc) => {
    setForm({ id: d.id, title: d.title, slug: d.slug, category: d.category, content: d.content, isCore: d.isCore, enabled: d.enabled });
    setError(null);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    const body = { title: form.title, slug: form.slug || undefined, category: form.category, content: form.content, isCore: form.isCore, enabled: form.enabled };
    const res = form.id ? await apiRequest(`/admin/ai-knowledge/${form.id}`, { method: "PUT", body }) : await apiRequest("/admin/ai-knowledge", { method: "POST", body });
    setSaving(false);
    if (!res.success) {
      setError(res.error || "Enregistrement impossible.");
      return;
    }
    setForm(null);
    load();
  };

  const toggle = async (d: KnowledgeDoc, patch: Partial<Pick<KnowledgeDoc, "enabled" | "isCore">>) => {
    setBusy(true);
    await apiRequest(`/admin/ai-knowledge/${d.id}`, { method: "PUT", body: { title: d.title, category: d.category, content: d.content, isCore: d.isCore, enabled: d.enabled, ...patch } });
    setBusy(false);
    load();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setBusy(true);
    await apiRequest(`/admin/ai-knowledge/${toDelete.id}`, { method: "DELETE" });
    setBusy(false);
    setToDelete(null);
    load();
  };

  const reseed = async () => {
    setBusy(true);
    await apiRequest("/admin/ai-knowledge/reseed", { method: "POST" });
    setBusy(false);
    setConfirmReseed(false);
    load();
  };

  const grouped = (Object.keys(CATEGORY_LABELS) as Category[]).map((cat) => ({ cat, items: docs.filter((d) => d.category === cat) }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Base de connaissances</h2>
          <p className="text-[12px] text-muted mt-0.5 max-w-xl">
            Documents Markdown que Bleadin IA consulte pour répondre sans inventer. Les documents « cœur » sont toujours transmis au modèle ; les autres sont recherchés par mots-clés selon la question. Les modifications sont prises en compte immédiatement.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setConfirmReseed(true)} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-line text-[12px] font-semibold text-ink-2 hover:bg-surface-2">
            <RotateCcw className="w-3.5 h-3.5" /> Restaurer les documents d'origine
          </button>
          <button type="button" onClick={openCreate} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-accent text-white text-[12px] font-semibold hover:bg-accent-hover">
            <Plus className="w-4 h-4" /> Nouveau document
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 text-ink animate-spin" />
        </div>
      ) : (
        grouped.map(({ cat, items }) => (
          <section key={cat} className="space-y-2">
            <h3 className="text-xs font-semibold text-muted/80">{CATEGORY_LABELS[cat]}</h3>
            {items.length === 0 ? (
              <p className="text-[12px] text-muted italic">Aucun document.</p>
            ) : (
              <div className="rounded-2xl bg-white border border-line divide-y divide-line/70">
                {items.map((d) => (
                  <div key={d.id} className={`flex items-center gap-3 px-4 py-3 ${d.enabled ? "" : "opacity-60"}`}>
                    <div className="w-9 h-9 rounded-2xl bg-[#bcf2ff] flex items-center justify-center shrink-0">
                      <BookOpen className="w-4 h-4 text-ink" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-ink truncate">{d.title}</p>
                        {d.isCore && <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-[#dfff9d] text-ink"><Star className="w-3 h-3" /> Cœur</span>}
                        {seedSlugs.includes(d.slug) && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-surface-2 text-muted border border-line">Origine</span>}
                      </div>
                      <p className="text-xs text-muted truncate">
                        {d.slug} · {d.content.length.toLocaleString("fr-FR")} caractères · modifié le {new Date(d.updatedAt).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted cursor-pointer">
                      <input type="checkbox" checked={d.enabled} disabled={busy} onChange={(e) => toggle(d, { enabled: e.target.checked })} className="accent-[#592eff]" />
                      Actif
                    </label>
                    <button type="button" onClick={() => openEdit(d)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:bg-surface-2 hover:text-ink" title="Modifier">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => setToDelete(d)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:bg-surface-2 hover:text-danger" title="Supprimer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))
      )}

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={() => !saving && setForm(null)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl rounded-[32px] bg-white border border-line p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-ink">{form.id ? "Modifier le document" : "Nouveau document"}</h3>
              <button type="button" onClick={() => setForm(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:bg-surface-2">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
              <div>
                <label className={labelCls}>Titre</label>
                <input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={150} />
              </div>
              <div>
                <label className={labelCls}>Catégorie</label>
                <select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Category })}>
                  {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {!form.id && (
              <div>
                <label className={labelCls}>Slug (optionnel)</label>
                <input className={inputCls} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="généré depuis le titre" pattern="[a-z0-9-]+" />
              </div>
            )}
            <div>
              <label className={labelCls}>Contenu (Markdown)</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={18}
                required
                className="w-full rounded-xl border border-line bg-white px-3 py-2 text-[12px] font-mono text-ink-2 focus:outline-none focus:border-ink resize-y"
              />
              <p className="mt-1 text-xs text-muted">Structurez avec des titres <code>##</code> : chaque section devient un passage indexé séparément.</p>
            </div>
            <div className="flex flex-wrap gap-5">
              <label className="inline-flex items-center gap-2 text-[12px] font-semibold text-ink-2 cursor-pointer">
                <input type="checkbox" checked={form.isCore} onChange={(e) => setForm({ ...form, isCore: e.target.checked })} className="accent-[#592eff]" />
                Document cœur (toujours transmis au modèle — à réserver aux essentiels)
              </label>
              <label className="inline-flex items-center gap-2 text-[12px] font-semibold text-ink-2 cursor-pointer">
                <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} className="accent-[#592eff]" />
                Actif
              </label>
            </div>
            {error && <p className="text-[12px] text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setForm(null)} className="h-9 px-4 rounded-xl border border-line text-[12px] font-semibold text-ink-2 hover:bg-surface-2">
                Annuler
              </button>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-accent text-white text-[12px] font-semibold hover:bg-accent-hover disabled:opacity-60">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal isOpen={Boolean(toDelete)} onClose={() => setToDelete(null)} onConfirm={confirmDelete} title="Supprimer ce document ?" description={toDelete ? `« ${toDelete.title} » ne sera plus consulté par Bleadin IA.` : ""} variant="danger" confirmText="Supprimer" isLoading={busy} />
      <ConfirmModal
        isOpen={confirmReseed}
        onClose={() => setConfirmReseed(false)}
        onConfirm={reseed}
        title="Restaurer les documents d'origine ?"
        description="Les documents fournis avec Bleadin (application, prospection, rédaction) seront réécrits avec leur contenu d'origine. Vos modifications sur ces documents seront perdues ; les documents que vous avez ajoutés sont conservés."
        variant="warning"
        confirmText="Restaurer"
        isLoading={busy}
      />
    </div>
  );
};
