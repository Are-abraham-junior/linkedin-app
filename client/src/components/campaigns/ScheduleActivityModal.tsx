import React, { useState, useEffect } from "react";
import { Save } from "lucide-react";
import { Button } from "../ui/Button";
import { Callout } from "../ui/Callout";
import { Field, Input, Select, labelClass } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { apiRequest } from "../../services/api";

interface ScheduleSettings {
  workingDays: string[];
  workingHoursStart: string;
  workingHoursEnd: string;
  timezone: string;
}

interface ScheduleActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const ALL_DAYS = [
  { key: "MON", label: "Lundi", short: "Lun" },
  { key: "TUE", label: "Mardi", short: "Mar" },
  { key: "WED", label: "Mercredi", short: "Mer" },
  { key: "THU", label: "Jeudi", short: "Jeu" },
  { key: "FRI", label: "Vendredi", short: "Ven" },
  { key: "SAT", label: "Samedi", short: "Sam" },
  { key: "SUN", label: "Dimanche", short: "Dim" },
];

export const ScheduleActivityModal: React.FC<ScheduleActivityModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [workingDays, setWorkingDays] = useState<string[]>([
    "MON",
    "TUE",
    "WED",
    "THU",
    "FRI",
  ]);
  const [workingHoursStart, setWorkingHoursStart] = useState("08:00");
  const [workingHoursEnd, setWorkingHoursEnd] = useState("19:00");
  const [timezone, setTimezone] = useState("Africa/Abidjan");

  useEffect(() => {
    if (!isOpen) return;

    const fetchSchedule = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await apiRequest<{ schedule: ScheduleSettings }>("/queue/schedule");
        if (res.success && res.schedule) {
          setWorkingDays(res.schedule.workingDays || ["MON", "TUE", "WED", "THU", "FRI"]);
          setWorkingHoursStart(res.schedule.workingHoursStart || "08:00");
          setWorkingHoursEnd(res.schedule.workingHoursEnd || "19:00");
          setTimezone(res.schedule.timezone || "Africa/Abidjan");
        }
      } catch (err: any) {
        console.error("Erreur récupération planning:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [isOpen]);


  const toggleDay = (dayKey: string) => {
    if (workingDays.includes(dayKey)) {
      if (workingDays.length === 1) return; // Garder au moins 1 jour
      setWorkingDays(workingDays.filter((d) => d !== dayKey));
    } else {
      setWorkingDays([...workingDays, dayKey]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await apiRequest("/queue/schedule", {
        method: "PUT",
        body: JSON.stringify({
          workingDays,
          workingHoursStart,
          workingHoursEnd,
          timezone,
        }),
      });

      if (res.success) {
        setSuccessMsg("Planning enregistré avec succès !");
        if (onSaved) onSaved();
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        setErrorMsg(res.error || "Une erreur est survenue.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur réseau.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Planifier l'activité"
      description="Jours et horaires pendant lesquels Bleadin exécute vos actions."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleSave} loading={saving} disabled={loading} icon={Save}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-6 pb-2">
        {errorMsg && <Callout tone="danger">{errorMsg}</Callout>}
        {successMsg && <Callout tone="ok">{successMsg}</Callout>}

        <div>
          <p className={labelClass}>Jours d'activité</p>
          <p className="mb-3 text-xs text-muted">Aucune action n'est exécutée les jours désactivés.</p>
          <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Jours d'activité">
            {ALL_DAYS.map((d) => {
              const isSelected = workingDays.includes(d.key);
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => toggleDay(d.key)}
                  aria-pressed={isSelected}
                  title={d.label}
                  className={`h-9 rounded-lg border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    isSelected ? "border-ink bg-ink text-white" : "border-line-2 bg-surface text-muted hover:border-ink hover:text-ink"
                  }`}
                >
                  {d.short}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className={labelClass}>Plage horaire d'envoi</p>
            <p className="text-xs text-muted">Les actions partent uniquement dans cette fenêtre.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Début">
              <Input type="time" value={workingHoursStart} onChange={(e) => setWorkingHoursStart(e.target.value)} />
            </Field>
            <Field label="Fin">
              <Input type="time" value={workingHoursEnd} onChange={(e) => setWorkingHoursEnd(e.target.value)} />
            </Field>
          </div>
          <Field label="Fuseau horaire">
            <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              <option value="Africa/Abidjan">Abidjan, Dakar, Accra (UTC+0)</option>
              <option value="Europe/Paris">Paris, Bruxelles, Genève (UTC+1 / +2)</option>
              <option value="Africa/Casablanca">Casablanca, Rabat (UTC+1)</option>
              <option value="Africa/Lagos">Lagos, Douala, Yaoundé (UTC+1)</option>
              <option value="Africa/Nairobi">Nairobi, Addis-Abeba (UTC+3)</option>
              <option value="Europe/London">Londres, Dublin (UTC+0 / +1)</option>
              <option value="America/Montreal">Montréal, New York, Toronto (UTC-5 / -4)</option>
              <option value="America/Chicago">Chicago, Dallas (UTC-6 / -5)</option>
              <option value="America/Los_Angeles">San Francisco, Los Angeles (UTC-8 / -7)</option>
            </Select>
          </Field>
        </div>

        <div className="space-y-2 border-t border-line pt-5 text-sm text-muted">
          <p className="font-medium text-ink">Quotas de sécurité</p>
          <p>
            Vos volumes hebdomadaires dépendent de votre offre et se règlent dans <span className="font-medium text-ink">Paramètres › Compte</span>.
            Bleadin les répartit sur les jours sélectionnés, avec une quantité légèrement différente chaque jour et 90 secondes minimum entre deux actions.
          </p>
        </div>
      </div>
    </Modal>
  );
};
