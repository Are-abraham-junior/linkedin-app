import "dotenv/config";

import { extractCompanyFromHeadline } from "../utils/companyExtractor.js";

const UNIPILE_DSN = process.env.UNIPILE_DSN || "https://api16.unipile.com:14623";
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY || "";
const UNIPILE_ACCOUNT_ID = process.env.UNIPILE_ACCOUNT_ID || "";

const BASE_URL = UNIPILE_DSN.replace(/\/$/, "");

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
}

export class UnipileService {
  private static getHeaders() {
    return {
      "X-API-KEY": UNIPILE_API_KEY,
      "Content-Type": "application/json",
      "Accept": "application/json",
    };
  }

  /**
   * Vérifie le statut du compte LinkedIn Unipile
   */
  static async getAccountStatus(accountId: string = UNIPILE_ACCOUNT_ID) {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/accounts/${accountId}`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) {
        throw new Error(`Unipile account error: ${res.statusText}`);
      }
      return await res.json();
    } catch (err: any) {
      console.error("Unipile getAccountStatus error:", err.message);
      return null;
    }
  }

  /**
   * Recherche de profils LinkedIn avec pagination automatique :
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
  }): Promise<{ items: LinkedInProfileResult[]; totalCount: number }> {
    const accountId = params.accountId || UNIPILE_ACCOUNT_ID;
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
          bodyPayload = {
            api: "classic",
            category: "people",
            keywords: combinedKeywords || "business",
            limit: targetLimit,
          };
        }

        console.log(`Unipile search iteration ${iterations}:`, JSON.stringify(bodyPayload));

        const res = await fetch(endpoint, {
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

          let connectionStatus: "NOT_CONNECTED" | "PENDING" | "CONNECTED" = "NOT_CONNECTED";
          if (item.network_distance === "DISTANCE_1") {
            connectionStatus = "CONNECTED";
          } else if (item.pending_invitation === true) {
            connectionStatus = "PENDING";
          }

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
    const accountId = params.accountId || UNIPILE_ACCOUNT_ID;
    try {
      const body: any = {
        account_id: accountId,
        provider_id: params.providerId,
      };
      if (params.message && params.message.trim().length > 0) {
        body.message = params.message.trim().substring(0, 300); // Limite LinkedIn 300 car.
      }

      console.log(`[Unipile] Sending invitation to ${params.providerId} with account ${accountId}...`);
      const res = await fetch(`${BASE_URL}/api/v1/users/invite`, {
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
    const accountId = params.accountId || UNIPILE_ACCOUNT_ID;
    try {
      const body = {
        account_id: accountId,
        text: params.text,
        attendees_ids: [params.attendeeId],
      };

      console.log(`[Unipile] Sending message to attendee ${params.attendeeId} with account ${accountId}...`);
      const res = await fetch(`${BASE_URL}/api/v1/chats`, {
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
    const accountId = params.accountId || UNIPILE_ACCOUNT_ID;
    try {
      const url = `${BASE_URL}/api/v1/users/${encodeURIComponent(params.identifier)}?account_id=${accountId}`;
      const res = await fetch(url, {
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
    const accountId = params.accountId || UNIPILE_ACCOUNT_ID;
    try {
      const limit = params.limit || 100;
      const url = `${BASE_URL}/api/v1/users/relations?account_id=${accountId}&limit=${limit}`;
      const res = await fetch(url, {
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
    const accountId = params.accountId || UNIPILE_ACCOUNT_ID;
    try {
      const url = `${BASE_URL}/api/v1/linkedin`;
      const res = await fetch(url, {
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
}
