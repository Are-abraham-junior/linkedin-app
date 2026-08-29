import React, { useState } from "react";
import { apiRequest } from "../../services/api";
import {
  X,
  User,
  Building,
  MapPin,
  Mail,
  Phone,
  Tag,
  ExternalLink,
  Save,
  CheckCircle2,
  Send,
  Sparkles,
} from "lucide-react";
import { extractCompanyFromHeadline } from "../../utils/companyExtractor";

interface ProspectDetailDrawerProps {
  prospect: any;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export const ProspectDetailDrawer: React.FC<ProspectDetailDrawerProps> = ({
  prospect,
  isOpen,
  onClose,
  onUpdate,
}) => {
  if (!isOpen || !prospect) return null;

  const [formData, setFormData] = useState({
    firstName: prospect.firstName || "",
    lastName: prospect.lastName || "",
    headline: prospect.headline || "",
    company: (prospect.company && prospect.company !== "—" ? prospect.company : "") || extractCompanyFromHeadline(prospect.headline) || "",
    location: prospect.location || "",
    email: prospect.email || "",
    phone: prospect.phone || "",
    connectionStatus: prospect.connectionStatus || "NOT_CONNECTED",
    doNotContact: prospect.doNotContact || false,
    tags: prospect.tags || [],
  });

  const [newTag, setNewTag] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, newTag.trim()],
      });
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((t: string) => t !== tagToRemove),
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      const res = await apiRequest(`/prospects/${prospect.id}`, {
        method: "PUT",
        body: JSON.stringify(formData),
      });

      if (res.success) {
        setMsg("Prospect mis à jour !");
        onUpdate();
      }
    } catch (err: any) {
      setMsg("Erreur : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#21164c]/30 backdrop-blur-sm z-50 flex justify-end animate-in fade-in">
      <div className="w-full max-w-lg bg-white h-full shadow-2xl p-6 sm:p-8 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-[#e0e0db]">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5f5f69]">
              Fiche Prospect CRM
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-[#f5f5f7] text-[#5f5f69]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Profile overview card */}
          <div className="flex items-center gap-4 my-5 p-4 rounded-2xl bg-[#f8f9fc] border border-[#e0e0db]">
            <img
              src={
                prospect.avatarUrl ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  prospect.firstName + " " + prospect.lastName
                )}&background=592eff&color=fff`
              }
              alt={prospect.firstName}
              className="w-14 h-14 rounded-full object-cover border-2 border-[#592eff]"
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-[#21164c]">
                  {formData.firstName} {formData.lastName}
                </h3>
                {prospect.linkedinUrl && (
                  <a
                    href={prospect.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#592eff] hover:text-[#4d25e0]"
                    title="Voir le profil LinkedIn"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
              <p className="text-xs text-[#5f5f69] line-clamp-1">{formData.headline || "Sans titre"}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="badge-tag bg-[#592eff]/10 text-[#592eff] text-[10px]">
                  📁 {prospect.list?.name || "Liste"}
                </span>
                <span
                  className={`badge-tag text-[10px] ${
                    formData.connectionStatus === "CONNECTED"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-[#f5f5f7] text-[#5f5f69] border border-[#e0e0db]"
                  }`}
                >
                  {formData.connectionStatus === "CONNECTED"
                    ? "Connecté"
                    : formData.connectionStatus === "PENDING"
                    ? "En attente"
                    : "Non connecté"}
                </span>
              </div>
            </div>
          </div>

          {msg && (
            <div className="mb-4 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
              {msg}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSave} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-[#21164c] uppercase mb-1">
                  Prénom
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#e0e0db] focus:outline-none focus:border-[#592eff]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#21164c] uppercase mb-1">
                  Nom
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#e0e0db] focus:outline-none focus:border-[#592eff]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#21164c] uppercase mb-1">
                Titre / Poste
              </label>
              <input
                type="text"
                value={formData.headline}
                onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-[#e0e0db] focus:outline-none focus:border-[#592eff]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-[#21164c] uppercase mb-1">
                  Entreprise
                </label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#e0e0db] focus:outline-none focus:border-[#592eff]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#21164c] uppercase mb-1">
                  Localisation
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#e0e0db] focus:outline-none focus:border-[#592eff]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-[#21164c] uppercase mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  placeholder="contact@entreprise.com"
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#e0e0db] focus:outline-none focus:border-[#592eff]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#21164c] uppercase mb-1">
                  Téléphone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  placeholder="+225 07..."
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#e0e0db] focus:outline-none focus:border-[#592eff]"
                />
              </div>
            </div>

            {/* Tags section */}
            <div>
              <label className="block text-[10px] font-bold text-[#21164c] uppercase mb-1.5">
                Tags & Segments
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {formData.tags.map((t: string) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 bg-[#592eff]/10 text-[#592eff] px-2 py-0.5 rounded-full font-semibold text-[11px]"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      className="hover:text-red-500"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ajouter un tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  className="flex-1 px-3 py-1.5 rounded-xl border border-[#e0e0db] text-xs focus:outline-none focus:border-[#592eff]"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-3 py-1.5 rounded-xl bg-[#f5f5f7] hover:bg-[#e0e0db] text-[#353241] font-bold text-xs"
                >
                  Ajouter
                </button>
              </div>
            </div>

            {/* Do not contact checkbox */}
            <label className="flex items-center gap-2 pt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.doNotContact}
                onChange={(e) => setFormData({ ...formData, doNotContact: e.target.checked })}
                className="w-4 h-4 text-[#592eff] rounded focus:ring-0"
              />
              <span className="text-xs font-semibold text-[#21164c]">
                Ne pas contacter (Blacklist / Exclure des campagnes)
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-[#592eff] hover:bg-[#4d25e0] text-white font-bold text-xs shadow-md shadow-[#592eff]/25 flex items-center justify-center gap-2 transition-all mt-4 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" /> {loading ? "Enregistrement..." : "Enregistrer les modifications"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
