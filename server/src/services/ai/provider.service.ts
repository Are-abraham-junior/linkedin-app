import { prisma } from "../../../../lib/prisma.js";
import { AiProviderError, testProvider as runProviderTest, type AiProviderConfig } from "./ollama.client.js";

type AiProviderRow = Awaited<ReturnType<typeof prisma.aiProvider.findFirst>>;

const CACHE_TTL_MS = 60_000;
let cached: { provider: NonNullable<AiProviderRow> | null; at: number } | null = null;

export function invalidateProviderCache(): void {
  cached = null;
}

export async function getActiveProvider(): Promise<NonNullable<AiProviderRow> | null> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.provider;
  const provider = await prisma.aiProvider.findFirst({ where: { isActive: true }, orderBy: { updatedAt: "desc" } });
  cached = { provider, at: Date.now() };
  return provider;
}

export async function requireActiveProvider(): Promise<NonNullable<AiProviderRow>> {
  const provider = await getActiveProvider();
  if (!provider) {
    throw new AiProviderError("Aucun provider IA n'est configuré. Contactez l'administrateur de la plateforme.");
  }
  return provider;
}

export function maskApiKey(key: string | null | undefined): string | null {
  if (!key) return null;
  return `••••${key.slice(-4)}`;
}

export function toPublicProvider(p: NonNullable<AiProviderRow>) {
  return {
    id: p.id,
    name: p.name,
    kind: p.kind,
    baseUrl: p.baseUrl,
    apiKeyMasked: maskApiKey(p.apiKey),
    hasApiKey: Boolean(p.apiKey),
    model: p.model,
    temperature: p.temperature,
    numCtx: p.numCtx,
    thinking: p.thinking,
    isActive: p.isActive,
    status: p.status,
    lastTestedAt: p.lastTestedAt,
    lastLatencyMs: p.lastLatencyMs,
    lastError: p.lastError,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export async function testAndRecord(providerId: string) {
  const provider = await prisma.aiProvider.findUnique({ where: { id: providerId } });
  if (!provider) return null;
  const result = await runProviderTest(provider as AiProviderConfig);
  await prisma.aiProvider.update({
    where: { id: providerId },
    data: {
      status: result.ok ? "OK" : "ERROR",
      lastTestedAt: new Date(),
      lastLatencyMs: result.latencyMs,
      lastError: result.ok ? null : result.error || "Erreur inconnue",
    },
  });
  invalidateProviderCache();
  return result;
}

/** Trace un échec rencontré pendant une conversation (URL de tunnel expirée, etc.). */
export async function recordProviderFailure(providerId: string, message: string): Promise<void> {
  try {
    await prisma.aiProvider.update({
      where: { id: providerId },
      data: { status: "ERROR", lastError: message.slice(0, 500), lastTestedAt: new Date() },
    });
    invalidateProviderCache();
  } catch (err) {
    console.warn("recordProviderFailure:", err);
  }
}
