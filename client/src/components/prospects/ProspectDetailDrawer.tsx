import React, { useState } from "react";
import { apiRequest } from "../../services/api";
import { ExternalLink, Save, Trash2, X } from "lucide-react";
import { extractCompanyFromHeadline } from "../../utils/companyExtractor";
import { Avatar } from "../ui/Avatar";
import { Badge, StatusDot } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Callout } from "../ui/Callout";
import { Checkbox, Field, Input, labelClass } from "../ui/Field";
import { IconButton } from "../ui/IconButton";
import { Modal } from "../ui/Modal";

interface ProspectDetailDrawerProps {
  prospect: any;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  onDelete?: (prospect: any) => void;
}

/** Fiche prospect en panneau latéral : identité, coordonnées, tags, exclusion. */
export const ProspectDetailDrawer: React.FC<ProspectDetailDrawerProps> = ({ prospect, isOpen, onClose, onUpdate, onDelete }) => (
  <Modal
    open={isOpen && Boolean(prospect)}
    onClose={onClose}
    side="right"
    hideClose
    bodyClassName="px-6 pb-6"
    title={
      prospect && (
        <span className="flex items-center gap-3">
          <Avatar name={`${prospect.firstName || ""} ${prospect.lastName || ""}`} src={prospect.avatarUrl} size="lg" />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="truncate">
                {prospect.firstName} {prospect.lastName}
              </span>
              {prospect.linkedinUrl && (
                <a href={prospect.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-ink" title="Voir le profil LinkedIn">
                  <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
                </a>
              )}
            </span>
            <span className="mt-0.5 block truncate text-sm font-normal text-muted">{prospect.headline || "Sans titre"}</span>
          </span>
        </span>
      )
    }
    headerActions={
      <>
        {onDelete && prospect && <IconButton label="Supprimer ce prospect" icon={Trash2} tone="danger" onClick={() => onDelete(prospect)} />}
        <IconButton label="Fermer" icon={X} onClick={onClose} />
      </>
    }
  >
    {prospect && <DrawerBody key={prospect.id} prospect={prospect} onUpdate={onUpdate} />}
  </Modal>
);

const DrawerBody: React.FC<{ prospect: any; onUpdate: () => void }> = ({ prospect, onUpdate }) => {
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
  const [msg, setMsg] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);

  const set = (patch: Partial<typeof formData>) => setFormData((f) => ({ ...f, ...patch }));

  const handleAddTag = () => {
    const t = newTag.trim();
    if (t && !formData.tags.includes(t)) set({ tags: [...formData.tags, t] });
    setNewTag("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const res = await apiRequest(`/prospects/${prospect.id}`, { method: "PUT", body: JSON.stringify(formData) });
      if (res.success) {
        setMsg({ tone: "ok", text: "Prospect mis à jour." });
        onUpdate();
      }
    } catch (err: any) {
      setMsg({ tone: "danger", text: err.message || "Erreur inattendue." });
    } finally {
      setLoading(false);
    }
  };

  const status = formData.connectionStatus;

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-4">
        <Badge>{prospect.list?.name || "Sans liste"}</Badge>
        <StatusDot tone={status === "CONNECTED" ? "ok" : status === "PENDING" ? "warn" : "neutral"} className="text-xs">
          {status === "CONNECTED" ? "Connecté" : status === "PENDING" ? "Invitation en attente" : "Non connecté"}
        </StatusDot>
      </div>

      {msg && <Callout tone={msg.tone}>{msg.text}</Callout>}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Prénom">
          <Input value={formData.firstName} onChange={(e) => set({ firstName: e.target.value })} />
        </Field>
        <Field label="Nom">
          <Input value={formData.lastName} onChange={(e) => set({ lastName: e.target.value })} />
        </Field>
      </div>
      <Field label="Poste">
        <Input value={formData.headline} onChange={(e) => set({ headline: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Entreprise">
          <Input value={formData.company} onChange={(e) => set({ company: e.target.value })} />
        </Field>
        <Field label="Localisation">
          <Input value={formData.location} onChange={(e) => set({ location: e.target.value })} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="E-mail">
          <Input type="email" value={formData.email} placeholder="contact@entreprise.com" onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <Field label="Téléphone">
          <Input type="tel" value={formData.phone} placeholder="+225 07…" onChange={(e) => set({ phone: e.target.value })} />
        </Field>
      </div>

      <div>
        <p className={labelClass}>Tags</p>
        {formData.tags.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {formData.tags.map((t: string) => (
              <Badge key={t} className="pr-1">
                {t}
                <button type="button" onClick={() => set({ tags: formData.tags.filter((x: string) => x !== t) })} className="ml-0.5 rounded px-0.5 hover:text-danger" aria-label={`Retirer ${t}`}>
                  ×
                </button>
              </Badge>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            size="sm"
            placeholder="Ajouter un tag…"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddTag();
              }
            }}
          />
          <Button type="button" variant="secondary" size="sm" onClick={handleAddTag}>
            Ajouter
          </Button>
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line p-3">
        <Checkbox checked={formData.doNotContact} onChange={(e) => set({ doNotContact: e.target.checked })} className="mt-0.5" />
        <span>
          <span className="block text-sm font-medium text-ink">Ne pas contacter</span>
          <span className="block text-xs text-muted">Exclu de toutes les campagnes et de tout envoi.</span>
        </span>
      </label>

      <div className="flex justify-end border-t border-line pt-4">
        <Button type="submit" icon={Save} loading={loading}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
};
