const API_BASE = import.meta.env.VITE_API_URL || "/api";

interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: Record<string, any> | FormData | string;
}

let sessionLostHandled = false;

function handleSessionLost() {
  if (sessionLostHandled) return;
  const hadToken = Boolean(localStorage.getItem("bleadin_token") || localStorage.getItem("bime_token"));
  sessionLostHandled = true;
  for (const key of ["bleadin_token", "bleadin_user", "bleadin_impersonated_org", "bime_token", "bime_user", "bime_impersonated_org"]) localStorage.removeItem(key);
  if (!window.location.pathname.startsWith("/connexion")) {
    window.location.assign(`/connexion?expired=1${hadToken ? "" : "&reason=missing"}`);
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<{ success: boolean; data?: T; error?: string; [key: string]: any }> {
  const token = localStorage.getItem("bleadin_token") || localStorage.getItem("bime_token");
  const savedOrg = localStorage.getItem("bleadin_impersonated_org") || localStorage.getItem("bime_impersonated_org");

  const headers: HeadersInit = {
    ...(options.headers || {}),
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  if (savedOrg) {
    try {
      const org = JSON.parse(savedOrg);
      if (org && org.id) {
        (headers as Record<string, string>)["x-impersonate-org"] = org.id;
      }
    } catch (e) {
      // parse error, ignore
    }
  }

  // Serialize body if it's an object, or pass directly if it's already a string or FormData
  let body: RequestInit["body"] = undefined;
  if (options.body) {
    if (options.body instanceof FormData) {
      body = options.body;
    } else if (typeof options.body === "string") {
      body = options.body;
      (headers as Record<string, string>)["Content-Type"] = "application/json";
    } else {
      body = JSON.stringify(options.body);
      (headers as Record<string, string>)["Content-Type"] = "application/json";
    }
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      body,
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

    if (res.status === 401 && !endpoint.startsWith("/auth/")) {
      // Session absente ou invalide : on ne laisse pas l'interface paraître connectée avec des requêtes qui échouent en silence.
      handleSessionLost();
    }

    if (!res.ok) {
      return {
        success: false,
        ...data,
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
