import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "../types";
import { apiRequest } from "../services/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setupNeeded: boolean;
  selectedMemberId: string | null;
  setSelectedMemberId: (id: string | null) => void;
  impersonatedOrg: { id: string; name: string; slug: string } | null;
  setImpersonatedOrg: (org: { id: string; name: string; slug: string } | null) => void;
  showLinkedInModal: boolean;
  setShowLinkedInModal: (show: boolean) => void;
  openLinkedInModal: () => void;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (updatedUser: Partial<User>) => void;
  refreshUser: () => Promise<void>;
  checkSetupStatus: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("bime_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(localStorage.getItem("bime_token"));
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [setupNeeded, setSetupNeeded] = useState<boolean>(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [impersonatedOrg, setImpersonatedOrgState] = useState<{ id: string; name: string; slug: string } | null>(() => {
    const saved = localStorage.getItem("bime_impersonated_org");
    return saved ? JSON.parse(saved) : null;
  });

  const setImpersonatedOrg = (org: { id: string; name: string; slug: string } | null) => {
    if (org) {
      localStorage.setItem("bime_impersonated_org", JSON.stringify(org));
    } else {
      localStorage.removeItem("bime_impersonated_org");
    }
    setImpersonatedOrgState(org);
    setSelectedMemberId(null);
    refreshUser();
  };
  const [showLinkedInModal, setShowLinkedInModal] = useState<boolean>(false);

  const openLinkedInModal = () => setShowLinkedInModal(true);

  const checkSetupStatus = async (): Promise<boolean> => {
    try {
      const res = await apiRequest<{ setupCompleted: boolean }>("/auth/setup-status");
      if (res.success && res.setupCompleted === false) {
        setSetupNeeded(true);
        return true;
      } else {
        setSetupNeeded(false);
        return false;
      }
    } catch {
      return false;
    }
  };

  const refreshUser = async () => {
    const savedToken = localStorage.getItem("bime_token");
    if (!savedToken) {
      setUser(null);
      return;
    }

    try {
      const res = await apiRequest<{ user: User }>("/auth/me");
      if (res.success && res.user) {
        setUser(res.user);
        localStorage.setItem("bime_user", JSON.stringify(res.user));
      } else {
        logout();
      }
    } catch {
      // keep offline state if network blip
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem("bime_token");
      if (savedToken) {
        await refreshUser();
      }
    };
    initAuth();
  }, []);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem("bime_token", newToken);
    localStorage.setItem("bime_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setSetupNeeded(false);
  };

  const logout = () => {
    localStorage.removeItem("bime_token");
    localStorage.removeItem("bime_user");
    setToken(null);
    setUser(null);
  };

  const updateUser = (updatedFields: Partial<User>) => {
    if (user) {
      const updated = { ...user, ...updatedFields };
      setUser(updated);
      localStorage.setItem("bime_user", JSON.stringify(updated));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        setupNeeded,
        selectedMemberId,
        setSelectedMemberId,
        impersonatedOrg,
        setImpersonatedOrg,
        showLinkedInModal,
        setShowLinkedInModal,
        openLinkedInModal,
        login,
        logout,
        updateUser,
        refreshUser,
        checkSetupStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
