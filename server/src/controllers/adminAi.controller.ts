import { Response } from "express";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { invalidateProviderCache, testAndRecord, toPublicProvider } from "../services/ai/provider.service.js";
import { normalizeBaseUrl, testProvider } from "../services/ai/ollama.client.js";
import { invalidateKnowledgeIndex, reseedKnowledge, SEED_DOCS } from "../services/ai/knowledge.service.js";

const ProviderSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(80),
  kind: z.enum(["OLLAMA", "OPENAI_COMPATIBLE"]).default("OLLAMA"),
  baseUrl: z
    .string()
    .trim()
    .url("URL invalide")
    .refine((u) => /^https?:\/\//i.test(u), "L'URL doit commencer par http(s)://"),
  apiKey: z.string().trim().optional(),
  model: z.string().trim().min(1, "Modèle requis").max(120),
  temperature: z.coerce.number().min(0).max(2).default(0.2),
  numCtx: z.coerce.number().int().min(2048).max(262144).default(16384),
  thinking: z.preprocess((v) => v === true || v === "true" || v === 1, z.boolean()).default(false),
});

function zodMessage(err: unknown): string | null {
  return err instanceof z.ZodError ? err.issues?.[0]?.message || "Données invalides." : null;
}

export async function listAiProviders(_req: AuthenticatedRequest, res: Response) {
  try {
    const providers = await prisma.aiProvider.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "asc" }] });
    res.json({ success: true, providers: providers.map(toPublicProvider) });
  } catch (err) {
    console.error("[adminAi:listAiProviders]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue." });
  }
}

export async function createAiProvider(req: AuthenticatedRequest, res: Response) {
  try {
    const body = ProviderSchema.parse(req.body);
    const count = await prisma.aiProvider.count();
    const provider = await prisma.aiProvider.create({
      data: {
        name: body.name,
        kind: body.kind,
        baseUrl: normalizeBaseUrl(body.baseUrl),
        apiKey: body.apiKey || null,
        model: body.model,
        temperature: body.temperature,
        numCtx: body.numCtx,
        thinking: body.thinking,
        isActive: count === 0,
      },
    });
    invalidateProviderCache();
    res.status(201).json({ success: true, provider: toPublicProvider(provider) });
  } catch (err) {
    const msg = zodMessage(err);
    if (msg) {
      res.status(400).json({ success: false, error: msg });
      return;
    }
    console.error("[adminAi:createAiProvider]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue." });
  }
}

export async function updateAiProvider(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const existing = await prisma.aiProvider.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: "Provider introuvable." });
      return;
    }
    const body = ProviderSchema.parse(req.body);
    const provider = await prisma.aiProvider.update({
      where: { id },
      data: {
        name: body.name,
        kind: body.kind,
        baseUrl: normalizeBaseUrl(body.baseUrl),
        // Champ vide = clé inchangée
        ...(body.apiKey ? { apiKey: body.apiKey } : {}),
        model: body.model,
        temperature: body.temperature,
        numCtx: body.numCtx,
        thinking: body.thinking,
        status: "UNTESTED",
        lastError: null,
      },
    });
    invalidateProviderCache();
    res.json({ success: true, provider: toPublicProvider(provider) });
  } catch (err) {
    const msg = zodMessage(err);
    if (msg) {
      res.status(400).json({ success: false, error: msg });
      return;
    }
    console.error("[adminAi:updateAiProvider]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue." });
  }
}

export async function deleteAiProvider(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const result = await prisma.aiProvider.deleteMany({ where: { id } });
    if (result.count === 0) {
      res.status(404).json({ success: false, error: "Provider introuvable." });
      return;
    }
    invalidateProviderCache();
    res.json({ success: true });
  } catch (err) {
    console.error("[adminAi:deleteAiProvider]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue." });
  }
}

export async function activateAiProvider(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const existing = await prisma.aiProvider.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: "Provider introuvable." });
      return;
    }
    await prisma.$transaction([
      prisma.aiProvider.updateMany({ where: { isActive: true }, data: { isActive: false } }),
      prisma.aiProvider.update({ where: { id }, data: { isActive: true } }),
    ]);
    invalidateProviderCache();
    res.json({ success: true });
  } catch (err) {
    console.error("[adminAi:activateAiProvider]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue." });
  }
}

/** Désactive le provider : plus aucun provider actif → Bleadin IA est indisponible pour tous les utilisateurs. */
export async function deactivateAiProvider(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const existing = await prisma.aiProvider.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: "Provider introuvable." });
      return;
    }
    await prisma.aiProvider.update({ where: { id }, data: { isActive: false } });
    invalidateProviderCache();
    res.json({ success: true });
  } catch (err) {
    console.error("[adminAi:deactivateAiProvider]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue." });
  }
}

/** Test d'une configuration non enregistrée (formulaire). */
export async function testAiProviderConfig(req: AuthenticatedRequest, res: Response) {
  try {
    const body = ProviderSchema.parse(req.body);
    let apiKey = body.apiKey || null;
    // Édition sans ressaisie de la clé : réutiliser celle stockée
    if (!apiKey && typeof req.body?.id === "string") {
      const existing = await prisma.aiProvider.findUnique({ where: { id: req.body.id } });
      apiKey = existing?.apiKey || null;
    }
    const result = await testProvider({ kind: body.kind, baseUrl: normalizeBaseUrl(body.baseUrl), apiKey, model: body.model, temperature: body.temperature });
    res.json({ success: true, result });
  } catch (err) {
    const msg = zodMessage(err);
    if (msg) {
      res.status(400).json({ success: false, error: msg });
      return;
    }
    console.error("[adminAi:testAiProviderConfig]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue." });
  }
}

export async function testAiProviderById(req: AuthenticatedRequest, res: Response) {
  try {
    const result = await testAndRecord(req.params.id as string);
    if (!result) {
      res.status(404).json({ success: false, error: "Provider introuvable." });
      return;
    }
    const provider = await prisma.aiProvider.findUnique({ where: { id: req.params.id as string } });
    res.json({ success: true, result, provider: provider ? toPublicProvider(provider) : null });
  } catch (err) {
    console.error("[adminAi:testAiProviderById]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue." });
  }
}

// ─── Base de connaissances ──────────────────────────────────────────────────

const KnowledgeSchema = z.object({
  title: z.string().trim().min(1, "Titre requis").max(150),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Le slug ne doit contenir que des minuscules, chiffres et tirets")
    .optional(),
  category: z.enum(["BLEADIN", "PROSPECTION", "REDACTION"]).default("BLEADIN"),
  content: z.string().min(1, "Contenu requis").max(60_000),
  isCore: z.coerce.boolean().default(false),
  enabled: z.coerce.boolean().default(true),
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function listKnowledgeDocs(_req: AuthenticatedRequest, res: Response) {
  try {
    const docs = await prisma.aiKnowledgeDoc.findMany({ orderBy: [{ category: "asc" }, { createdAt: "asc" }] });
    res.json({ success: true, docs, seedSlugs: SEED_DOCS.map((d) => d.slug) });
  } catch (err) {
    console.error("[adminAi:listKnowledgeDocs]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue." });
  }
}

export async function createKnowledgeDoc(req: AuthenticatedRequest, res: Response) {
  try {
    const body = KnowledgeSchema.parse(req.body);
    const slug = body.slug || slugify(body.title) || `doc-${Date.now()}`;
    const exists = await prisma.aiKnowledgeDoc.findUnique({ where: { slug } });
    if (exists) {
      res.status(409).json({ success: false, error: `Un document avec le slug « ${slug} » existe déjà.` });
      return;
    }
    const doc = await prisma.aiKnowledgeDoc.create({ data: { ...body, slug } });
    invalidateKnowledgeIndex();
    res.status(201).json({ success: true, doc });
  } catch (err) {
    const msg = zodMessage(err);
    if (msg) {
      res.status(400).json({ success: false, error: msg });
      return;
    }
    console.error("[adminAi:createKnowledgeDoc]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue." });
  }
}

export async function updateKnowledgeDoc(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const body = KnowledgeSchema.parse(req.body);
    const existing = await prisma.aiKnowledgeDoc.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: "Document introuvable." });
      return;
    }
    const doc = await prisma.aiKnowledgeDoc.update({
      where: { id },
      data: { title: body.title, category: body.category, content: body.content, isCore: body.isCore, enabled: body.enabled },
    });
    invalidateKnowledgeIndex();
    res.json({ success: true, doc });
  } catch (err) {
    const msg = zodMessage(err);
    if (msg) {
      res.status(400).json({ success: false, error: msg });
      return;
    }
    console.error("[adminAi:updateKnowledgeDoc]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue." });
  }
}

export async function deleteKnowledgeDoc(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const result = await prisma.aiKnowledgeDoc.deleteMany({ where: { id } });
    if (result.count === 0) {
      res.status(404).json({ success: false, error: "Document introuvable." });
      return;
    }
    invalidateKnowledgeIndex();
    res.json({ success: true });
  } catch (err) {
    console.error("[adminAi:deleteKnowledgeDoc]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue." });
  }
}

export async function reseedKnowledgeDocs(_req: AuthenticatedRequest, res: Response) {
  try {
    await reseedKnowledge();
    res.json({ success: true, message: `${SEED_DOCS.length} document(s) d'origine restauré(s).` });
  } catch (err) {
    console.error("[adminAi:reseedKnowledgeDocs]", err);
    res.status(500).json({ success: false, error: "Une erreur inattendue est survenue." });
  }
}
