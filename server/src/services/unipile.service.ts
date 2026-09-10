import "dotenv/config";

import { extractCompanyFromHeadline } from "../utils/companyExtractor.js";

const UNIPILE_DSN = process.env.UNIPILE_DSN || "https://api64.unipile.com:19478";
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY || "Xn10pe1e.5rETphPfo4LGT/oDPPFuLFaN4OCrAdMvzDP4RbxF1yA=";

/**
 * LWS (mutualisé) bloque toute connexion SORTANTE sur un port non-standard : seuls
 * 80/443 passent (vérifié : 19478, 8443, 993, 587... tous refusés — ECONNREFUSED —
 * alors que 443 répond en <0.1s). Le DSN Unipile dédié utilise pourtant un port
 * custom (ex: :19478), ce qui rendait tout appel Unipile impossible depuis le
 * serveur ("fetch failed" côté client, ECONNREFUSED côté serveur).
 *
 * Unipile fournit un contournement officiel : appeler l'hôte SANS le port dans le
 * DSN (donc port 443 implicite) et passer le port réel en paramètre de requête
 * `?port=XXXXX` à la place — cf. https://developer.unipile.com/docs/api-usage :
 * "If custom port are blocked in your environment, you can use port as query
 * parameter to stay on standard 443".
 *
 * Ne jamais revenir à un DSN avec port inline (`https://apiXX.unipile.com:PORT`)
 * tant que l'app tourne sur cet hébergement LWS mutualisé.
 */
function parseUnipileDsn(dsn: string): { hostBaseUrl: string; port: string | null } {
  try {
    const u = new URL(dsn);
    const port = u.port || null;
    u.port = "";
    return { hostBaseUrl: u.toString().replace(/\/$/, ""), port };
  } catch {
    return { hostBaseUrl: dsn.replace(/\/$/, ""), port: null };
  }
}

const BASE_URL = parseUnipileDsn(process.env.UNIPILE_DSN || UNIPILE_DSN).hostBaseUrl;

/**
 * Ajoute automatiquement `?port=` (ou `&port=` si l'URL a déjà une query string) à
 * toute requête sortante vers Unipile, puis délègue au `fetch` global. C'est le SEUL
 * point de sortie réseau de ce service : TOUS les appels ci-dessous utilisent cette
 * fonction (jamais `fetch` directement) afin que le contournement de port reste
 * garanti même si un appel utilise `getBaseUrl()` ou `BASE_URL` directement.
 */
function unipileFetch(url: string, options?: RequestInit): Promise<Response> {
  const { port } = parseUnipileDsn(process.env.UNIPILE_DSN || UNIPILE_DSN);
  if (!port) return fetch(url, options);
  const sep = url.includes("?") ? "&" : "?";
  return fetch(`${url}${sep}port=${port}`, options);
}

export interface LinkedInProfileResult {
  providerProfileId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  headline: string;
  company?: string;
  location?: string;
  linkedinUrl: string;
  avatarUrl?: string;
  networkDistance?: string;
  connectionStatus?: "NOT_CONNECTED" | "PENDING" | "CONNECTED";
  industry?: string;
}

export class UnipileService {
  public static getBaseUrl(): string {
    return parseUnipileDsn(process.env.UNIPILE_DSN || BASE_URL).hostBaseUrl;
  }

  public static parseErrorResponse(status: number, errText: string): string {
    if (status === 502) {
      return "Le service de messagerie LinkedIn est temporairement indisponible (502 Bad Gateway). Le serveur est en cours de synchronisation, veuillez réessayer dans un instant.";
    }
    if (status === 503) {
      return "Le service de messagerie LinkedIn est temporairement indisponible (503 Service Unavailable). Veuillez réessayer dans quelques instants.";
    }
    if (status === 504) {
      return "Délai d'attente dépassé avec le service LinkedIn (504 Gateway Timeout). Veuillez réessayer.";
    }
    if (errText.trim().startsWith("<") || errText.toLowerCase().includes("<html")) {
      return `Le service de synchronisation LinkedIn rencontre une perturbation temporaire (HTTP ${status}).`;
    }
    try {
      const parsed = JSON.parse(errText);
      return parsed.message || parsed.error || parsed.detail || errText;
    } catch {
      return errText;
    }
  }

  public static async safeJsonParse(res: Response): Promise<{ ok: boolean; status: number; data: any; rawText: string }> {
    const rawText = await res.text();
    let data: any = null;
    const contentType = res.headers.get("content-type") || "";
    if (
      contentType.includes("application/json") ||
      (rawText.trim().startsWith("{") && rawText.trim().endsWith("}")) ||
      (rawText.trim().startsWith("[") && rawText.trim().endsWith("]"))
    ) {
      try {
        data = JSON.parse(rawText);
      } catch {
        data = null;
      }
    }
    return { ok: res.ok, status: res.status, data, rawText };
  }

  private static getHeaders() {
    return {
      "X-API-KEY": process.env.UNIPILE_API_KEY || UNIPILE_API_KEY,
      "Content-Type": "application/json",
      "Accept": "application/json",
    };
  }

  /**
   * Récupère la liste de tous les comptes connectés sur Unipile
   */
  static async getAllAccounts(): Promise<{
    success: boolean;
    items?: Array<{
      id: string;
      name: string;
      type: string;
      created_at: string;
      sources: Array<{ id: string; status: string }>;
    }>;
    error?: string;
  }> {
    try {
      const baseUrl = this.getBaseUrl();
      const res = await unipileFetch(`${baseUrl}/api/v1/accounts`, {
        headers: this.getHeaders(),
      });
      const { ok, status, data, rawText } = await this.safeJsonParse(res);
      if (!ok) {
        return { success: false, error: this.parseErrorResponse(status, rawText) };
      }
      return { success: true, items: data?.items || [] };
    } catch (err: any) {
      return { success: false, error: this.parseErrorResponse(500, err.message) };
    }
  }

  /**
   * Supprime/déconnecte un compte LinkedIn sur Unipile (libère le slot de facturation)
   * Doc Unipile : DELETE /api/v1/accounts/{id}
   */
  static async deleteAccount(accountId: string): Promise<{ success: boolean; error?: string }> {
    if (!accountId) {
      return { success: false, error: "accountId manquant" };
    }
    try {
      console.log(`[LinkedIn Gateway] Suppression/Déconnexion du compte ${accountId}...`);
      const baseUrl = this.getBaseUrl();
      const res = await unipileFetch(`${baseUrl}/api/v1/accounts/${accountId}`, {
        method: "DELETE",
        headers: this.getHeaders(),
      });
      const { ok, status, rawText } = await this.safeJsonParse(res);
      if (!ok) {
        const errorText = this.parseErrorResponse(status, rawText);
        console.warn(`[LinkedIn Gateway] Échec suppression compte ${accountId} (${status}):`, errorText);
        return { success: false, error: errorText };
      }
      console.log(`[LinkedIn Gateway] ✅ Compte ${accountId} supprimé avec succès.`);
      return { success: true };
    } catch (err: any) {
      console.error(`[LinkedIn Gateway] Erreur suppression compte ${accountId}:`, err.message);
      return { success: false, error: this.parseErrorResponse(500, err.message) };
    }
  }

  /**
   * Connecte un compte LinkedIn via Custom Auth.
   * Retourne { account_id, status } ou { status: "CHECKPOINT", checkpoint: {...} }
   */
  static async connectLinkedInAccount(linkedinEmail: string, linkedinPassword: string): Promise<{
    success: boolean;
    accountId?: string;
    status?: string;
    checkpoint?: any;
    error?: string;
    statusCode?: number;
  }> {
    try {
      const baseUrl = this.getBaseUrl();
      const res = await unipileFetch(`${baseUrl}/api/v1/accounts`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          provider: "LINKEDIN",
          username: linkedinEmail,
          password: linkedinPassword,
        }),
      });

      const { ok, status, data, rawText } = await this.safeJsonParse(res);

      if (!ok) {
        const parsedMsg = this.parseErrorResponse(status, rawText);
        console.error("[LinkedIn Gateway] connectLinkedInAccount error:", status, parsedMsg);
        return {
          success: false,
          statusCode: status,
          error: data?.message || data?.error || parsedMsg,
        };
      }

      // Checkpoint = LinkedIn demande une vérification supplémentaire (2FA, etc.)
      if (data?.object === "AccountCheckpoint" || data?.status === "CHECKPOINT") {
        return { success: false, status: "CHECKPOINT", checkpoint: data };
      }

      const accountId = data?.account_id || data?.id;
      if (!accountId) {
        return { success: false, error: "Impossible de récupérer l'identifiant du compte LinkedIn." };
      }

      return { success: true, accountId, status: data?.status || "CONNECTED" };
    } catch (err: any) {
      console.error("[LinkedIn Gateway] connectLinkedInAccount exception:", err.message);
      return { success: false, statusCode: 500, error: this.parseErrorResponse(500, err.message) };
    }
  }

  /**
   * Génère un lien de reconnexion sécurisé (Hosted Auth) en cas de besoin de reconnexion guidée
   */
  static async createHostedReconnectLink(params: {
    accountId?: string;
    redirectUrl?: string;
    userId?: string;
  }): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const baseUrl = this.getBaseUrl();
      const expiresOn = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const body: any = {
        type: params.accountId ? "reconnect" : "create",
        providers: ["LINKEDIN"],
        api_url: baseUrl,
        expiresOn,
      };
      if (params.accountId) {
        body.reconnect_account = params.accountId;
      }
      if (params.redirectUrl) {
        body.success_redirect_url = params.redirectUrl;
      }
      if (params.userId) {
        body.name = params.userId;
      }

      const res = await unipileFetch(`${baseUrl}/api/v1/hosted/accounts/link`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });

      const { ok, status, data, rawText } = await this.safeJsonParse(res);
      if (!ok) {
        return { success: false, error: this.parseErrorResponse(status, rawText) };
      }
      return { success: true, url: data?.url };
    } catch (err: any) {
      return { success: false, error: this.parseErrorResponse(500, err.message) };
    }
  }

  /**
   * Détecte le type d'abonnement LinkedIn via Unipile :
   * - Vérifie is_premium sur le profil (/api/v1/users/me)
   * - Vérifie les produits activés sur le compte (/api/v1/accounts/:id)
   * - Vérifie la présence éventuelle d'un contrat Sales Navigator ou Recruiter (/api/v1/linkedin/contracts)
   */
  static async detectLinkedInSubscription(accountId: string): Promise<{
    isPremium: boolean;
    hasSalesNavigator: boolean;
    accountType: "STANDARD" | "PREMIUM" | "SALES_NAVIGATOR" | "RECRUITER";
  }> {
    let isPremium = false;
    let hasSalesNavigator = false;
    let hasRecruiter = false;

    try {
      const baseUrl = this.getBaseUrl();
      const headers = this.getHeaders();

      // 1. Profil utilisateur (/api/v1/users/me)
      try {
        const meRes = await unipileFetch(`${baseUrl}/api/v1/users/me?account_id=${accountId}`, { headers });
        if (meRes.ok) {
          const { data: meData } = await this.safeJsonParse(meRes);
          if (meData) {
            isPremium = Boolean(
              meData?.is_premium ??
              meData?.specifics?.is_premium ??
              meData?.is_open_profile ??
              meData?.specifics?.is_open_profile
            );
          }
        }
      } catch (err: any) {
        console.warn("[detectLinkedInSubscription] Error checking /users/me:", err.message);
      }

      // 2. Objet compte (/api/v1/accounts/:id)
      try {
        const accRes = await unipileFetch(`${baseUrl}/api/v1/accounts/${accountId}`, { headers });
        if (accRes.ok) {
          const { data: accData } = await this.safeJsonParse(accRes);
          const productsStatus = accData?.metadata?.products_connection_status || {};
          const productsList = Array.isArray(accData?.products) ? accData.products : [];

          if (
            productsStatus.sales_navigator === "running" ||
            productsList.includes("sales_navigator")
          ) {
            hasSalesNavigator = true;
          }

          if (
            productsStatus.recruiter === "running" ||
            productsList.includes("recruiter")
          ) {
            hasRecruiter = true;
          }
        }
      } catch (err: any) {
        console.warn("[detectLinkedInSubscription] Error checking /accounts/:id:", err.message);
      }

      // 3. Si Sales Navigator n'est pas encore confirmé, sonder les contrats (/api/v1/linkedin/contracts)
      if (!hasSalesNavigator && !hasRecruiter) {
        try {
          const contractsRes = await unipileFetch(`${baseUrl}/api/v1/linkedin/contracts?account_id=${accountId}`, { headers });
          if (contractsRes.ok) {
            const { data: contractsData } = await this.safeJsonParse(contractsRes);
            const contracts = contractsData?.contracts || (Array.isArray(contractsData) ? contractsData : []);
            for (const contract of contracts) {
              const product = String(contract?.product || "").toLowerCase();
              if (product.includes("sales_navigator")) {
                hasSalesNavigator = true;
              }
              if (product.includes("recruiter")) {
                hasRecruiter = true;
              }
            }
          }
        } catch (err: any) {
          // Normal si le compte n'a pas de contrats
        }
      }

      // Si Sales Navigator ou Recruiter est actif, le compte est forcément considéré comme Premium
      if (hasSalesNavigator || hasRecruiter) {
        isPremium = true;
      }

      let accountType: "STANDARD" | "PREMIUM" | "SALES_NAVIGATOR" | "RECRUITER" = "STANDARD";
      if (hasSalesNavigator) {
        accountType = "SALES_NAVIGATOR";
      } else if (hasRecruiter) {
        accountType = "RECRUITER";
      } else if (isPremium) {
        accountType = "PREMIUM";
      }

      return {
        isPremium,
        hasSalesNavigator,
        accountType,
      };
    } catch (err: any) {
      console.error("[detectLinkedInSubscription] Exception:", err.message);
      return {
        isPremium: false,
        hasSalesNavigator: false,
        accountType: "STANDARD",
      };
    }
  }

  /**
   * Récupère le profil du compte LinkedIn connecté (nom, photo, headline, provider_id, abonnement)
   */
  static async getConnectedAccountProfile(accountId: string): Promise<{
    success: boolean;
    profile?: {
      accountId: string;
      name: string;
      firstName: string;
      lastName: string;
      avatarUrl?: string;
      headline?: string;
      linkedinProfileId?: string;
      isPremium?: boolean;
      hasSalesNavigator?: boolean;
      accountType?: "STANDARD" | "PREMIUM" | "SALES_NAVIGATOR" | "RECRUITER";
    };
    error?: string;
  }> {
    try {
      const baseUrl = this.getBaseUrl();
      const sub = await this.detectLinkedInSubscription(accountId);

      // 1. Tenter l'endpoint /api/v1/users/me pour obtenir la photo haute résolution et l'occupation
      const meRes = await unipileFetch(`${baseUrl}/api/v1/users/me?account_id=${accountId}`, {
        headers: this.getHeaders(),
      });

      if (meRes.ok) {
        const { data: meData } = await this.safeJsonParse(meRes);
        if (meData) {
          const firstName = meData?.first_name || "";
          const lastName = meData?.last_name || "";
          const name = `${firstName} ${lastName}`.trim() || meData?.public_identifier || meData?.email || "";

          return {
            success: true,
            profile: {
              accountId,
              name,
              firstName,
              lastName,
              avatarUrl: meData?.profile_picture_url || meData?.profile_picture || undefined,
              headline: meData?.occupation || meData?.headline || undefined,
              linkedinProfileId: meData?.provider_id || meData?.entity_urn || undefined,
              isPremium: sub.isPremium,
              hasSalesNavigator: sub.hasSalesNavigator,
              accountType: sub.accountType,
            },
          };
        }
      }

      // 2. Fallback sur /api/v1/accounts/:id si /users/me échoue
      const res = await unipileFetch(`${baseUrl}/api/v1/accounts/${accountId}`, {
        headers: this.getHeaders(),
      });

      const { ok, status, data, rawText } = await this.safeJsonParse(res);
      if (!ok || !data) {
        return { success: false, error: this.parseErrorResponse(status, rawText) };
      }

      const name = data?.name || data?.username || "";
      const parts = name.split(" ");
      const firstName = parts[0] || "";
      const lastName = parts.slice(1).join(" ") || "";

      return {
        success: true,
        profile: {
          accountId,
          name,
          firstName,
          lastName,
          avatarUrl: data?.profile_picture_url || data?.profile_picture || data?.avatar_url || undefined,
          headline: data?.headline || data?.occupation || undefined,
          linkedinProfileId: data?.provider_id || data?.identifier || undefined,
          isPremium: sub.isPremium,
          hasSalesNavigator: sub.hasSalesNavigator,
          accountType: sub.accountType,
        },
      };
    } catch (err: any) {
      console.error("[LinkedIn Gateway] getConnectedAccountProfile exception:", err.message);
      return { success: false, error: this.parseErrorResponse(500, err.message) };
    }
  }

  /**
   * Vérifie le statut du compte LinkedIn
   */
  static async getAccountStatus(accountId: string): Promise<any> {
    if (!accountId) return null;
    try {
      const baseUrl = this.getBaseUrl();
      const res = await unipileFetch(`${baseUrl}/api/v1/accounts/${accountId}`, {
        headers: this.getHeaders(),
      });
      const { ok, status, data, rawText } = await this.safeJsonParse(res);
      if (!ok) {
        const errorMsg = this.parseErrorResponse(status, rawText);
        console.warn(`[LinkedIn Gateway] getAccountStatus non-ok (${status}):`, errorMsg);
        return { errorStatus: status, error: errorMsg };
      }
      return data;
    } catch (err: any) {
      console.error("[LinkedIn Gateway] getAccountStatus error:", err.message);
      return null;
    }
  }

  /**
   * Récupère les identifiants de paramètres de recherche LinkedIn (ex: type=INDUSTRY, LOCATION, etc.)
   * Doc Unipile : GET /api/v1/linkedin/search/parameters
   */
  static async searchParameters(params: {
    type: string;
    keywords?: string;
    service?: "CLASSIC" | "SALES_NAVIGATOR" | "RECRUITER";
    limit?: number;
    accountId?: string;
  }): Promise<{ items: Array<{ id: string; title: string }>; pageCount: number }> {
    const accountId = params.accountId;
    if (!accountId) {
      throw new Error("Compte LinkedIn non spécifié.");
    }
    const searchParams = new URLSearchParams({
      account_id: accountId,
      type: params.type,
      limit: String(params.limit || 20),
    });

    if (params.keywords) {
      searchParams.set("keywords", params.keywords.trim());
    }
    if (params.service) {
      searchParams.set("service", params.service);
    }

    const endpoint = `${BASE_URL}/api/v1/linkedin/search/parameters?${searchParams.toString()}`;
    const res = await unipileFetch(endpoint, {
      method: "GET",
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Unipile getSearchParameters error:", res.status, errorText);
      throw new Error(`Erreur Unipile paramètres (${res.status}): ${errorText}`);
    }

    const data: any = await res.json();
    return {
      items: data.items || [],
      pageCount: data.paging?.page_count || 0,
    };
  }

  /**
   * Recherche de profils LinkedIn avec pagination automatique :
   * Supporte les modes Classic et Sales Navigator (avec secteur d'activité et tranches d'effectif).
   * Boucle sur les curseurs Unipile pour accumuler exactement le nombre de profils demandés
   * (ex: 25, 50, 100 profils) au lieu de bloquer à 10 profils.
   */
  static async searchProfiles(params: {
    keywords?: string;
    location?: string;
    company?: string;
    title?: string;
    url?: string;
    limit?: number;
    accountId?: string;
    api?: "classic" | "sales_navigator";
    industry?: string[];
    companyHeadcount?: Array<{ min?: number; max?: number }>;
  }): Promise<{ items: LinkedInProfileResult[]; totalCount: number }> {
    const accountId = params.accountId;
    if (!accountId) {
      throw new Error("Compte LinkedIn non spécifié.");
    }
    const targetLimit = Math.min(Math.max(params.limit || 25, 1), 100);

    const accumulatedItems: LinkedInProfileResult[] = [];
    let currentCursor: string | null = null;
    let totalCount = 0;
    let iterations = 0;
    const maxIterations = Math.ceil(targetLimit / 10) + 1; // Sécurité anti-boucle infinie

    try {
      const endpoint = `${BASE_URL}/api/v1/linkedin/search?account_id=${accountId}`;

      while (accumulatedItems.length < targetLimit && iterations < maxIterations) {
        iterations++;

        let bodyPayload: any = {};

        if (currentCursor) {
          bodyPayload = { cursor: currentCursor };
        } else if (params.url && params.url.includes("linkedin.com")) {
          bodyPayload = { url: params.url.trim() };
        } else {
          const terms: string[] = [];
          if (params.title) terms.push(params.title.trim());
          if (params.company) terms.push(params.company.trim());
          if (params.location) terms.push(params.location.trim());
          if (params.keywords && !terms.includes(params.keywords.trim())) {
            terms.push(params.keywords.trim());
          }

          const combinedKeywords = terms.join(" ").trim();
          const apiMode = params.api === "sales_navigator" ? "sales_navigator" : "classic";

          if (apiMode === "sales_navigator") {
            bodyPayload = {
              api: "sales_navigator",
              category: "people",
              keywords: combinedKeywords || "business",
              limit: targetLimit,
              ...(params.industry && params.industry.length > 0
                ? { industry: { include: params.industry } }
                : {}),
              ...(params.companyHeadcount && params.companyHeadcount.length > 0
                ? { company_headcount: params.companyHeadcount }
                : {}),
            };
          } else {
            bodyPayload = {
              api: "classic",
              category: "people",
              keywords: combinedKeywords || "business",
              limit: targetLimit,
              ...(params.industry && params.industry.length > 0
                ? { industry: params.industry }
                : {}),
            };
          }
        }

        console.log(`Unipile search iteration ${iterations}:`, JSON.stringify(bodyPayload));

        const res = await unipileFetch(endpoint, {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify(bodyPayload),
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error("Unipile API error response:", res.status, errorText);
          break;
        }

        const data: any = await res.json();
        const rawItems = data.items || [];
        if (data.paging?.total_count) {
          totalCount = data.paging.total_count;
        }

        if (rawItems.length === 0) {
          break;
        }

        for (const item of rawItems) {
          if (accumulatedItems.length >= targetLimit) break;

          const rawName = (item.name || "").trim();
          let firstName = item.first_name || "";
          let lastName = item.last_name || "";

          if (!firstName && !lastName && rawName) {
            const parts = rawName.split(" ");
            firstName = parts[0] || "";
            lastName = parts.slice(1).join(" ") || "";
          }

          let linkedinUrl = item.public_profile_url || item.profile_url || "";
          if (linkedinUrl && !linkedinUrl.startsWith("http")) {
            linkedinUrl = `https://www.linkedin.com/in/${linkedinUrl}`;
          }

          const connectionStatus = UnipileService.parseLinkedInConnectionStatus(item);

          let companyName = "";
          if (item.current_positions && item.current_positions.length > 0) {
            companyName = item.current_positions[0].company || item.current_positions[0].name || "";
          }
          if (!companyName && item.headline) {
            companyName = extractCompanyFromHeadline(item.headline);
          }
          if (!companyName && params.company) {
            companyName = params.company;
          }

          const profileId = String(item.id || item.public_identifier || item.member_urn || Math.random());

          // Éviter les doublons dans l'agrégation
          if (!accumulatedItems.some((existing) => existing.providerProfileId === profileId)) {
            accumulatedItems.push({
              providerProfileId: profileId,
              firstName: firstName || "Contact",
              lastName: lastName || "LinkedIn",
              fullName: rawName || `${firstName} ${lastName}`.trim(),
              headline: item.headline || "Professionnel LinkedIn",
              company: companyName,
              location: item.location || params.location || "",
              linkedinUrl: linkedinUrl || `https://www.linkedin.com/in/${profileId}`,
              avatarUrl:
                item.profile_picture_url_large ||
                item.profile_picture_url ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(rawName || "LinkedIn")}&background=592eff&color=fff`,
              networkDistance: item.network_distance || "DISTANCE_2",
              connectionStatus,
              industry: item.industry || undefined,
            });
          }
        }

        // Vérifier s'il y a un curseur suivant
        if (data.cursor && data.cursor !== currentCursor) {
          currentCursor = data.cursor;
        } else {
          break;
        }
      }

      return {
        items: accumulatedItems,
        totalCount: Math.max(totalCount, accumulatedItems.length),
      };
    } catch (err: any) {
      console.error("Error in Unipile multi-page search:", err.message);
      return { items: accumulatedItems, totalCount: accumulatedItems.length };
    }
  }

  /**
   * Envoie une invitation de connexion LinkedIn (avec ou sans note personnalisée)
   * Doc Unipile : POST /api/v1/users/invite
   */
  static async sendInvitation(params: {
    accountId?: string;
    providerId: string;
    message?: string;
  }): Promise<{ success: boolean; invitationId?: string; error?: string }> {
    const accountId = params.accountId;
    if (!accountId) {
      return { success: false, error: "Compte LinkedIn non spécifié." };
    }
    try {
      const body: any = {
        account_id: accountId,
        provider_id: params.providerId,
      };
      if (params.message && params.message.trim().length > 0) {
        body.message = params.message.trim().substring(0, 300); // Limite LinkedIn 300 car.
      }

      console.log(`[Unipile] Sending invitation to ${params.providerId} with account ${accountId}...`);
      const res = await unipileFetch(`${BASE_URL}/api/v1/users/invite`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[Unipile] Error sending invite (${res.status}):`, errText);
        return { success: false, error: errText || res.statusText };
      }

      const data: any = await res.json();
      return {
        success: true,
        invitationId: data.invitation_id || "sent",
      };
    } catch (err: any) {
      console.error("[Unipile] Exception in sendInvitation:", err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Envoie un message direct LinkedIn à un contact
   * Doc Unipile : POST /api/v1/chats
   */
  static async sendMessage(params: {
    accountId?: string;
    attendeeId: string;
    text: string;
  }): Promise<{ success: boolean; chatId?: string; messageId?: string; error?: string }> {
    const accountId = params.accountId;
    if (!accountId) {
      return { success: false, error: "Compte LinkedIn non spécifié." };
    }
    try {
      const body = {
        account_id: accountId,
        text: params.text,
        attendees_ids: [params.attendeeId],
      };

      console.log(`[Unipile] Sending message to attendee ${params.attendeeId} with account ${accountId}...`);
      const res = await unipileFetch(`${BASE_URL}/api/v1/chats`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[Unipile] Error sending message (${res.status}):`, errText);
        return { success: false, error: errText || res.statusText };
      }

      const data: any = await res.json();
      return {
        success: true,
        chatId: data.chat_id || data.id,
        messageId: data.message_id,
      };
    } catch (err: any) {
      console.error("[Unipile] Exception in sendMessage:", err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Récupère les détails d'un profil LinkedIn et son statut de connexion
   * Doc Unipile : GET /api/v1/users/{identifier}
   */
  static async getProfile(params: {
    accountId?: string;
    identifier: string;
  }): Promise<{ success: boolean; profile?: any; error?: string }> {
    const accountId = params.accountId;
    if (!accountId) {
      return { success: false, error: "Compte LinkedIn non spécifié." };
    }
    try {
      let identifier = (params.identifier || "").trim();
      if (identifier.includes("linkedin.com/in/")) {
        identifier = identifier.split("linkedin.com/in/")[1].split("/")[0].split("?")[0];
      }

      const url = `${this.getBaseUrl()}/api/v1/users/${encodeURIComponent(identifier)}?account_id=${accountId}&linkedin_sections=*`;
      const res = await unipileFetch(url, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, error: errText || res.statusText };
      }

      const profile = await res.json();
      return { success: true, profile };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Récupère la liste des relations (connexions au 1er degré)
   * Doc Unipile : GET /api/v1/users/relations
   */
  static async getRelations(params: {
    accountId?: string;
    limit?: number;
  }): Promise<{ success: boolean; items: any[]; error?: string }> {
    const accountId = params.accountId;
    if (!accountId) {
      return { success: false, items: [], error: "Compte LinkedIn non spécifié." };
    }
    try {
      const limit = params.limit || 100;
      const url = `${BASE_URL}/api/v1/users/relations?account_id=${accountId}&limit=${limit}`;
      const res = await unipileFetch(url, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, items: [], error: errText || res.statusText };
      }

      const data: any = await res.json();
      return { success: true, items: data.items || [] };
    } catch (err: any) {
      return { success: false, items: [], error: err.message };
    }
  }

  /**
   * Visite un profil LinkedIn (déclenche la notification de vue de profil chez le prospect)
   * Doc Unipile : GET /api/v1/users/{identifier}?account_id=...&notify=true
   */
  static async visitProfile(params: {
    accountId?: string;
    identifier: string;
  }): Promise<{ success: boolean; profile?: any; error?: string }> {
    return this.getProfile(params);
  }

  /**
   * Suit un profil LinkedIn via la route Unipile Magic Route
   * Doc Unipile : POST /api/v1/linkedin
   * body: { patch: { "$set": { following: true } } }
   * request_url: "https://www.linkedin.com/voyager/api/feed/dash/followingStates/urn:li:fsd_followingState:urn:li:fsd_profile:{providerId}"
   */
  static async followProfile(params: {
    accountId?: string;
    providerId: string;
  }): Promise<{ success: boolean; error?: string }> {
    const accountId = params.accountId;
    if (!accountId) {
      return { success: false, error: "Compte LinkedIn non spécifié." };
    }
    try {
      const url = `${BASE_URL}/api/v1/linkedin`;
      const res = await unipileFetch(url, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          account_id: accountId,
          method: "POST",
          request_url: `https://www.linkedin.com/voyager/api/feed/dash/followingStates/urn:li:fsd_followingState:urn:li:fsd_profile:${params.providerId}`,
          body: { patch: { "$set": { following: true } } },
          encoding: false,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, error: errText || res.statusText };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Récupère la liste des conversations (chats) LinkedIn
   * Doc Unipile : GET /api/v1/chats?account_id=...&limit=...
   */
  static async getChats(params: {
    accountId?: string;
    limit?: number;
    cursor?: string;
    unread?: boolean;
    before?: string;
    after?: string;
  }): Promise<{ success: boolean; items: any[]; cursor?: string; error?: string }> {
    const accountId = params.accountId;
    if (!accountId) {
      return { success: false, items: [], error: "Compte LinkedIn non spécifié." };
    }
    try {
      const limit = params.limit || 50;
      let url = `${BASE_URL}/api/v1/chats?account_id=${accountId}&limit=${limit}`;
      if (params.cursor) url += `&cursor=${encodeURIComponent(params.cursor)}`;
      if (params.unread) url += `&unread=true`;
      if (params.before) url += `&before=${encodeURIComponent(params.before)}`;
      if (params.after) url += `&after=${encodeURIComponent(params.after)}`;

      const res = await unipileFetch(url, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, items: [], error: this.parseErrorResponse(res.status, errText) };
      }

      const data: any = await res.json();
      return {
        success: true,
        items: data.items || [],
        cursor: data.cursor,
      };
    } catch (err: any) {
      return { success: false, items: [], error: err.message };
    }
  }

  /**
   * Récupère les participants d'une conversation
   * Doc Unipile : GET /api/v1/chats/{chat_id}/attendees
   */
  static async getChatAttendees(chatId: string): Promise<{ success: boolean; items: any[]; error?: string }> {
    try {
      const url = `${BASE_URL}/api/v1/chats/${chatId}/attendees`;
      const res = await unipileFetch(url, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!res.ok) {
        return { success: false, items: [] };
      }

      const data: any = await res.json();
      return {
        success: true,
        items: data.items || data || [],
      };
    } catch (err: any) {
      return { success: false, items: [], error: err.message };
    }
  }

  /**
   * Récupère l'historique des messages d'une conversation
   * Doc Unipile : GET /api/v1/chats/{chat_id}/messages?limit=...
   */
  static async getChatMessages(params: {
    chatId: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ success: boolean; items: any[]; cursor?: string; error?: string }> {
    try {
      const limit = params.limit || 50;
      let url = `${BASE_URL}/api/v1/chats/${params.chatId}/messages?limit=${limit}`;
      if (params.cursor) url += `&cursor=${encodeURIComponent(params.cursor)}`;

      const res = await unipileFetch(url, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, items: [], error: errText || res.statusText };
      }

      const data: any = await res.json();
      return {
        success: true,
        items: data.items || [],
        cursor: data.cursor,
      };
    } catch (err: any) {
      return { success: false, items: [], error: err.message };
    }
  }

  /**
   * Envoie un message dans une conversation existante
   * Doc Unipile : POST /api/v1/chats/{chat_id}/messages
   */
  static async sendChatMessage(params: {
    chatId: string;
    text: string;
    attachments?: any[];
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const url = `${BASE_URL}/api/v1/chats/${params.chatId}/messages`;
      const body: any = {
        text: params.text,
      };
      if (params.attachments && params.attachments.length > 0) {
        body.attachments = params.attachments;
      }

      const res = await unipileFetch(url, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, error: this.parseErrorResponse(res.status, errText) };
      }

      const data: any = await res.json();
      return {
        success: true,
        messageId: data.id || data.message_id,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Marque une conversation comme lue sur LinkedIn
   * Doc Unipile : PATCH /api/v1/chats/{chat_id}
   */
  static async markChatAsRead(chatId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const url = `${BASE_URL}/api/v1/chats/${chatId}`;
      const res = await unipileFetch(url, {
        method: "PATCH",
        headers: this.getHeaders(),
        body: JSON.stringify({
          action: "setReadStatus",
          value: false,
          unread: false,
        }),
      });

      if (!res.ok) {
        return { success: false };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Démarre une nouvelle conversation avec un destinataire
   * Doc Unipile : POST /api/v1/chats
   */
  static async startChat(params: {
    accountId?: string;
    attendeeId: string;
    text: string;
  }): Promise<{ success: boolean; chatId?: string; error?: string }> {
    const accountId = params.accountId;
    if (!accountId) {
      return { success: false, error: "Compte LinkedIn non spécifié." };
    }
    try {
      const url = `${BASE_URL}/api/v1/chats`;
      const res = await unipileFetch(url, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          account_id: accountId,
          attendees_ids: [params.attendeeId],
          text: params.text,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, error: this.parseErrorResponse(res.status, errText) };
      }

      const data: any = await res.json();
      return {
        success: true,
        chatId: data.id || data.chat_id,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Analyse toutes les variantes de statut de relation renvoyées par les APIs Unipile / LinkedIn
   * (DISTANCE_1, FIRST_DEGREE, is_relationship: true, 1st, FIRST, etc.)
   */
  static parseLinkedInConnectionStatus(item: any): "CONNECTED" | "PENDING" | "NOT_CONNECTED" {
    if (!item) return "NOT_CONNECTED";

    if (item.is_relationship === true || item.is_self === true) {
      return "CONNECTED";
    }

    const dist = String(
      item.network_distance || item.networkDistance || item.distance || ""
    ).toUpperCase();

    if (
      dist === "DISTANCE_1" ||
      dist === "FIRST_DEGREE" ||
      dist === "FIRST" ||
      dist === "1ST" ||
      dist === "SELF" ||
      dist === "1"
    ) {
      return "CONNECTED";
    }

    if (
      item.pending_invitation === true ||
      dist === "PENDING" ||
      dist === "INVITATION_SENT" ||
      dist === "OUTGOING_REQUEST"
    ) {
      return "PENDING";
    }

    return "NOT_CONNECTED";
  }

  /**
   * Récupère le profil complet d'un prospect sur LinkedIn via Unipile (avec statut de connexion réel)
   */
  static async getProfileDetailsAndStatus(identifierOrUrl: string, accountId: string): Promise<{
    success: boolean;
    connectionStatus: "CONNECTED" | "PENDING" | "NOT_CONNECTED";
    profile?: {
      providerProfileId?: string;
      firstName?: string;
      lastName?: string;
      fullName?: string;
      avatarUrl?: string;
      headline?: string;
      company?: string;
      location?: string;
      email?: string;
      phone?: string;
    };
  }> {
    try {
      // Nettoyer l'identifiant (extraire 'gnakourijl' depuis 'https://www.linkedin.com/in/gnakourijl/')
      let identifier = identifierOrUrl.trim();
      if (identifier.includes("linkedin.com/in/")) {
        identifier = identifier.split("linkedin.com/in/")[1].split("/")[0].split("?")[0];
      }

      const res = await unipileFetch(`${BASE_URL}/api/v1/users/${encodeURIComponent(identifier)}?account_id=${accountId}&linkedin_sections=*`, {
        headers: this.getHeaders(),
      });

      if (!res.ok) {
        return { success: false, connectionStatus: "NOT_CONNECTED" };
      }

      const data: any = await res.json();
      const connectionStatus = this.parseLinkedInConnectionStatus(data);

      const email =
        data?.contact_info?.emails?.[0]?.address ||
        data?.contact_info?.emails?.[0] ||
        data?.email ||
        undefined;

      const rawPhone =
        data?.contact_info?.phones?.[0]?.number ||
        data?.contact_info?.phones?.[0] ||
        data?.contact_info?.phone_numbers?.[0]?.number ||
        data?.contact_info?.phone_numbers?.[0] ||
        data?.phone ||
        undefined;
      const phone = typeof rawPhone === "string" ? rawPhone.trim() : rawPhone ? String(rawPhone) : undefined;

      const company = data?.experience?.[0]?.company_name || data?.company || undefined;

      return {
        success: true,
        connectionStatus,
        profile: {
          providerProfileId: data?.provider_id || data?.member_urn || identifier,
          firstName: data?.first_name?.trim(),
          lastName: data?.last_name?.trim(),
          fullName: `${data?.first_name || ""} ${data?.last_name || ""}`.trim(),
          avatarUrl: data?.profile_picture_url_large || data?.profile_picture_url || undefined,
          headline: data?.headline || data?.occupation || undefined,
          company,
          location: data?.location || undefined,
          email,
          phone,
        },
      };
    } catch (err: any) {
      console.error("[Unipile] getProfileDetailsAndStatus error:", err.message);
      return { success: false, connectionStatus: "NOT_CONNECTED" };
    }
  }
}
