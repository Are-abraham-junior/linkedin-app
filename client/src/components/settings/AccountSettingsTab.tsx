import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";
import {
  User as UserIcon,
  Mail,
  Lock,
  Clock,
  Calendar,
  Globe,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Save,
  Loader2,
  Sparkles,
} from "lucide-react";

const DAYS_OF_WEEK = [
  { id: "MON", label: "Lun" },
  { id: "TUE", label: "Mar" },
  { id: "WED", label: "Mer" },
  { id: "THU", label: "Jeu" },
  { id: "FRI", label: "Ven" },
  { id: "SAT", label: "Sam" },
  { id: "SUN", label: "Dim" },
];

const TIMEZONES = [
  { value: "Africa/Abidjan", label: "Abidjan (GMT+0)" },
  { value: "Europe/Paris", label: "Paris, Bruxelles (GMT+1 / GMT+2)" },
  { value: "Europe/London", label: "Londres, Dublin (GMT+0 / GMT+1)" },
  { value: "America/New_York", label: "New York, Montréal (EST / EDT)" },
  { value: "America/Chicago", label: "Chicago (CST)" },
  { value: "America/Los_Angeles", label: "Los Angeles, San Francisco (PST)" },
  { value: "Asia/Dubai", label: "Dubaï (GST)" },
  { value: "UTC", label: "Temps Universel Coordonné (UTC)" },
];

export const AccountSettingsTab: React.FC = () => {
  const { user, refreshUser } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [maxDailyInvites, setMaxDailyInvites] = useState(30);
  const [maxDailyMsg, setMaxDailyMsg] = useState(70);
  const [workingDays, setWorkingDays] = useState<string[]>(["MON", "TUE", "WED", "THU", "FRI"]);
  const [workingHoursStart, setWorkingHoursStart] = useState("08:00");
  const [workingHoursEnd, setWorkingHoursEnd] = useState("19:00");
  const [timezone, setTimezone] = useState("Africa/Abidjan");

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const fetchAccountData = async () => {
      try {
        const res = await apiRequest<{ success: boolean; account: any }>("/settings/account");
        if (res.success && res.account) {
          const acc = res.account;
          setFirstName(acc.firstName || "");
          setLastName(acc.lastName || "");
          setEmail(acc.email || "");
          setAvatarUrl(acc.avatarUrl || "");
          setMaxDailyInvites(acc.maxDailyInvites || 30);
          setMaxDailyMsg(acc.maxDailyMsg || 70);
          if (Array.isArray(acc.workingDays) && acc.workingDays.length > 0) {
            setWorkingDays(acc.workingDays);
          }
          setWorkingHoursStart(acc.workingHoursStart || "08:00");
          setWorkingHoursEnd(acc.workingHoursEnd || "19:00");
          setTimezone(acc.timezone || "Africa/Abidjan");
        }
      } catch (err: any) {
        console.warn("Notice loading account settings:", err.message);
      } finally {
        setFetching(false);
      }
    };

    fetchAccountData();
  }, []);

  const toggleDay = (dayId: string) => {
    if (workingDays.includes(dayId)) {
      if (workingDays.length === 1) return; // Garder au moins 1 jour
      setWorkingDays(workingDays.filter((d) => d !== dayId));
    } else {
      setWorkingDays([...workingDays, dayId]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword && newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Le nouveau mot de passe et sa confirmation ne correspondent pas." });
      return;
    }

    if (newPassword && newPassword.length < 8) {
      setMessage({ type: "error", text: "Le nouveau mot de passe doit comporter au moins 8 caractères." });
      return;
    }

    setLoading(true);

    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const payload: any = {
        name: fullName || undefined,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        avatarUrl: avatarUrl.trim() || null,
        maxDailyInvites,
        maxDailyMsg,
        workingDays,
        workingHoursStart,
        workingHoursEnd,
        timezone,
      };

      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const res = await apiRequest<{ success: boolean; message?: string; error?: string }>(
        "/settings/account",
        {
          method: "PUT",
          body: payload,
        }
      );

      if (res.success) {
        setMessage({ type: "success", text: res.message || "Paramètres mis à jour avec succès !" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        await refreshUser();
      } else {
        setMessage({ type: "error", text: res.error || "Erreur lors de la sauvegarde." });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Erreur réseau lors de la mise à jour." });
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-[#592eff]" />
        <span className="text-xs text-[#5f5f69] font-medium">Chargement des paramètres de votre compte...</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-8 max-w-4xl">
      {message && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-semibold animate-in fade-in ${
            message.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Bloc 1 : Profil & Identité */}
      <div className="adora-card p-6 sm:p-7 bg-white rounded-3xl border border-[#e0e0db]/80 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-[#f0f0f4] pb-4">
          <div className="w-9 h-9 rounded-2xl bg-[#592eff]/10 flex items-center justify-center text-[#592eff]">
            <UserIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#21164c]">Profil & Coordonnées</h3>
            <p className="text-xs text-[#5f5f69]">Gérez vos informations visibles et de connexion</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
          <div className="relative group">
            <img
              src={
                avatarUrl ||
                user?.avatarUrl ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  `${firstName} ${lastName}`.trim() || user?.name || "User"
                )}&background=592eff&color=fff`
              }
              alt="Avatar"
              className="w-20 h-20 rounded-full object-cover border-2 border-[#592eff]/30 shadow-md"
            />
          </div>
          <div className="flex-1 w-full space-y-2">
            <label className="text-xs font-bold text-[#21164c]">URL de l'image de profil</label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
              className="w-full px-3.5 py-2.5 bg-[#f8f9fc] border border-[#e0e0db] rounded-xl text-xs text-[#21164c] placeholder-[#9ca3af] focus:outline-none focus:border-[#592eff] focus:bg-white transition-all"
            />
            <p className="text-[11px] text-[#7c7c88]">
              Laissez vide pour utiliser votre photo de profil LinkedIn synchronisée automatiquement.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#21164c]">Prénom</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Ex: Jean"
              className="w-full px-3.5 py-2.5 bg-[#f8f9fc] border border-[#e0e0db] rounded-xl text-xs text-[#21164c] focus:outline-none focus:border-[#592eff] focus:bg-white transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#21164c]">Nom de famille</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Ex: Dupont"
              className="w-full px-3.5 py-2.5 bg-[#f8f9fc] border border-[#e0e0db] rounded-xl text-xs text-[#21164c] focus:outline-none focus:border-[#592eff] focus:bg-white transition-all"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#21164c] flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-[#592eff]" />
            Adresse email professionnelle
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-[#f8f9fc] border border-[#e0e0db] rounded-xl text-xs text-[#21164c] focus:outline-none focus:border-[#592eff] focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Bloc 2 : Sécurité & Mot de passe */}
      <div className="adora-card p-6 sm:p-7 bg-white rounded-3xl border border-[#e0e0db]/80 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-[#f0f0f4] pb-4">
          <div className="w-9 h-9 rounded-2xl bg-[#592eff]/10 flex items-center justify-center text-[#592eff]">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#21164c]">Sécurité & Authentification</h3>
            <p className="text-xs text-[#5f5f69]">Mettez à jour votre mot de passe d'accès à Bime Link</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#21164c]">Mot de passe actuel</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3.5 py-2.5 bg-[#f8f9fc] border border-[#e0e0db] rounded-xl text-xs text-[#21164c] focus:outline-none focus:border-[#592eff] focus:bg-white transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#21164c]">Nouveau mot de passe</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 caractères"
                className="w-full px-3.5 py-2.5 bg-[#f8f9fc] border border-[#e0e0db] rounded-xl text-xs text-[#21164c] focus:outline-none focus:border-[#592eff] focus:bg-white transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#21164c]">Confirmer le nouveau mot de passe</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Retapez le mot de passe"
                className="w-full px-3.5 py-2.5 bg-[#f8f9fc] border border-[#e0e0db] rounded-xl text-xs text-[#21164c] focus:outline-none focus:border-[#592eff] focus:bg-white transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bloc 3 : Quotas journaliers & Plages de travail */}
      <div className="adora-card p-6 sm:p-7 bg-white rounded-3xl border border-[#e0e0db]/80 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-[#f0f0f4] pb-4">
          <div className="w-9 h-9 rounded-2xl bg-[#592eff]/10 flex items-center justify-center text-[#592eff]">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#21164c]">Règles & Quotas de Prospection</h3>
            <p className="text-xs text-[#5f5f69]">Contrôle anti-détection pour protéger votre compte LinkedIn</p>
          </div>
        </div>

        {/* Quotas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="p-4 rounded-2xl bg-[#f8f9fc] border border-[#e0e0db]/60 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#21164c]">Invitations max / jour</label>
              <span className="px-2.5 py-0.5 rounded-full bg-[#592eff]/10 text-[#592eff] font-extrabold text-xs">
                {maxDailyInvites} / j
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={80}
              value={maxDailyInvites}
              onChange={(e) => setMaxDailyInvites(Number(e.target.value))}
              className="w-full accent-[#592eff] cursor-pointer"
            />
            <p className="text-[11px] text-[#7c7c88]">
              Recommandation : 25 à 40 invitations par jour pour une sécurité optimale.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#f8f9fc] border border-[#e0e0db]/60 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#21164c]">Messages max / jour</label>
              <span className="px-2.5 py-0.5 rounded-full bg-[#592eff]/10 text-[#592eff] font-extrabold text-xs">
                {maxDailyMsg} / j
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={150}
              value={maxDailyMsg}
              onChange={(e) => setMaxDailyMsg(Number(e.target.value))}
              className="w-full accent-[#592eff] cursor-pointer"
            />
            <p className="text-[11px] text-[#7c7c88]">
              Recommandation : 50 à 90 messages de relance ou de prise de contact par jour.
            </p>
          </div>
        </div>

        {/* Plages horaires & fuseau */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#21164c] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#592eff]" />
              Début des envois
            </label>
            <input
              type="time"
              value={workingHoursStart}
              onChange={(e) => setWorkingHoursStart(e.target.value)}
              className="w-full px-3 py-2 bg-[#f8f9fc] border border-[#e0e0db] rounded-xl text-xs font-semibold text-[#21164c] focus:outline-none focus:border-[#592eff]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#21164c] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#592eff]" />
              Fin des envois
            </label>
            <input
              type="time"
              value={workingHoursEnd}
              onChange={(e) => setWorkingHoursEnd(e.target.value)}
              className="w-full px-3 py-2 bg-[#f8f9fc] border border-[#e0e0db] rounded-xl text-xs font-semibold text-[#21164c] focus:outline-none focus:border-[#592eff]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#21164c] flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#592eff]" />
              Fuseau horaire
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-2 bg-[#f8f9fc] border border-[#e0e0db] rounded-xl text-xs font-semibold text-[#21164c] focus:outline-none focus:border-[#592eff]"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Jours actifs */}
        <div className="space-y-2 pt-2">
          <label className="text-xs font-bold text-[#21164c] flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#592eff]" />
            Jours ouvrés d'exécution des campagnes
          </label>
          <div className="flex flex-wrap gap-2">
            {DAYS_OF_WEEK.map((day) => {
              const active = workingDays.includes(day.id);
              return (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => toggleDay(day.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    active
                      ? "bg-[#592eff] text-white shadow-xs shadow-[#592eff]/30"
                      : "bg-[#f0f0f4] text-[#7c7c88] hover:bg-[#e4e4e9]"
                  }`}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-[#7c7c88]">
            Les actions en file d'attente ne s'exécutent que pendant vos créneaux définis pour simuler une présence humaine naturelle.
          </p>
        </div>
      </div>

      {/* Bouton de validation global */}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-[#592eff] hover:bg-[#4922db] text-white font-bold text-xs rounded-2xl shadow-lg shadow-[#592eff]/25 hover:shadow-[#592eff]/40 active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Enregistrement en cours...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Enregistrer les paramètres du compte</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};
