import React, { useEffect, useRef, useState } from "react";
import { Building2, ImagePlus, Trash2, Loader2, Check, AlertCircle, ShieldCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";
import { WorkspaceAvatar } from "../common/WorkspaceAvatar";
import { resizeImageToDataUrl, ACCEPTED_IMAGE_TYPES } from "../../utils/image";

interface WorkspaceInfo {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
  canEdit: boolean;
}

/** Bloc « Espace de travail » affiché dans l'onglet Mon Compte (photo de profil de l'organisation). */
export const WorkspaceSettingsSection: React.FC = () => {
  const { refreshUser, impersonatedOrg, setImpersonatedOrg } = useAuth();
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    apiRequest<{ workspace: WorkspaceInfo | null }>("/settings/workspace").then((res) => {
      if (cancelled) return;
      if (res.success) setWorkspace(res.workspace ?? null);
      else setMsg({ type: "error", text: res.error || "Impossible de charger l'espace de travail." });
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [impersonatedOrg?.id]);

  const save = async (avatarUrl: string | null) => {
    setSaving(true);
    setMsg(null);
    const res = await apiRequest<{ workspace: WorkspaceInfo }>("/settings/workspace", {
      method: "PUT",
      body: JSON.stringify({ avatarUrl }),
    });
    if (res.success && res.workspace) {
      setWorkspace(res.workspace);
      setMsg({ type: "success", text: avatarUrl ? "Photo de l'espace mise à jour." : "Photo de l'espace supprimée." });
      // Propager immédiatement au sélecteur d'espace et aux autres emplacements
      await refreshUser();
      if (impersonatedOrg) setImpersonatedOrg({ ...impersonatedOrg, avatarUrl });
    } else {
      setMsg({ type: "error", text: res.error || "Enregistrement impossible." });
    }
    setSaving(false);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.test(file.type)) {
      setMsg({ type: "error", text: "Format non supporté : utilisez une image PNG, JPEG ou WebP." });
      return;
    }
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      await save(dataUrl);
    } catch {
      setMsg({ type: "error", text: "Impossible de lire cette image." });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  // Compte sans organisation : rien à afficher
  if (!loading && !workspace) return null;

  return (
    <div className="adora-card p-6 sm:p-7 bg-white rounded-3xl border border-[#e0e0db]/80 shadow-xs space-y-6">
      <div className="flex items-center gap-3 border-b border-[#f0f0f4] pb-4">
        <div className="w-9 h-9 rounded-2xl bg-[#592eff]/10 flex items-center justify-center text-[#592eff]">
          <Building2 className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-[#21164c]">Espace de travail</h3>
          <p className="text-[11px] text-[#5f5f69]">
            Photo de profil de votre espace, affichée à côté de son nom dans toute l'application.
          </p>
        </div>
      </div>

      {loading || !workspace ? (
        <div className="flex items-center gap-2 text-xs text-[#5f5f69] py-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
        </div>
      ) : (
        <>

        {msg && (
          <div
            className={`flex items-center gap-2 p-3 rounded-xl text-xs font-semibold ${
              msg.type === "success"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {msg.type === "success" ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {msg.text}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <WorkspaceAvatar
            name={workspace.name}
            avatarUrl={workspace.avatarUrl}
            className="w-24 h-24 rounded-3xl"
            textClassName="text-3xl"
          />
          <div className="space-y-3 flex-1 min-w-0">
            <div>
              <label className="block text-[11px] font-bold text-[#21164c] uppercase tracking-wider mb-1">
                Nom de l'espace
              </label>
              <p className="text-base font-extrabold text-[#21164c] truncate">{workspace.name}</p>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#21164c] uppercase tracking-wider mb-1.5">
                Photo de profil (optionnel)
              </label>
              {workspace.canEdit ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files?.[0])}
                  />
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={saving}
                    className="py-2.5 px-5 rounded-xl bg-[#592eff] hover:bg-[#4d25e0] text-white text-xs font-bold shadow-md shadow-[#592eff]/25 flex items-center gap-2 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                    {workspace.avatarUrl ? "Changer la photo" : "Télécharger une photo"}
                  </button>
                  {workspace.avatarUrl && (
                    <button
                      type="button"
                      onClick={() => save(null)}
                      disabled={saving}
                      className="py-2.5 px-4 rounded-xl bg-white hover:bg-red-50 border border-[#e0e0db] hover:border-red-200 text-[#5f5f69] hover:text-red-600 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      Supprimer
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[#9a9aa5] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Seul un propriétaire ou administrateur de l'espace peut modifier la photo.
                </p>
              )}
              <p className="text-[11px] text-[#9a9aa5] mt-2">
                PNG, JPEG ou WebP. L'image est recadrée en carré et redimensionnée en 256×256 avant l'enregistrement.
              </p>
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
};
