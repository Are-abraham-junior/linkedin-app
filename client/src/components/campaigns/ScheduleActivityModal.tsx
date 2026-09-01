import React, { useState, useEffect } from "react";
import {
  X,
  Clock,
  Calendar,
  ShieldCheck,
  Zap,
  Save,
  Info,
  Check,
} from "lucide-react";
import { apiRequest } from "../../services/api";

interface ScheduleSettings {
  workingDays: string[];
  workingHoursStart: string;
  workingHoursEnd: string;
  timezone: string;
  maxDailyInvites: number;
  maxDailyMsg: number;
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
  const [maxDailyInvites, setMaxDailyInvites] = useState(30);
  const [maxDailyMsg, setMaxDailyMsg] = useState(70);

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
          setMaxDailyInvites(res.schedule.maxDailyInvites || 30);
          setMaxDailyMsg(res.schedule.maxDailyMsg || 70);
        }
      } catch (err: any) {
        console.error("Erreur récupération planning:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [isOpen]);

  if (!isOpen) return null;

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
          maxDailyInvites: Number(maxDailyInvites),
          maxDailyMsg: Number(maxDailyMsg),
        }),
      });

      if (res.success) {
        setSuccessMsg("Planning et quotas enregistrés avec succès !");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a051e]/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-xl w-full border border-[#e0e0db] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-[#e0e0db]/60 flex items-center justify-between bg-gradient-to-r from-[#fafaff] to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#592eff]/10 flex items-center justify-center text-[#592eff] shadow-sm">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#21164c]">Planifier l'activité</h3>
              <p className="text-xs text-[#5f5f69]">
                Horaires d'exécution et quotas pour protéger votre compte
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#5f5f69] hover:bg-[#f5f5f7] hover:text-[#21164c] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-200 font-medium">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 text-emerald-700 text-xs rounded-xl border border-emerald-200 font-medium flex items-center gap-2">
              <Check className="w-4 h-4" /> {successMsg}
            </div>
          )}

          {/* Section 1: Jours de travail */}
          <div>
            <label className="block text-xs font-bold text-[#21164c] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#592eff]" /> Jours d'activité
            </label>
            <p className="text-xs text-[#5f5f69] mb-3">
              Le robot n'exécutera aucune action les jours désactivés.
            </p>

            <div className="grid grid-cols-7 gap-2">
              {ALL_DAYS.map((d) => {
                const isSelected = workingDays.includes(d.key);
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => toggleDay(d.key)}
                    className={`py-2.5 px-1 rounded-2xl text-xs font-bold transition-all flex flex-col items-center gap-1 border ${
                      isSelected
                        ? "bg-[#592eff] text-white border-[#592eff] shadow-sm shadow-[#592eff]/20"
                        : "bg-[#f8f9fc] text-[#5f5f69] border-[#e0e0db] hover:border-[#592eff]/40"
                    }`}
                  >
                    <span>{d.short}</span>
                    <span className="text-[10px] font-normal opacity-80">
                      {isSelected ? "✓" : "—"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Plages Horaires */}
          <div>
            <label className="block text-xs font-bold text-[#21164c] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#592eff]" /> Plage horaire d'envoi
            </label>
            <p className="text-xs text-[#5f5f69] mb-3">
              Les actions seront envoyées uniquement pendant cette fenêtre de temps.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-[#5f5f69] mb-1 block">
                  Heure de début
                </label>
                <input
                  type="time"
                  value={workingHoursStart}
                  onChange={(e) => setWorkingHoursStart(e.target.value)}
                  className="w-full px-3 py-2 bg-[#f8f9fc] border border-[#e0e0db] rounded-xl text-sm font-bold text-[#21164c] focus:outline-none focus:border-[#592eff] transition-colors"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#5f5f69] mb-1 block">
                  Heure de fin
                </label>
                <input
                  type="time"
                  value={workingHoursEnd}
                  onChange={(e) => setWorkingHoursEnd(e.target.value)}
                  className="w-full px-3 py-2 bg-[#f8f9fc] border border-[#e0e0db] rounded-xl text-sm font-bold text-[#21164c] focus:outline-none focus:border-[#592eff] transition-colors"
                />
              </div>
            </div>

            <div className="mt-2 text-[11px] text-[#5f5f69] flex items-center gap-1">
              <span>Fuseau horaire :</span>
              <span className="font-semibold text-[#21164c]">GMT (UTC+0, Heure d'Abidjan)</span>
            </div>
          </div>

          {/* Section 3: Quotas Journaliers */}
          <div className="border-t border-[#e0e0db]/60 pt-5">
            <label className="block text-xs font-bold text-[#21164c] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#2ed6ff]" /> Quotas de sécurité journaliers
            </label>
            <p className="text-xs text-[#5f5f69] mb-4">
              Limites maximales par 24 heures pour éviter les restrictions LinkedIn.
            </p>

            <div className="space-y-4">
              {/* Invitations */}
              <div className="bg-[#f8f9fc] p-4 rounded-2xl border border-[#e0e0db]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#21164c]">Invitations max / jour</span>
                  <span className="text-xs font-bold bg-[#592eff]/10 text-[#592eff] px-2 py-0.5 rounded-full">
                    {maxDailyInvites} inv.
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={80}
                  step={5}
                  value={maxDailyInvites}
                  onChange={(e) => setMaxDailyInvites(Number(e.target.value))}
                  className="w-full accent-[#592eff] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#5f5f69] mt-1">
                  <span>5 (Très prudent)</span>
                  <span className="font-semibold text-[#592eff]">30 (Recommandé)</span>
                  <span>80 (Maximum)</span>
                </div>
              </div>

              {/* Messages */}
              <div className="bg-[#f8f9fc] p-4 rounded-2xl border border-[#e0e0db]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#21164c]">Messages max / jour</span>
                  <span className="text-xs font-bold bg-[#2ed6ff]/10 text-[#0284c7] px-2 py-0.5 rounded-full">
                    {maxDailyMsg} msg.
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={150}
                  step={10}
                  value={maxDailyMsg}
                  onChange={(e) => setMaxDailyMsg(Number(e.target.value))}
                  className="w-full accent-[#2ed6ff] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#5f5f69] mt-1">
                  <span>10 (Prudent)</span>
                  <span className="font-semibold text-[#0284c7]">70 (Recommandé)</span>
                  <span>150 (Maximum)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Info card */}
          <div className="p-3.5 bg-[#592eff]/5 rounded-2xl border border-[#592eff]/15 flex items-start gap-2.5 text-xs text-[#21164c]">
            <Info className="w-4 h-4 text-[#592eff] shrink-0 mt-0.5" />
            <p>
              Bime Link espace automatiquement chaque action de 90 secondes avec un léger délai aléatoire
              pour garantir une sécurité maximale à votre compte.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-[#e0e0db]/60 flex items-center justify-end gap-3 bg-[#fafaff]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-[#5f5f69] hover:bg-white hover:text-[#21164c] rounded-xl border border-transparent hover:border-[#e0e0db] transition-all"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="px-5 py-2 text-xs font-bold text-white bg-[#592eff] hover:bg-[#4d25e6] rounded-xl shadow-md shadow-[#592eff]/20 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Enregistrer le planning
          </button>
        </div>
      </div>
    </div>
  );
};
