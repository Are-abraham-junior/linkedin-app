/**
 * Banc d'essai Bleadin IA — mesure la qualité de l'agent sur des requêtes types, quel que soit le modèle actif.
 *
 *   npm run ai:bench                    # API locale (PORT de .env), identifiants seed
 *   BENCH_EMAIL=... BENCH_PASSWORD=... BENCH_API=https://api.bleadin.com/api npm run ai:bench
 *   npm run ai:bench -- --only=guide,quotas --out=bench.json
 *
 * Pour comparer deux modèles : activer l'un puis l'autre dans /admin/settings → Providers IA et relancer.
 * Chaque cas utilise une conversation neuve ; les fixtures (liste, campagne) sont créées puis supprimées.
 * Vérifications : pas de JSON / bloc de code / nom d'outil (même détecteur que le garde-fou serveur),
 * outil attendu appelé, carte attendue émise, réponse non vide, aucune erreur.
 */
import "dotenv/config";
import { hasTechnicalJargon } from "../server/src/services/ai/sanitize.js";

const API = process.env.BENCH_API || `http://localhost:${process.env.PORT || 5000}/api`;
const EMAIL = process.env.BENCH_EMAIL || "jeanregis@bimelink.io";
const PASSWORD = process.env.BENCH_PASSWORD || "Admin123!";

interface BenchCase {
  id: string;
  prompt: string;
  /** Au moins un de ces outils doit avoir été appelé (vide = aucun requis). */
  expectTools?: string[];
  /** Outils qui ne doivent PAS être appelés. */
  forbidTools?: string[];
  expectCard?: string;
  /** Expressions (insensibles à la casse) dont au moins une doit apparaître dans la réponse. */
  expectAny?: string[];
}

const LIST_NAME = "Bench IA liste";
const LIST_RENAMED = "Bench IA renommée";
const CAMPAIGN_NAME = "Bench IA campagne";

const CASES: BenchCase[] = [
  { id: "guide", prompt: "je veux lancer une campagne pour atteindre les développeurs en côte d'ivoire, guide moi", forbidTools: ["draft_campaign", "request_launch_confirmation"] },
  { id: "quotas", prompt: "Quels sont mes quotas d'invitations cette semaine ?", expectTools: ["get_account_status"], expectCard: "account_status" },
  { id: "strategie", prompt: "Quelle stratégie me conseilles-tu pour prospecter des DG de grands comptes très sollicités ?", expectAny: ["visite", "invitation", "relance"] },
  { id: "rename", prompt: `Renomme la liste "${LIST_NAME}" en "${LIST_RENAMED}"`, expectTools: ["rename_prospect_list"], expectCard: "action_result" },
  { id: "delete", prompt: `Supprime la liste "${LIST_RENAMED}"`, expectTools: ["delete_prospect_list"], expectCard: "confirm_delete_list" },
  { id: "details", prompt: `Analyse les messages et les délais de la campagne "${CAMPAIGN_NAME}" et dis-moi ce que tu améliorerais`, expectTools: ["get_campaign_details"], expectCard: "campaign_steps", forbidTools: ["update_campaign_steps"] },
  { id: "delais", prompt: `Passe le délai de l'étape 2 de la campagne "${CAMPAIGN_NAME}" à 3 jours`, expectTools: ["update_campaign_steps"], expectCard: "campaign_steps" },
  { id: "self-import", prompt: "Comment je fais pour importer des prospects moi-même dans Bleadin ?", expectAny: ["Contacts & Prospects", "Importer des prospects"] },
  { id: "note", prompt: "Aide-moi à rédiger une note d'invitation pour des directeurs financiers", expectAny: ["{{firstName}}", "Bonjour", "bonjour"] },
  { id: "campagnes", prompt: "Quelles sont mes campagnes en cours ?", expectTools: ["get_campaigns_overview"] },
  { id: "create-list", prompt: 'Crée une liste nommée "Bench IA nouvelle"', expectTools: ["create_prospect_list"], expectCard: "list" },
  { id: "emails", prompt: "Est-ce que Bleadin peut envoyer des e-mails automatiquement à mes prospects ?", forbidTools: ["search_linkedin_profiles"] },
  { id: "sequence-drh", prompt: "Propose-moi une séquence pour prendre des rendez-vous avec des DRH", expectAny: ["invitation", "message", "relance"] },
];

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=") as [string, string]));
  const only = args.only ? new Set(args.only.split(",")) : null;

  const login = await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) }).then((r) => r.json() as Promise<any>);
  if (!login.token) throw new Error(`Connexion impossible (${EMAIL}) : ${login.error || "pas de token"}`);
  const headers = { Authorization: `Bearer ${login.token}`, "Content-Type": "application/json" };
  const api = async (path: string, init: { method?: string; body?: unknown } = {}) =>
    fetch(API + path, { method: init.method || "GET", headers, body: init.body ? JSON.stringify(init.body) : undefined }).then((r) => r.json() as Promise<any>);

  const status = await api("/ai/status");
  if (!status.enabled) throw new Error(`Bleadin IA indisponible : ${JSON.stringify(status)}`);
  console.log(`Modèle actif : ${status.model} · ${CASES.length} cas · ${API}\n`);

  // Fixtures
  const list = await api("/lists", { method: "POST", body: { name: LIST_NAME } });
  const campaign = await api("/campaigns", {
    method: "POST",
    body: {
      name: CAMPAIGN_NAME,
      type: "INVITE_AND_FOLLOWUPS",
      listIds: [],
      steps: [
        { stepOrder: 1, actionType: "INVITATION", delayDays: 0, messageText: "Bonjour {{firstName}}, ravi d'échanger avec vous." },
        { stepOrder: 2, actionType: "MESSAGE", delayDays: 1, messageText: "Merci {{firstName}} ! Je vous propose une démo de notre solution qui augmente vos ventes de 300 %. Dispo ?" },
        { stepOrder: 3, actionType: "MESSAGE", delayDays: 0, messageText: "Relance : avez-vous vu mon message ?" },
      ],
      startImmediately: false,
    },
  });
  if (!list.success || !campaign.success) throw new Error(`Fixtures impossibles : ${list.error || campaign.error}`);

  const results: any[] = [];
  const conversationIds: string[] = [];
  try {
    for (const c of CASES) {
      if (only && !only.has(c.id)) continue;
      const conv = await api("/ai/conversations", { method: "POST", body: {} });
      conversationIds.push(conv.conversation.id);
      const t0 = Date.now();
      const r = await api(`/ai/conversations/${conv.conversation.id}/messages`, { method: "POST", body: { content: c.prompt, stream: false } });
      const seconds = (Date.now() - t0) / 1000;
      const text: string = r.text || "";
      const tools: string[] = (r.events || []).filter((e: any) => e.type === "tool_start").map((e: any) => e.name);
      const cards: string[] = (r.events || []).filter((e: any) => e.type === "card").map((e: any) => e.card.type);

      const checks: Record<string, boolean> = {
        ok: Boolean(r.success) && !r.error,
        texte: text.trim().length > 0,
        "sans jargon": !hasTechnicalJargon(text),
        "sans JSON": !/\{\s*"|```/.test(text),
      };
      if (c.expectTools?.length) checks[`outil ${c.expectTools.join("|")}`] = c.expectTools.some((t) => tools.includes(t));
      if (c.forbidTools?.length) checks["outils interdits"] = !c.forbidTools.some((t) => tools.includes(t));
      if (c.expectCard) checks[`carte ${c.expectCard}`] = cards.includes(c.expectCard);
      if (c.expectAny?.length) checks["contenu attendu"] = c.expectAny.some((s) => text.toLowerCase().includes(s.toLowerCase()));

      const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
      const pass = failed.length === 0;
      results.push({ id: c.id, pass, seconds, tools, cards, failed, text });
      console.log(`${pass ? "✅" : "❌"} ${c.id.padEnd(13)} ${seconds.toFixed(1).padStart(5)}s  outils=[${tools.join(", ")}]${failed.length ? `  ÉCHECS: ${failed.join(", ")}` : ""}`);
      if (!pass) console.log(`     ↳ ${text.replace(/\s+/g, " ").slice(0, 260)}${r.error ? ` (erreur: ${r.error})` : ""}`);
    }
  } finally {
    for (const id of conversationIds) await api(`/ai/conversations/${id}`, { method: "DELETE" });
    await api(`/campaigns/${campaign.campaign.id}?permanent=true`, { method: "DELETE" });
    const lists = await api("/lists");
    for (const l of lists.lists || []) if (/^Bench IA/.test(l.name)) await api(`/lists/${l.id}`, { method: "DELETE" });
  }

  const passed = results.filter((r) => r.pass).length;
  const avg = results.reduce((s, r) => s + r.seconds, 0) / Math.max(1, results.length);
  console.log(`\nScore : ${passed}/${results.length} · latence moyenne ${avg.toFixed(1)}s · modèle ${status.model}`);
  if (args.out) {
    const fs = await import("fs");
    fs.writeFileSync(args.out, JSON.stringify({ model: status.model, api: API, date: new Date().toISOString(), score: `${passed}/${results.length}`, results }, null, 2));
    console.log(`Résultats écrits dans ${args.out}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
