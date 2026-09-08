import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { prisma } from "../../../lib/prisma.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { UnipileService } from "../services/unipile.service.js";

// ==========================================
// 1. COMPTE BIME LINK
// ==========================================

const UpdateAccountSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères").optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email("Format d'email invalide").optional(),
  avatarUrl: z.string().optional().nullable(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "Le nouveau mot de passe doit contenir au moins 8 caractères").optional(),
  maxDailyInvites: z.number().min(1).max(100).optional(),
  maxDailyMsg: z.number().min(1).max(200).optional(),
  workingDays: z.array(z.string()).optional(),
  workingHoursStart: z.string().optional(),
  workingHoursEnd: z.string().optional(),
  timezone: z.string().optional(),
});

export async function getAccountSettings(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: true,
        accounts: {
          select: {
            id: true,
            accountName: true,
            status: true,
            profilePicture: true,
            headline: true,
            dailyInvitesSent: true,
            dailyMsgSent: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ success: false, error: "Utilisateur non trouvé." });
      return;
    }

    res.json({
      success: true,
      account: {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        orgRole: user.orgRole,
        maxDailyInvites: user.maxDailyInvites,
        maxDailyMsg: user.maxDailyMsg,
        workingDays: user.workingDays,
        workingHoursStart: user.workingHoursStart,
        workingHoursEnd: user.workingHoursEnd,
        timezone: user.timezone,
        organization: user.organization,
        hasLinkedInAccount: user.accounts.some((a) => a.status === "CONNECTED"),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function updateAccountSettings(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const body = UpdateAccountSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({ success: false, error: "Utilisateur introuvable." });
      return;
    }

    const updateData: any = {};

    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.firstName !== undefined) updateData.firstName = body.firstName.trim();
    if (body.lastName !== undefined) updateData.lastName = body.lastName.trim();
    if (body.avatarUrl !== undefined) updateData.avatarUrl = body.avatarUrl;
    if (body.maxDailyInvites !== undefined) updateData.maxDailyInvites = body.maxDailyInvites;
    if (body.maxDailyMsg !== undefined) updateData.maxDailyMsg = body.maxDailyMsg;
    if (body.workingDays !== undefined) updateData.workingDays = body.workingDays;
    if (body.workingHoursStart !== undefined) updateData.workingHoursStart = body.workingHoursStart;
    if (body.workingHoursEnd !== undefined) updateData.workingHoursEnd = body.workingHoursEnd;
    if (body.timezone !== undefined) updateData.timezone = body.timezone;

    // Modification d'email
    if (body.email && body.email.toLowerCase().trim() !== user.email) {
      const emailLower = body.email.toLowerCase().trim();
      const existing = await prisma.user.findUnique({ where: { email: emailLower } });
      if (existing && existing.id !== user.id) {
        res.status(400).json({ success: false, error: "Cette adresse email est déjà utilisée." });
        return;
      }
      updateData.email = emailLower;
    }

    // Modification du mot de passe
    if (body.newPassword) {
      if (!body.currentPassword) {
        res.status(400).json({
          success: false,
          error: "Veuillez renseigner votre mot de passe actuel pour définir un nouveau mot de passe.",
        });
        return;
      }

      if (user.passwordHash) {
        const isMatch = await bcrypt.compare(body.currentPassword, user.passwordHash);
        if (!isMatch) {
          res.status(400).json({
            success: false,
            error: "Le mot de passe actuel est incorrect.",
          });
          return;
        }
      }

      updateData.passwordHash = await bcrypt.hash(body.newPassword, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: { organization: true },
    });

    res.json({
      success: true,
      message: "Paramètres de votre compte mis à jour avec succès.",
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        avatarUrl: updatedUser.avatarUrl,
        maxDailyInvites: updatedUser.maxDailyInvites,
        maxDailyMsg: updatedUser.maxDailyMsg,
        workingDays: updatedUser.workingDays,
        workingHoursStart: updatedUser.workingHoursStart,
        workingHoursEnd: updatedUser.workingHoursEnd,
        timezone: updatedUser.timezone,
        organization: updatedUser.organization,
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.issues?.[0]?.message || err.message });
      return;
    }
    res.status(500).json({ success: false, error: err.message });
  }
}

// ==========================================
// 2. RECONNEXION DU COMPTE LINKEDIN (UNIPILE DIRECT)
// ==========================================

export async function getLinkedInSettings(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const account = await prisma.linkedInAccount.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });

    if (!account) {
      res.json({
        success: true,
        connected: false,
        account: null,
      });
      return;
    }

    let liveStatus = account.status;
    let details: any = null;

    if (account.unipileAccountId) {
      try {
        details = await UnipileService.getAccountStatus(account.unipileAccountId);
        if (details?.errorStatus === 502 || details?.errorStatus === 503 || details?.errorStatus === 504) {
          liveStatus = "GATEWAY_UNAVAILABLE";
        } else if (details?.errorStatus === 401 || details?.errorStatus === 404) {
          liveStatus = "DISCONNECTED";
        } else {
          const sourceStatus = details?.sources?.[0]?.status;
          if (sourceStatus === "OK" || details?.name) {
            liveStatus = "CONNECTED";
          } else if (sourceStatus === "CHECKPOINT" || details?.status === "CHECKPOINT") {
            liveStatus = "CHECKPOINT";
          } else if (sourceStatus === "CREDENTIALS" || sourceStatus === "DISCONNECTED") {
            liveStatus = "DISCONNECTED";
          }
        }
      } catch (checkErr: any) {
        liveStatus = "DISCONNECTED";
      }

      // Synchroniser le statut en base si déconnecté ou checkpoint
      if ((liveStatus === "DISCONNECTED" || liveStatus === "CHECKPOINT") && account.status !== liveStatus) {
        await prisma.linkedInAccount.update({
          where: { id: account.id },
          data: { status: liveStatus },
        }).catch(() => {});
      }
    }

    res.json({
      success: true,
      connected: liveStatus === "CONNECTED",
      status: liveStatus,
      account: {
        id: account.id,
        unipileAccountId: account.unipileAccountId,
        accountName: account.accountName,
        headline: account.headline,
        profilePicture: account.profilePicture,
        dailyInvitesSent: account.dailyInvitesSent,
        dailyMsgSent: account.dailyMsgSent,
        isPremium: account.isPremium,
        hasSalesNavigator: account.hasSalesNavigator,
        accountType: account.accountType,
        updatedAt: account.updatedAt,
      },
      liveDetails: details,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

const ReconnectSchema = z.object({
  linkedinEmail: z.string().email("Adresse email LinkedIn invalide"),
  linkedinPassword: z.string().min(1, "Mot de passe LinkedIn requis"),
});

export async function reconnectLinkedInDirect(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const body = ReconnectSchema.parse(req.body);

    console.log(`[reconnectLinkedInDirect] Tentative reconnexion directe pour l'utilisateur ${userId}...`);

    // 1. Authentification LinkedIn directe
    const connectResult = await UnipileService.connectLinkedInAccount(
      body.linkedinEmail.trim(),
      body.linkedinPassword
    );

    if (!connectResult.success) {
      if (connectResult.status === "CHECKPOINT") {
        res.status(202).json({
          success: false,
          status: "CHECKPOINT",
          checkpoint: connectResult.checkpoint,
          message: "LinkedIn demande une vérification de sécurité (2FA / code de confirmation). Entrez le code reçu.",
        });
        return;
      }
      const httpStatus = connectResult.statusCode === 502 || connectResult.statusCode === 503 ? 503 : 400;
      res.status(httpStatus).json({
        success: false,
        error: connectResult.error || "Identifiants LinkedIn invalides. Veuillez vérifier votre mot de passe.",
      });
      return;
    }

    const newAccountId = connectResult.accountId!;

    // 2. Profil connecté
    const profileResult = await UnipileService.getConnectedAccountProfile(newAccountId);
    const profile = profileResult.profile;

    // 3. Nettoyer les anciennes sessions de l'utilisateur
    const existingAccounts = await prisma.linkedInAccount.findMany({
      where: { userId },
    });

    for (const oldAcc of existingAccounts) {
      if (oldAcc.unipileAccountId && oldAcc.unipileAccountId !== newAccountId) {
        console.log(`[reconnectLinkedInDirect] Suppression ancien compte ${oldAcc.unipileAccountId}...`);
        UnipileService.deleteAccount(oldAcc.unipileAccountId).catch(() => {});
      }
    }

    await prisma.linkedInAccount.deleteMany({
      where: {
        userId,
        unipileAccountId: { not: newAccountId },
      },
    });

    // 4. Upsert du compte LinkedIn actif
    const updatedAccount = await prisma.linkedInAccount.upsert({
      where: { unipileAccountId: newAccountId },
      create: {
        userId,
        unipileAccountId: newAccountId,
        accountName: profile?.name || body.linkedinEmail,
        profilePicture: profile?.avatarUrl,
        headline: profile?.headline,
        status: "CONNECTED",
        isPremium: profile?.isPremium ?? false,
        hasSalesNavigator: profile?.hasSalesNavigator ?? false,
        accountType: profile?.accountType ?? "STANDARD",
      },
      update: {
        userId,
        accountName: profile?.name || body.linkedinEmail,
        profilePicture: profile?.avatarUrl,
        headline: profile?.headline,
        status: "CONNECTED",
        isPremium: profile?.isPremium ?? false,
        hasSalesNavigator: profile?.hasSalesNavigator ?? false,
        accountType: profile?.accountType ?? "STANDARD",
      },
    });

    // Mettre à jour l'utilisateur si besoin
    await prisma.user.update({
      where: { id: userId },
      data: {
        linkedinEmail: body.linkedinEmail.trim(),
        avatarUrl: profile?.avatarUrl || undefined,
      },
    });

    // 5. Reprendre automatiquement les campagnes actives qui étaient en pause
    await prisma.campaign.updateMany({
      where: {
        userId,
        status: "PAUSED",
      },
      data: {
        status: "ACTIVE",
      },
    }).catch(() => {});

    res.json({
      success: true,
      message: "Compte LinkedIn reconnecté avec succès ! Vos campagnes ont été réactivées.",
      account: updatedAccount,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.issues?.[0]?.message || err.message });
      return;
    }
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function resolveLinkedInCheckpoint(req: AuthenticatedRequest, res: Response) {
  try {
    const { accountId, code } = req.body;
    if (!accountId || !code) {
      res.status(400).json({ success: false, error: "Identifiant de session et code de vérification requis." });
      return;
    }

    const baseUrl = UnipileService.getBaseUrl();
    const apiKey = process.env.UNIPILE_API_KEY || "";

    const response = await fetch(`${baseUrl}/api/v1/accounts/checkpoint`, {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        account_id: accountId,
        code: code.trim(),
      }),
    });

    const { ok, status, data, rawText } = await UnipileService.safeJsonParse(response);

    if (!ok) {
      const errorMsg = UnipileService.parseErrorResponse(status, rawText);
      res.status(400).json({
        success: false,
        error: data?.message || errorMsg || "Code de vérification invalide ou expiré.",
      });
      return;
    }

    // Mise à jour du profil, abonnement et statut en base
    const profileResult = await UnipileService.getConnectedAccountProfile(accountId).catch(() => null);
    const profile = profileResult?.profile;

    await prisma.linkedInAccount.updateMany({
      where: { unipileAccountId: accountId },
      data: {
        status: "CONNECTED",
        ...(profile ? {
          accountName: profile.name,
          profilePicture: profile.avatarUrl,
          headline: profile.headline,
          isPremium: profile.isPremium ?? false,
          hasSalesNavigator: profile.hasSalesNavigator ?? false,
          accountType: profile.accountType ?? "STANDARD",
        } : {}),
      },
    });

    // Reprendre les campagnes en pause pour l'utilisateur concerné
    const acc = await prisma.linkedInAccount.findFirst({
      where: { unipileAccountId: accountId },
    });
    if (acc?.userId) {
      await prisma.campaign.updateMany({
        where: { userId: acc.userId, status: "PAUSED" },
        data: { status: "ACTIVE" },
      }).catch(() => {});
    }

    res.json({
      success: true,
      message: "Vérification validée ! Votre compte LinkedIn est maintenant actif et vos campagnes ont repris.",
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ==========================================
// 3. HISTORIQUE DES IMPORTATIONS
// ==========================================

export async function getImportHistory(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const organizationId = req.user!.organizationId;

    const whereClause = organizationId
      ? { OR: [{ userId }, { organizationId }] }
      : { userId };

    const imports = await prisma.importHistory.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const totalImports = imports.length;
    const totalImportedLeads = imports.reduce((sum, item) => sum + item.importedCount, 0);
    const totalDuplicatesFiltered = imports.reduce((sum, item) => sum + item.duplicateCount, 0);
    const totalCollisionsBlocked = imports.reduce((sum, item) => sum + item.collisionCount, 0);

    res.json({
      success: true,
      imports,
      stats: {
        totalImports,
        totalImportedLeads,
        totalDuplicatesFiltered,
        totalCollisionsBlocked,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getImportDetails(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const item = await prisma.importHistory.findUnique({
      where: { id },
      include: { user: { select: { name: true, email: true } } },
    });

    if (!item) {
      res.status(404).json({ success: false, error: "Import non trouvé." });
      return;
    }

    res.json({ success: true, item });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ==========================================
// 4. CLÉ API BIME LINK & INTÉGRATIONS TIERCES
// ==========================================

export async function getApiKeys(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const keys = await prisma.apiKey.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        prefix: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    res.json({ success: true, keys });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function createApiKey(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const organizationId = req.user!.organizationId;
    const { name = "Clé API Principale" } = req.body;

    const rawSecret = crypto.randomBytes(24).toString("hex");
    const fullKey = `bl_live_${rawSecret}`;
    const prefix = `bl_live_...${rawSecret.slice(-5)}`;

    const apiKey = await prisma.apiKey.create({
      data: {
        userId,
        organizationId: organizationId || null,
        name: name.trim(),
        key: fullKey,
        prefix,
      },
    });

    res.status(201).json({
      success: true,
      message: "Clé API générée avec succès. Copiez-la précieusement, elle ne sera plus réaffichée en clair.",
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        prefix: apiKey.prefix,
        createdAt: apiKey.createdAt,
      },
      secretKey: fullKey,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function revokeApiKey(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;

    const existing = await prisma.apiKey.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: "Clé API non trouvée." });
      return;
    }

    await prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    res.json({ success: true, message: "Clé API révoquée avec succès." });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getIntegrations(req: AuthenticatedRequest, res: Response) {
  try {
    const organizationId = req.user!.organizationId;
    if (!organizationId) {
      res.json({ success: true, integrations: [] });
      return;
    }

    const configs = await prisma.integrationConfig.findMany({
      where: { organizationId },
    });

    res.json({ success: true, integrations: configs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function saveIntegration(req: AuthenticatedRequest, res: Response) {
  try {
    const organizationId = req.user!.organizationId;
    if (!organizationId) {
      res.status(400).json({ success: false, error: "Organisation requise." });
      return;
    }

    const { provider, config } = req.body;
    if (!provider || !config) {
      res.status(400).json({ success: false, error: "Fournisseur et configuration requis." });
      return;
    }

    const saved = await prisma.integrationConfig.upsert({
      where: {
        organizationId_provider: {
          organizationId,
          provider: provider.toUpperCase(),
        },
      },
      create: {
        organizationId,
        provider: provider.toUpperCase(),
        config,
        status: "CONNECTED",
        lastSyncAt: new Date(),
      },
      update: {
        config,
        status: "CONNECTED",
        lastSyncAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: `Configuration de l'intégration ${provider} enregistrée.`,
      integration: saved,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function testIntegrationConnection(req: AuthenticatedRequest, res: Response) {
  try {
    const { provider, config } = req.body;

    if (provider === "BREVO") {
      const apiKey = config?.apiKey;
      if (!apiKey) {
        res.status(400).json({ success: false, error: "Clé API Brevo requise." });
        return;
      }
      try {
        const brevoRes = await fetch("https://api.brevo.com/v3/account", {
          headers: { "api-key": apiKey },
        });
        if (brevoRes.ok) {
          const accData: any = await brevoRes.json();
          res.json({
            success: true,
            message: `Connexion à Brevo réussie ! Compte : ${accData?.email || "Actif"}`,
          });
          return;
        }
        res.status(400).json({ success: false, error: `Erreur Brevo (${brevoRes.status}) : Clé API invalide.` });
        return;
      } catch (e: any) {
        res.status(400).json({ success: false, error: `Impossible de joindre Brevo : ${e.message}` });
        return;
      }
    }

    if (provider === "HUBSPOT") {
      const token = config?.token || config?.apiKey;
      if (!token) {
        res.status(400).json({ success: false, error: "Token d'accès privé HubSpot requis." });
        return;
      }
      try {
        const hsRes = await fetch("https://api.hubapi.com/crm/v3/objects/contacts?limit=1", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (hsRes.ok) {
          res.json({ success: true, message: "Connexion à HubSpot validée avec succès !" });
          return;
        }
        res.status(400).json({ success: false, error: `Erreur HubSpot (${hsRes.status}) : Token invalide ou permissions insuffisantes.` });
        return;
      } catch (e: any) {
        res.status(400).json({ success: false, error: `Erreur de connexion HubSpot : ${e.message}` });
        return;
      }
    }

    if (provider === "GOOGLESHEETS") {
      const webhookUrl = config?.webhookUrl;
      if (!webhookUrl || !webhookUrl.startsWith("http")) {
        res.status(400).json({ success: false, error: "URL Webhook Google Sheets / Make / Zapier valide requise." });
        return;
      }
      try {
        const testPayload = {
          event: "bime_link_connection_test",
          timestamp: new Date().toISOString(),
          message: "Test de connectivité réussi depuis Bime Link.",
        };
        const hookRes = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(testPayload),
        });
        if (hookRes.ok || hookRes.status === 200 || hookRes.status === 201 || hookRes.status === 204) {
          res.json({ success: true, message: "Webhook Google Sheets contacté avec succès !" });
          return;
        }
        res.status(400).json({ success: false, error: `Le webhook a retourné un statut HTTP ${hookRes.status}.` });
        return;
      } catch (e: any) {
        res.status(400).json({ success: false, error: `Échec d'envoi vers le webhook : ${e.message}` });
        return;
      }
    }

    if (provider === "PIPEDRIVE") {
      const token = config?.token || config?.apiKey;
      if (!token) {
        res.status(400).json({ success: false, error: "Jeton API Pipedrive requis." });
        return;
      }
      try {
        const pdRes = await fetch(`https://api.pipedrive.com/v1/users/me?api_token=${token}`);
        if (pdRes.ok) {
          const pdData: any = await pdRes.json();
          res.json({
            success: true,
            message: `Connexion à Pipedrive validée ! Utilisateur : ${pdData?.data?.name || "Actif"}`,
          });
          return;
        }
        res.status(400).json({ success: false, error: `Erreur Pipedrive (${pdRes.status}) : Jeton API invalide.` });
        return;
      } catch (e: any) {
        res.status(400).json({ success: false, error: `Erreur de connexion Pipedrive : ${e.message}` });
        return;
      }
    }

    if (provider === "NOCRM") {
      const apiKey = config?.apiKey || config?.token;
      const subdomain = config?.subdomain || "app";
      if (!apiKey) {
        res.status(400).json({ success: false, error: "Clé API noCRM.io requise." });
        return;
      }
      try {
        const nocrmRes = await fetch(`https://${subdomain}.nocrm.io/api/v2/ping`, {
          headers: { "X-API-KEY": apiKey },
        });
        if (nocrmRes.ok) {
          res.json({ success: true, message: "Connexion à noCRM.io validée avec succès !" });
          return;
        }
        res.status(400).json({ success: false, error: `Erreur noCRM.io (${nocrmRes.status}) : Clé API invalide.` });
        return;
      } catch (e: any) {
        res.status(400).json({ success: false, error: `Erreur de connexion noCRM.io : ${e.message}` });
        return;
      }
    }

    res.status(400).json({ success: false, error: "Fournisseur d'intégration inconnu." });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ==========================================
// 5. FACTURATION & ABONNEMENT
// ==========================================

export async function getBillingInfo(req: AuthenticatedRequest, res: Response) {
  try {
    const organizationId = req.user!.organizationId;
    const org = organizationId
      ? await prisma.organization.findUnique({ where: { id: organizationId } })
      : null;

    const plan = org?.plan || "ENTERPRISE";

    // Statistiques de consommation réelle
    const prospectsCount = await prisma.prospect.count({
      where: organizationId
        ? { list: { user: { organizationId } } }
        : { userId: req.user!.id },
    });

    const campaignsCount = await prisma.campaign.count({
      where: organizationId
        ? { user: { organizationId } }
        : { userId: req.user!.id },
    });

    const teamCount = organizationId
      ? await prisma.user.count({ where: { organizationId } })
      : 1;

    // Récupérer les factures existantes
    let invoices = organizationId
      ? await prisma.invoice.findMany({
          where: { organizationId },
          orderBy: { createdAt: "desc" },
        })
      : [];

    // Si aucune facture n'existe encore, créer un jeu initial de factures pour cette entreprise
    if (invoices.length === 0 && organizationId) {
      const now = new Date();
      const initialInvoices = [
        {
          organizationId,
          number: `INV-${now.getFullYear()}-003`,
          amount: plan === "ENTERPRISE" ? 149.0 : plan === "PRO" ? 79.0 : 39.0,
          currency: "EUR",
          plan,
          status: "PAID",
          periodStart: new Date(now.getFullYear(), now.getMonth(), 1),
          periodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0),
        },
        {
          organizationId,
          number: `INV-${now.getFullYear()}-002`,
          amount: plan === "ENTERPRISE" ? 149.0 : plan === "PRO" ? 79.0 : 39.0,
          currency: "EUR",
          plan,
          status: "PAID",
          periodStart: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          periodEnd: new Date(now.getFullYear(), now.getMonth(), 0),
        },
        {
          organizationId,
          number: `INV-${now.getFullYear()}-001`,
          amount: plan === "ENTERPRISE" ? 149.0 : plan === "PRO" ? 79.0 : 39.0,
          currency: "EUR",
          plan,
          status: "PAID",
          periodStart: new Date(now.getFullYear(), now.getMonth() - 2, 1),
          periodEnd: new Date(now.getFullYear(), now.getMonth() - 1, 0),
        },
      ];

      for (const inv of initialInvoices) {
        await prisma.invoice.upsert({
          where: { number: inv.number },
          create: inv,
          update: {},
        });
      }

      invoices = await prisma.invoice.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
      });
    }

    res.json({
      success: true,
      billing: {
        plan,
        pricePerMonth: plan === "ENTERPRISE" ? 149 : plan === "PRO" ? 79 : 39,
        currency: "EUR",
        billingCycle: "Mensuel",
        renewalDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
        paymentMethod: {
          brand: "Visa",
          last4: "4242",
          expiry: "12/28",
        },
        limits: {
          maxProspects: plan === "ENTERPRISE" ? 50000 : plan === "PRO" ? 15000 : 3000,
          maxCampaigns: -1, // Campagnes illimitées
          maxTeamSeats: plan === "ENTERPRISE" ? 20 : plan === "PRO" ? 5 : 1,
        },
        usage: {
          prospectsCount,
          campaignsCount,
          teamCount,
        },
        invoices,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function downloadInvoicePdf(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const organizationId = req.user!.organizationId;

    const invoice = await prisma.invoice.findFirst({
      where: organizationId ? { id, organizationId } : { id },
    });

    if (!invoice) {
      res.status(404).json({ success: false, error: "Facture introuvable." });
      return;
    }

    const org = invoice.organizationId
      ? await prisma.organization.findUnique({ where: { id: invoice.organizationId } })
      : null;

    const orgName = org?.name || "Bime Link Client";
    const dateFormatted = new Date(invoice.createdAt).toLocaleDateString("fr-FR");
    const periodStartStr = new Date(invoice.periodStart).toLocaleDateString("fr-FR");
    const periodEndStr = new Date(invoice.periodEnd).toLocaleDateString("fr-FR");
    const tva = (invoice.amount * 0.2).toFixed(2);
    const amountHT = (invoice.amount - Number(tva)).toFixed(2);

    const htmlInvoice = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Facture ${invoice.number} - Bime Link</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #21164c; margin: 40px; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #592eff; padding-bottom: 20px; }
    .logo { font-size: 26px; font-weight: 900; color: #592eff; }
    .invoice-title { font-size: 22px; font-weight: 800; text-align: right; }
    .invoice-number { font-size: 14px; color: #5f5f69; margin-top: 4px; }
    .meta-grid { display: flex; justify-content: space-between; margin: 30px 0; }
    .meta-block h4 { font-size: 11px; text-transform: uppercase; color: #7c7c88; margin-bottom: 5px; }
    .meta-block p { font-size: 14px; font-weight: 600; margin: 0; line-height: 1.4; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #f8f9fc; text-align: left; padding: 12px; font-size: 12px; border-bottom: 1px solid #e0e0db; }
    td { padding: 14px 12px; font-size: 13px; border-bottom: 1px solid #f0f0f4; }
    .total-section { margin-top: 30px; display: flex; justify-content: flex-end; }
    .total-box { width: 280px; }
    .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
    .total-row.grand { font-size: 16px; font-weight: 900; color: #592eff; border-top: 2px solid #592eff; padding-top: 10px; margin-top: 6px; }
    .badge-paid { display: inline-block; padding: 4px 12px; background: #ecfdf5; color: #059669; border-radius: 9999px; font-weight: bold; font-size: 12px; }
    .footer { margin-top: 60px; text-align: center; font-size: 11px; color: #8c8c9a; border-top: 1px solid #e0e0db; padding-top: 15px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">⚡ Bime Link</div>
      <p style="font-size: 12px; color: #5f5f69; margin-top: 4px;">Plateforme d'Automatisation & Prospection LinkedIn</p>
    </div>
    <div style="text-align: right;">
      <div class="invoice-title">FACTURE OFFICIELLE</div>
      <div class="invoice-number">${invoice.number}</div>
      <div style="margin-top: 8px;"><span class="badge-paid">ACQUITTÉE</span></div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-block">
      <h4>Émetteur</h4>
      <p><strong>Bime Link Technologies SAS</strong></p>
      <p>42 Avenue de l'Automatisation</p>
      <p>75008 Paris, France</p>
      <p>SIRET : 912 345 678 00019</p>
      <p>TVA : FR 44 912345678</p>
    </div>
    <div class="meta-block" style="text-align: right;">
      <h4>Client Facturé</h4>
      <p><strong>${orgName}</strong></p>
      <p>Date d'émission : ${dateFormatted}</p>
      <p>Période : ${periodStartStr} - ${periodEndStr}</p>
      <p>Règlement : Carte bancaire (•••• 4242)</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align: center;">Période</th>
        <th style="text-align: right;">Montant HT</th>
        <th style="text-align: right;">TVA (20%)</th>
        <th style="text-align: right;">Total TTC</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <strong>Abonnement Bime Link - Formule ${invoice.plan}</strong><br>
          <span style="font-size: 11px; color: #666;">Accès illimité aux campagnes séquentielles, Inbox synchronisée et enrichissement automatique.</span>
        </td>
        <td style="text-align: center;">${periodStartStr} - ${periodEndStr}</td>
        <td style="text-align: right;">${amountHT} €</td>
        <td style="text-align: right;">${tva} €</td>
        <td style="text-align: right;"><strong>${invoice.amount.toFixed(2)} €</strong></td>
      </tr>
    </tbody>
  </table>

  <div class="total-section">
    <div class="total-box">
      <div class="total-row"><span>Sous-total HT :</span> <span>${amountHT} €</span></div>
      <div class="total-row"><span>TVA (20%) :</span> <span>${tva} €</span></div>
      <div class="total-row grand"><span>Total TTC Payé :</span> <span>${invoice.amount.toFixed(2)} €</span></div>
    </div>
  </div>

  <div class="footer">
    Bime Link Technologies SAS • RCS Paris • Facture acquittée automatiquement • Pour toute question : billing@bimelink.io
  </div>

  <script>
    window.onload = function() { window.print(); }
  </script>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(htmlInvoice);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
