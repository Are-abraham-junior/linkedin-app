const API_BASE = import.meta.env.VITE_API_URL || "/api";

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string; [key: string]: any }> {
  const token = localStorage.getItem("bime_token");

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const rawText = await res.text();
    let data: any = {};
    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        data = { error: rawText };
      }
    }

    if (!res.ok) {
      return {
        success: false,
        error: data.error || `Erreur requête (${res.status})`,
      };
    }

    return data;
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Erreur de connexion au serveur",
    };
  }
}
