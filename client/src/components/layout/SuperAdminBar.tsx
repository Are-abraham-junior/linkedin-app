import React, { useState, useEffect } from "react";
import { Shield, ArrowLeft, Building2, Users, Sparkles } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";

interface SuperAdminBarProps {
  organizationName: string;
  onExit: () => void;
}

export const SuperAdminBar: React.FC<SuperAdminBarProps> = ({ organizationName, onExit }) => {
  const { selectedMemberId, setSelectedMemberId } = useAuth();
  const [members, setMembers] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    apiRequest<{ members: any[] }>("/team/members")
      .then((res) => {
        if (isMounted && res.success && Array.isArray(res.members)) {
          setMembers(res.members);
        }
      })
      .catch((e) => console.error("Erreur chargement membres dans SuperAdminBar:", e));

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="bg-[#21164c] text-white text-xs py-2 px-4 sm:px-6 shadow-md flex flex-wrap items-center justify-between gap-3 z-50 sticky top-0 border-b border-[#592eff]/30 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-[#592eff] to-[#7c3aed] text-white flex items-center justify-center shrink-0 shadow-sm shadow-[#592eff]/40">
          <Shield className="w-3.5 h-3.5" />
        </div>
        
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-white tracking-tight">Supervision 360° :</span>
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-white font-bold border border-white/10 shadow-xs">
            <Building2 className="w-3 h-3 text-[#2ed6ff]" />
            <span>{organizationName}</span>
          </div>
        </div>

        {/* Sélecteur Collaborateur 360° */}
        {members.length > 0 && (
          <div className="flex items-center gap-1.5 pl-2 sm:border-l sm:border-white/20">
            <Users className="w-3.5 h-3.5 text-[#2ed6ff]" />
            <span className="text-[11px] text-gray-300 hidden md:inline">Vue :</span>
            <select
              value={selectedMemberId || "ALL"}
              onChange={(e) => setSelectedMemberId(e.target.value === "ALL" ? null : e.target.value)}
              className="bg-white/10 hover:bg-white/15 text-white text-xs font-bold rounded-lg px-2.5 py-1 border border-white/20 focus:outline-none focus:ring-1 focus:ring-[#2ed6ff] cursor-pointer transition-colors"
            >
              <option value="ALL" className="bg-[#21164c] text-white font-bold">
                🌟 Toute l'équipe (Vue 360°)
              </option>
              {members.map((m) => (
                <option key={m.id} value={m.id} className="bg-[#21164c] text-white">
                  👤 {m.name || m.email} {m.orgRole === "OWNER" ? "(Propriétaire)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <span className="hidden xl:inline text-white/50 text-[11px]">
          — Accès consolidé à l'ensemble des membres et campagnes
        </span>
      </div>

      <button
        onClick={onExit}
        className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white px-3 py-1.5 rounded-full font-bold text-xs transition-all cursor-pointer border border-white/20 shadow-xs"
        title="Quitter la supervision et revenir au tableau de bord"
      >
        <ArrowLeft className="w-3 h-3" />
        <span>Quitter l'espace & Revenir au Hub</span>
      </button>
    </div>
  );
};
