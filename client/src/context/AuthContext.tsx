import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "../types";
import { apiRequest } from "../services/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setupNeeded: boolean;
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
