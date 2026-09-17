import { prisma } from "../../../../lib/prisma.js";
import { BLEADIN_APP_DOC } from "./knowledge/bleadinApp.js";
import { PROSPECTION_DOC } from "./knowledge/prospection.js";
import { REDACTION_DOC } from "./knowledge/redaction.js";
import { STRATEGIES_DOC } from "./knowledge/strategies.js";

export const SEED_DOCS = [BLEADIN_APP_DOC, PROSPECTION_DOC, STRATEGIES_DOC, REDACTION_DOC];

interface Chunk {
  docSlug: string;
  docTitle: string;
  heading: string;
  text: string;
  terms: Map<string, number>;
  length: number;
}

interface KnowledgeIndex {
  chunks: Chunk[];
  df: Map<string, number>;
  avgLength: number;
  coreText: string;
  builtAt: number;
}

const STOPWORDS = new Set(
  "le la les un une des du de d l et ou à a au aux en dans sur pour par avec sans ce cet cette ces se sa son ses mon ma mes ton ta tes leur leurs il elle ils elles on nous vous je tu ne pas plus que qui quoi dont où est sont être avoir fait faire comme mais donc car si y the of to and in is".split(
    " "
  )
);

let index: KnowledgeIndex | null = null;
let loading: Promise<KnowledgeIndex> | null = null;

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function splitIntoChunks(doc: { slug: string; title: string; content: string }): Chunk[] {
  const chunks: Chunk[] = [];
  const sections = doc.content.split(/\n(?=#{1,3} )/);
  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;
    const headingMatch = trimmed.match(/^#{1,3}\s+(.+)$/m);
    const heading = headingMatch ? headingMatch[1].trim() : doc.title;
    const tokens = tokenize(`${heading} ${trimmed}`);
    const terms = new Map<string, number>();
    for (const t of tokens) terms.set(t, (terms.get(t) || 0) + 1);
    chunks.push({ docSlug: doc.slug, docTitle: doc.title, heading, text: trimmed, terms, length: tokens.length });
  }
  return chunks;
}

async function buildIndex(): Promise<KnowledgeIndex> {
  const docs = await prisma.aiKnowledgeDoc.findMany({ where: { enabled: true }, orderBy: { createdAt: "asc" } });
  const chunks = docs.filter((d) => !d.isCore).flatMap(splitIntoChunks);
  const df = new Map<string, number>();
  for (const c of chunks) {
    for (const term of c.terms.keys()) df.set(term, (df.get(term) || 0) + 1);
  }
  const avgLength = chunks.length ? chunks.reduce((s, c) => s + c.length, 0) / chunks.length : 1;
  const coreText = docs
    .filter((d) => d.isCore)
    .map((d) => d.content.trim())
    .join("\n\n");
  return { chunks, df, avgLength, coreText, builtAt: Date.now() };
}

export async function getKnowledgeIndex(): Promise<KnowledgeIndex> {
  if (index) return index;
  if (!loading) {
    loading = buildIndex()
      .then((built) => {
        index = built;
        return built;
      })
      .finally(() => {
        loading = null;
      });
  }
  return loading;
}

export function invalidateKnowledgeIndex(): void {
  index = null;
}

/** Insère les documents d'origine absents (première installation ou nouveau document livré), sans écraser ceux déjà édités. */
export async function seedKnowledgeIfEmpty(): Promise<void> {
  const existing = await prisma.aiKnowledgeDoc.findMany({ select: { slug: true } });
  const known = new Set(existing.map((d) => d.slug));
  const missing = SEED_DOCS.filter((d) => !known.has(d.slug));
  if (missing.length === 0) return;
  for (const doc of missing) {
    await prisma.aiKnowledgeDoc.create({ data: { ...doc, enabled: true } });
  }
  invalidateKnowledgeIndex();
  console.log(`📚 Base de connaissances Bleadin IA : ${missing.length} document(s) ajouté(s).`);
}

/** Réécrit les documents d'origine (upsert par slug), sans toucher aux documents ajoutés par l'admin. */
export async function reseedKnowledge(): Promise<void> {
  for (const doc of SEED_DOCS) {
    await prisma.aiKnowledgeDoc.upsert({
      where: { slug: doc.slug },
      create: { ...doc, enabled: true },
      update: { title: doc.title, category: doc.category, content: doc.content, isCore: doc.isCore },
    });
  }
  invalidateKnowledgeIndex();
}

export interface KnowledgeHit {
  docSlug: string;
  docTitle: string;
  heading: string;
  text: string;
  score: number;
}

export async function searchKnowledge(query: string, topK = 3): Promise<KnowledgeHit[]> {
  const idx = await getKnowledgeIndex();
  const queryTerms = Array.from(new Set(tokenize(query)));
  if (queryTerms.length === 0 || idx.chunks.length === 0) return [];

  const k1 = 1.2;
  const b = 0.75;
  const N = idx.chunks.length;

  const scored = idx.chunks.map((chunk) => {
    let score = 0;
    for (const term of queryTerms) {
      const tf = chunk.terms.get(term);
      if (!tf) continue;
      const df = idx.df.get(term) || 0;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * chunk.length) / idx.avgLength)));
    }
    return { chunk, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b2) => b2.score - a.score)
    .slice(0, topK)
    .map(({ chunk, score }) => ({
      docSlug: chunk.docSlug,
      docTitle: chunk.docTitle,
      heading: chunk.heading,
      text: chunk.text,
      score,
    }));
}

export async function getCoreKnowledge(maxChars = 7000): Promise<string> {
  const idx = await getKnowledgeIndex();
  if (idx.coreText.length <= maxChars) return idx.coreText;
  return idx.coreText.slice(0, maxChars) + "\n…";
}
