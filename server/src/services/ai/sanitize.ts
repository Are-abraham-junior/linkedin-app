import { AGENT_TOOLS } from "./tools.js";

/**
 * Garde-fou déterministe sur le texte final de l'assistant : on ne fait pas confiance au prompt seul
 * (les petits modèles citent leurs outils et collent du JSON). Le texte est nettoyé par regex, et
 * `hasTechnicalJargon` indique s'il faut demander une reformulation au modèle.
 */

const INTERNAL_ACTIONS: Record<string, string> = {
  launch_campaign: "le lancement de la campagne",
  delete_list: "la suppression de la liste",
};

/** Formulation utilisateur de chaque outil (ce que l'agent fait, pas comment). */
const TOOL_PHRASES: Record<string, string> = {
  search_linkedin_profiles: "la recherche de profils LinkedIn",
  get_prospect_lists: "la consultation de vos listes",
  create_prospect_list: "la création d'une liste",
  add_search_results_to_list: "l'ajout des profils à une liste",
  rename_prospect_list: "le renommage de la liste",
  delete_prospect_list: "la suppression de la liste",
  get_campaign_templates: "le choix d'un modèle de séquence",
  draft_campaign: "la préparation du brouillon de campagne",
  request_launch_confirmation: "la demande de confirmation de lancement",
  get_campaigns_overview: "la consultation de vos campagnes",
  get_campaign_details: "la lecture de la campagne",
  update_campaign_steps: "la modification des étapes de la campagne",
  get_account_status: "la vérification de votre compte et de vos quotas",
  search_knowledge: "la consultation de la documentation",
};

const PARAM_WORDS = ["listName", "listId", "newName", "templateId", "campaignName", "campaignId", "stepOrder", "delayDays", "messageText", "actionType", "indexes", "keywords", "confirmToken"];

function buildToolNameMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const tool of AGENT_TOOLS) {
    const phrase = TOOL_PHRASES[tool.name] || `l'action « ${tool.label.toLowerCase()} »`;
    map.set(tool.name, phrase);
    for (const alias of tool.aliases || []) map.set(alias, phrase);
  }
  for (const [name, phrase] of Object.entries(INTERNAL_ACTIONS)) map.set(name, phrase);
  return map;
}

let toolNameMap: Map<string, string> | null = null;

const TOOL_JSON_BLOCK = /\{\s*"(?:name|function|tool)"\s*:\s*"[a-zA-Z_]+"[\s\S]*?\}\s*\}?/g;
const CODE_FENCE = /```[a-zA-Z]*\n?[\s\S]*?```/g;
const SNAKE_CASE_CALL = /\b[a-z]+(?:_[a-z]+)+\s*\([^)]*\)/g;

/** Détecte le vocabulaire technique qu'un utilisateur final ne doit jamais voir. */
export function hasTechnicalJargon(text: string): boolean {
  if (!text.trim()) return false;
  if (CODE_FENCE.test(text) || TOOL_JSON_BLOCK.test(text)) return true;
  CODE_FENCE.lastIndex = 0;
  TOOL_JSON_BLOCK.lastIndex = 0;
  if (!toolNameMap) toolNameMap = buildToolNameMap();
  for (const name of toolNameMap.keys()) {
    if (new RegExp(`\\b${name}\\b`, "i").test(text)) return true;
  }
  // Un identifiant snake_case n'a rien à faire dans une réponse en français (outil inventé, paramètre…)
  if (/\b[a-z]+_[a-z]+(?:_[a-z]+)*\b/.test(text)) return true;
  if (/\boutil\s+`/i.test(text)) return true;
  if (new RegExp(`\\b(?:${PARAM_WORDS.join("|")})\\b`).test(text)) return true;
  if (/\bJSON\b|"parameters"|"arguments"/i.test(text)) return true;
  return false;
}

/** Nettoyage par regex : blocs de code et JSON d'outil supprimés, noms d'outils remplacés par leur formulation. */
export function sanitizeAssistantText(text: string): string {
  if (!toolNameMap) toolNameMap = buildToolNameMap();
  let out = text.replace(CODE_FENCE, "").replace(TOOL_JSON_BLOCK, "").replace(SNAKE_CASE_CALL, "");
  for (const [name, phrase] of toolNameMap) {
    out = out.replace(new RegExp(`(?:l'outil\\s+|la fonction\\s+|la commande\\s+)?\`?\\b${name}\\b\`?`, "gi"), phrase);
  }
  out = out.replace(/\b(?:en utilisant|via|avec)\s+l'outil\b/gi, "avec").replace(/\bl'outil\s+(?=la |le |l')/gi, "");
  // Lignes vidées par le nettoyage
  out = out
    .split("\n")
    .filter((line) => !/^\s*(?:[-*]\s*)?(?:Voici (?:un exemple de )?code.*|Notez que vous devez remplacer.*)$/i.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return out;
}

/** Consigne de reformulation envoyée au modèle quand le nettoyage regex ne suffit pas. */
export const REWRITE_INSTRUCTION =
  "Réécris ta réponse précédente pour un utilisateur non technique de Bleadin : même contenu utile, en français, sans aucun bloc de code, sans JSON, sans nom d'outil ni de paramètre. " +
  "Si tu décrivais une procédure, décris les clics dans l'interface Bleadin (menus : Contacts & Prospects → Importer des prospects → Recherche LinkedIn ; Campagnes → Nouvelle campagne) " +
  "ou propose simplement de t'en occuper toi-même en une phrase. Réponds uniquement avec la réponse réécrite.";
