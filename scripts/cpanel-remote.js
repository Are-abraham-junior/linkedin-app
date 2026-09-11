#!/usr/bin/env node
/**
 * scripts/cpanel-remote.js
 * 
 * Outil CLI tout-en-un pour le déploiement cPanel LWS et la télé-maintenance distante.
 * Conforme aux standards Bleadin et au rôle de l'agent `cpanel-lws-expert`.
 * 
 * Commandes :
 *   node scripts/cpanel-remote.js build        -> Compile TypeScript et Vite
 *   node scripts/cpanel-remote.js package      -> Assemble deploy/ et génère les archives .zip de secours
 *   node scripts/cpanel-remote.js push         -> Transfère les fichiers vers le serveur via SCP/SSH
 *   node scripts/cpanel-remote.js chmod        -> Rétablit les permissions Linux (chmod -R 755 dist)
 *   node scripts/cpanel-remote.js restart      -> Redémarre l'application Phusion Passenger
 *   node scripts/cpanel-remote.js logs         -> Affiche les logs d'erreur (stderr.log)
 *   node scripts/cpanel-remote.js diag         -> Lance l'exécution directe `node app.js` dans le nodevenv
 *   node scripts/cpanel-remote.js db-push [--seed] -> Synchronise le schéma Prisma (et optionnellement les données de démo) sur la DB de production, EN SSH
 *   node scripts/cpanel-remote.js health       -> Vérifie la santé de l'API (/api/health) et du client
 *   node scripts/cpanel-remote.js deploy-all   -> Pipeline complet : build -> package -> push -> chmod -> restart -> health
 */

import fs from "fs";
import path from "path";
import { execSync, spawnSync } from "child_process";
import dotenv from "dotenv";

const ROOT = process.cwd();

// 1. Charger la configuration de déploiement (.env.deploy prioritaire, puis .env)
const envDeployPath = path.join(ROOT, ".env.deploy");
if (fs.existsSync(envDeployPath)) {
  dotenv.config({ path: envDeployPath });
} else {
  dotenv.config({ path: path.join(ROOT, ".env") });
}

// Paramètres de configuration avec valeurs par défaut
const config = {
  sshHost: process.env.SSH_HOST || "",
  sshPort: process.env.SSH_PORT || "22",
  sshUser: process.env.SSH_USER || "",
  sshKey: process.env.SSH_KEY_PATH || "",
  // Confirmé via cPanel "Setup Node.js App" : Racine de l'application = public_html/api-bleadin
  remoteApiDir: process.env.REMOTE_API_DIR || "~/public_html/api-bleadin",
  // Racine du domaine bleadin.com (à confirmer en SSH avant le premier push client — cf. runbook)
  remoteClientDir: process.env.REMOTE_CLIENT_DIR || "~/public_html",
  // Confirmé via cPanel : Node 24, nodevenv sous nodevenv/public_html/api-bleadin/24
  remoteNodevenv: process.env.REMOTE_NODEVENV_PATH || "~/nodevenv/public_html/api-bleadin/24/bin/activate",
  apiHealthUrl: process.env.API_HEALTH_URL || "https://api.bleadin.com/api/health",
  frontendUrl: process.env.FRONTEND_URL || "https://bleadin.com",
  databaseUrl: process.env.DATABASE_URL || "",
};

const DEPLOY_DIR = path.join(ROOT, "deploy");
const DEPLOY_API = path.join(DEPLOY_DIR, "api");
const DEPLOY_CLIENT = path.join(DEPLOY_DIR, "client");

function log(emoji, text) {
  console.log(`${emoji}  ${text}`);
}

function runLocal(cmd, label) {
  log("🔨", `${label}...`);
  try {
    execSync(cmd, { stdio: "inherit", cwd: ROOT });
    log("✅", `${label} terminé avec succès.`);
  } catch (err) {
    log("❌", `Échec lors de : ${label}`);
    process.exit(1);
  }
}

function getSshOptions() {
  const opts = [`-p`, config.sshPort];
  if (config.sshKey) {
    opts.push(`-i`, config.sshKey.replace(/^~/, process.env.HOME || process.env.USERPROFILE || ""));
  }
  opts.push(`-o`, `StrictHostKeyChecking=accept-new`);
  opts.push(`-o`, `ConnectTimeout=10`);
  return opts;
}

function runRemoteSsh(remoteCommand, label) {
  if (!config.sshHost || !config.sshUser) {
    log("⚠️", "SSH_HOST ou SSH_USER n'est pas défini dans .env.deploy.");
    log("💡", "Remplissez .env.deploy ou consultez les runbooks dans .agents/skills/cpanel-lws-expert/references/runbooks.md");
    return false;
  }

  log("🌐", `[SSH distant] ${label}...`);
  const sshArgs = [...getSshOptions(), `${config.sshUser}@${config.sshHost}`, remoteCommand];
  
  const result = spawnSync("ssh", sshArgs, { stdio: "inherit", shell: true });
  if (result.status !== 0) {
    log("❌", `Échec de l'action distante [${label}] (code ${result.status})`);
    return false;
  }
  log("✅", `[SSH distant] ${label} validé.`);
  return true;
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function copyFile(src, dest) {
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

// --- COMMANDES ---

function verifyPrismaParity() {
  const pkgPath = path.join(ROOT, "package.json");
  if (!fs.existsSync(pkgPath)) return;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const clientVer = (deps["@prisma/client"] || "").replace(/[\^~]/, "");
    const adapterVer = (deps["@prisma/adapter-neon"] || deps["@prisma/adapter-pg"] || "").replace(/[\^~]/, "");
    if (clientVer && adapterVer && clientVer !== adapterVer) {
      log("⚠️", `Attention: Parité Prisma non respectée (@prisma/client: ${clientVer} vs adapter: ${adapterVer})`);
      log("💡", "Alignez les versions au patch près pour éviter les ruptures de contrat Driver Adapter.");
    } else if (clientVer) {
      log("✅", `Parité Prisma validée (${clientVer}).`);
    }
  } catch {}
}

function cmdCleanEnv() {
  log("🧹", "Nettoyage du fichier .env (suppression du BOM UTF-8 et des retours chariot Windows CRLF)...");
  const envPath = path.join(ROOT, ".env");
  if (fs.existsSync(envPath)) {
    let content = fs.readFileSync(envPath, "utf8");
    content = content.replace(/^\uFEFF/, "").replace(/\r/g, "");
    fs.writeFileSync(envPath, content, "utf8");
    log("✅", "Fichier .env local nettoyé avec succès.");
  }
  if (config.sshHost && config.sshUser) {
    log("🌐", "Nettoyage du .env distant...");
    runRemoteSsh(
      `node -e 'const fs = require("fs"); const p = "${config.remoteApiDir}/.env"; if (fs.existsSync(p)) { fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(/^\\uFEFF/, "").replace(/\\r/g, "")); console.log("✅ .env distant nettoyé"); }'`,
      "Assainissement .env distant"
    );
  }
}

function cmdBuild() {
  console.log("\n=========================================");
  log("🚀", "Phase 1 : Compilation TypeScript & Build Vite");
  console.log("=========================================\n");

  verifyPrismaParity();
  runLocal("npx tsc --outDir dist", "Compilation TypeScript du serveur (dist/)");
  runLocal("npx prisma generate", "Génération du client Prisma local");
  runLocal("npm --prefix client run build", "Build de production du client Vite (client/dist/)");
}

function cmdPackage() {
  cmdBuild();
  cmdCleanEnv();

  console.log("\n=========================================");
  log("📦", "Phase 2 : Assemblage du dossier deploy/ et archives ZIP");
  console.log("=========================================\n");

  // IMPORTANT : ne nettoyer QUE les deux sous-dossiers générés, jamais tout deploy/,
  // afin de ne pas détruire des dossiers voisins conservés par l'utilisateur
  // (ex: deploy/bleadin/ contenant des .env de référence).
  for (const dir of [DEPLOY_API, DEPLOY_CLIENT]) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true });
    }
  }
  fs.mkdirSync(DEPLOY_API, { recursive: true });
  fs.mkdirSync(DEPLOY_CLIENT, { recursive: true });

  // 1. Assemblage API
  log("📂", "Copie des artefacts de l'API...");
  copyDir(path.join(ROOT, "dist"), path.join(DEPLOY_API, "dist"));
  copyDir(path.join(ROOT, "prisma"), path.join(DEPLOY_API, "prisma"));
  copyFile(path.join(ROOT, "package.json"), path.join(DEPLOY_API, "package.json"));
  copyFile(path.join(ROOT, "package-lock.json"), path.join(DEPLOY_API, "package-lock.json"));
  copyFile(path.join(ROOT, "app.js"), path.join(DEPLOY_API, "app.js"));
  copyFile(path.join(ROOT, "env.js"), path.join(DEPLOY_API, "env.js"));
  copyFile(path.join(ROOT, "tsconfig.json"), path.join(DEPLOY_API, "tsconfig.json"));

  // Sélection du fichier .env pour l'API
  const bleadinEnv = path.join(ROOT, "deploy", "bleadin", "api", ".env");
  if (fs.existsSync(bleadinEnv)) {
    copyFile(bleadinEnv, path.join(DEPLOY_API, ".env"));
    log("🔑", "Utilisation de deploy/bleadin/api/.env");
  } else if (fs.existsSync(path.join(ROOT, "deploy", "api", ".env"))) {
    copyFile(path.join(ROOT, "deploy", "api", ".env"), path.join(DEPLOY_API, ".env"));
    log("🔑", "Utilisation de deploy/api/.env");
  } else {
    // DANGER ÉCARTÉ : ne JAMAIS générer un .env partiel ici. Un template sans
    // JWT_SECRET ni clés Unipile, poussé sur le serveur, écrase le .env de
    // production et casse l'authentification + l'intégration LinkedIn.
    // On préfère ne rien fournir : cmdPush ignore les fichiers absents, donc le
    // .env déjà en place sur le serveur (source de vérité) reste intact.
    log("⚠️", "Aucune source .env locale complète trouvée — le .env NE SERA PAS poussé.");
    log("💡", "Le .env existant sur le serveur est conservé tel quel (comportement voulu).");
  }

  // 2. Assemblage Client
  log("📂", "Copie des artefacts du Client...");
  copyDir(path.join(ROOT, "client", "dist"), DEPLOY_CLIENT);
  
  // S'assurer que le .htaccess est présent
  const htaccessSrc = path.join(ROOT, "client", "public", ".htaccess");
  const htaccessFallback = path.join(ROOT, "deploy", "client", ".htaccess");
  if (fs.existsSync(htaccessSrc)) {
    copyFile(htaccessSrc, path.join(DEPLOY_CLIENT, ".htaccess"));
  } else if (!fs.existsSync(path.join(DEPLOY_CLIENT, ".htaccess"))) {
    // Gardes indispensables : ce .htaccess est posé à la racine de ~/public_html,
    // donc Apache l'applique AUSSI au sous-répertoire api-bleadin (docroot de
    // api.bleadin.com). Sans elles, le fallback SPA réécrit toute URL inexistante
    // vers un /index.html absent du docroot de l'API → chaque route /api/* répond 500.
    const defaultHtaccess = `<IfModule mod_rewrite.c>\n  RewriteEngine On\n  RewriteBase /\n  RewriteCond %{HTTP_HOST} ^api\\. [NC]\n  RewriteRule ^ - [L]\n  RewriteRule ^api-bleadin(/|$) - [L]\n  RewriteRule ^index\\.html$ - [L]\n  RewriteCond %{REQUEST_FILENAME} !-f\n  RewriteCond %{REQUEST_FILENAME} !-d\n  RewriteRule . /index.html [L]\n</IfModule>\n`;
    fs.writeFileSync(path.join(DEPLOY_CLIENT, ".htaccess"), defaultHtaccess);
  }

  // 3. Génération des ZIPs de secours
  log("🗜️", "Création des archives ZIP pour File Manager cPanel...");
  try {
    if (process.platform === "win32") {
      execSync(`powershell -Command "Compress-Archive -Path '${DEPLOY_API}/*' -DestinationPath '${path.join(DEPLOY_DIR, "api.zip")}' -Force"`, { stdio: "ignore" });
      execSync(`powershell -Command "Compress-Archive -Path '${DEPLOY_CLIENT}/*' -DestinationPath '${path.join(DEPLOY_DIR, "client.zip")}' -Force"`, { stdio: "ignore" });
    } else {
      execSync(`cd "${DEPLOY_API}" && zip -r "${path.join(DEPLOY_DIR, "api.zip")}" .`, { stdio: "ignore" });
      execSync(`cd "${DEPLOY_CLIENT}" && zip -r "${path.join(DEPLOY_DIR, "client.zip")}" .`, { stdio: "ignore" });
    }
    log("✅", "Archives deploy/api.zip et deploy/client.zip générées.");
  } catch (err) {
    log("⚠️", "Génération des ZIPs ignorée (outil zip ou powershell indisponible). Les dossiers deploy/ restent valides.");
  }

  log("🎉", "Packaging terminé ! Fichiers prêts dans deploy/.");
}

function cmdPush() {
  console.log("\n=========================================");
  log("🚀", "Phase 3 : Synchronisation vers cPanel LWS via SCP/SSH");
  console.log("=========================================\n");

  if (!fs.existsSync(DEPLOY_API) || !fs.existsSync(DEPLOY_CLIENT)) {
    log("⚠️", "Dossier deploy/ manquant. Exécution préalable du packaging...");
    cmdPackage();
  }

  if (!config.sshHost || !config.sshUser) {
    log("❌", "Identifiants SSH manquants dans .env.deploy (SSH_HOST et SSH_USER requis).");
    return;
  }

  // 1. Création des répertoires distants
  runRemoteSsh(`mkdir -p ${config.remoteApiDir}/dist ${config.remoteClientDir}`, "Création des répertoires distants");

  // 2. Transfert SCP de l'API
  log("📤", `Transfert de l'API vers ${config.remoteApiDir}...`);
  const scpOpts = [`-P`, config.sshPort, `-r`];
  if (config.sshKey) {
    scpOpts.push(`-i`, config.sshKey.replace(/^~/, process.env.HOME || process.env.USERPROFILE || ""));
  }
  
  // Copier dist, prisma, package.json, app.js, .env
  const apiItems = ["dist", "prisma", "package.json", "package-lock.json", "app.js", ".env", "tsconfig.json"];
  for (const item of apiItems) {
    const localItemPath = path.join(DEPLOY_API, item);
    if (fs.existsSync(localItemPath)) {
      const scpCmd = `scp ${scpOpts.join(" ")} "${localItemPath}" ${config.sshUser}@${config.sshHost}:${config.remoteApiDir}/`;
      execSync(scpCmd, { stdio: "inherit" });
    }
  }

  // 3. Transfert SCP du Client
  log("📤", `Transfert du Client vers ${config.remoteClientDir}...`);
  // On énumère explicitement avec readdirSync AU LIEU d'un glob `*` : le glob
  // shell ignore les fichiers commençant par un point, donc le .htaccess du
  // front (qui porte les gardes protégeant le vhost API) n'était jamais poussé.
  for (const item of fs.readdirSync(DEPLOY_CLIENT)) {
    const localItem = path.join(DEPLOY_CLIENT, item);
    execSync(`scp ${scpOpts.join(" ")} "${localItem}" ${config.sshUser}@${config.sshHost}:${config.remoteClientDir}/`, { stdio: "inherit" });
  }

  // 4. Garde .htaccess de l'API (isolation vis-à-vis du fallback SPA parent)
  cmdGuardApiHtaccess(scpOpts);

  log("✅", "Transferts terminés avec succès.");
}

// Marqueur d'idempotence : présent dans scripts/api-htaccess-guard.conf.
const API_GUARD_MARKER = "BLEADIN-API-GUARD";

/**
 * Installe (une seule fois) le bloc de garde dans le .htaccess de l'API.
 *
 * Le .htaccess de l'API est géré par CloudLinux (blocs « DO NOT REMOVE » qui
 * portent la configuration Passenger) : on ne le remplace JAMAIS, on se contente
 * d'y APPENDRE le bloc de garde s'il n'y est pas déjà. Sans cette garde, l'API
 * hérite du fallback SPA de ~/public_html/.htaccess et toutes les routes /api/*
 * répondent 500 (voir l'en-tête de scripts/api-htaccess-guard.conf).
 */
function cmdGuardApiHtaccess(scpOpts) {
  const guardSrc = path.join(ROOT, "scripts", "api-htaccess-guard.conf");
  if (!fs.existsSync(guardSrc)) {
    log("⚠️", "scripts/api-htaccess-guard.conf introuvable — garde .htaccess API non appliquée.");
    return;
  }

  log("🛡️", "Vérification de la garde .htaccess de l'API...");
  const opts = scpOpts || (() => {
    const o = [`-P`, config.sshPort, `-r`];
    if (config.sshKey) o.push(`-i`, config.sshKey.replace(/^~/, process.env.HOME || process.env.USERPROFILE || ""));
    return o;
  })();

  const remoteGuard = `${config.remoteApiDir}/.bleadin-api-guard.conf`;
  execSync(
    `scp ${opts.join(" ")} "${guardSrc}" ${config.sshUser}@${config.sshHost}:${remoteGuard}`,
    { stdio: "inherit" }
  );

  // Commande volontairement sur UNE seule ligne ET entre guillemets : runRemoteSsh
  // passe par `shell: true`, donc cmd.exe la parse avant ssh. Sans guillemets il
  // avale les `;`. On proscrit aussi `$(...)` et `%` (substitution de commande et
  // expansion de variables cmd.exe) — d'où le nom de sauvegarde fixe.
  const f = `${config.remoteApiDir}/.htaccess`;
  const remoteCmd = `"touch ${f}; if grep -q ${API_GUARD_MARKER} ${f}; then echo GUARD_ALREADY_PRESENT; else cp -p ${f} ${f}.bak-before-guard; echo >> ${f}; cat ${remoteGuard} >> ${f}; echo GUARD_ADDED; fi"`;
  runRemoteSsh(remoteCmd, "Garde .htaccess API (anti-fallback SPA)");
}

function cmdChmod() {
  log("🔒", "Application des permissions Linux requises sur le serveur distant...");
  // CloudLinux & Passenger exigent le droit d'exécution (+x / 755) sur les répertoires et les fichiers JS compilés
  // Guillemets OBLIGATOIRES : runRemoteSsh passe par `shell: true`, donc cmd.exe
  // parse la commande avant ssh et traite `&&` comme son propre séparateur — la
  // commande partait tronquée et le `~` arrivait non expansé côté serveur.
  const remoteCmd = `"chmod -R 755 ${config.remoteApiDir}/dist; chmod 644 ${config.remoteApiDir}/.env 2>/dev/null; chmod -R 755 ${config.remoteClientDir}"`;
  runRemoteSsh(remoteCmd, "Correction des permissions chmod 755");
}

function cmdRestart() {
  log("🔄", "Redémarrage de l'application Phusion Passenger...");
  // Signal de redémarrage Phusion Passenger standard
  // Guillemets obligatoires, même raison que dans cmdChmod : sans eux cmd.exe
  // coupe la commande sur le `&&` et le redémarrage échouait silencieusement
  // (« touch: cannot touch '~/public_html/...': No such file or directory »).
  const remoteCmd = `"mkdir -p ${config.remoteApiDir}/tmp; touch ${config.remoteApiDir}/tmp/restart.txt"`;
  runRemoteSsh(remoteCmd, "Redémarrage Passenger (tmp/restart.txt)");
}

function cmdLogs() {
  log("📋", "Consultation des logs d'erreurs en production...");
  const remoteCmd = `
    echo "=== [1/2] stderr.log (Dernières erreurs serveur) ===";
    if [ -f ${config.remoteApiDir}/stderr.log ]; then
      tail -n 60 ${config.remoteApiDir}/stderr.log;
    else
      echo "Aucun fichier stderr.log trouvé dans ${config.remoteApiDir}";
    fi;
    echo "";
    echo "=== [2/2] Passenger Status ===";
    passenger-status 2>/dev/null || echo "passenger-status non disponible dans le PATH utilisateur.";
  `;
  runRemoteSsh(remoteCmd, "Récupération des logs de production");
}

function cmdDiag() {
  log("🩺", "Exécution directe de `node app.js` dans l'environnement virtuel nodevenv...");
  log("💡", "Ceci permet de révéler instantanément les erreurs de démarrage sans les masquer derrière une 500 Passenger.");
  
  const remoteCmd = `
    if [ -f ${config.remoteNodevenv} ]; then
      source ${config.remoteNodevenv} && cd ${config.remoteApiDir} && echo "Virtualenv activé : $(which node) $(node -v)" && node app.js;
    else
      cd ${config.remoteApiDir} && echo "Node standard : $(node -v)" && node app.js;
    fi
  `;
  runRemoteSsh(remoteCmd, "Diagnostic direct en console");
}

function cmdDbPush() {
  log("🗄️", "Application du schéma Prisma EN SSH sur le serveur cPanel (la DB LWS locale n'est pas joignable depuis le poste de dev)...");

  const pushCmd = `
    set -e;
    if [ -f ${config.remoteNodevenv} ]; then source ${config.remoteNodevenv}; fi;
    cd ${config.remoteApiDir};
    echo "Node: $(node -v)";
    npx prisma db push --schema=./prisma/schema.prisma;
  `;
  const ok = runRemoteSsh(pushCmd, "prisma db push (distant, via nodevenv)");

  if (ok && process.argv.includes("--seed")) {
    log("🌱", "Option --seed détectée : exécution de `prisma db seed` en distant...");
    const seedCmd = `
      set -e;
      if [ -f ${config.remoteNodevenv} ]; then source ${config.remoteNodevenv}; fi;
      cd ${config.remoteApiDir};
      npx prisma db seed;
    `;
    runRemoteSsh(seedCmd, "prisma db seed (distant)");
  }
}

async function cmdHealth() {
  console.log("\n=========================================");
  log("🩺", "Phase de Vérification : Tests de Santé en Production");
  console.log("=========================================\n");

  let ok = true;

  // Cache-buster OBLIGATOIRE : LWS place un edge Varnish devant le site
  // (en-tetes `Edge-Cache-Engine: varnish` / `Age:`). Sans lui, le health check
  // peut renvoyer un 200 servi depuis le cache alors que l'application est morte
  // — c'est precisement ce qui a masque le debut de la panne du 11/09/2026.
  const healthUrl = `${config.apiHealthUrl}${config.apiHealthUrl.includes("?") ? "&" : "?"}cb=${Date.now()}`;
  log("🔍", `Test de l'API : ${healthUrl}`);
  try {
    const start = Date.now();
    const res = await fetch(healthUrl, { headers: { "Cache-Control": "no-cache" } });
    const duration = Date.now() - start;
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}

    if (res.ok) {
      log("✅", `API en ligne ! Statut HTTP : ${res.status} (${duration}ms)`);
      if (json) console.log("   Réponse :", JSON.stringify(json, null, 2));
    } else {
      log("❌", `API a retourné un statut d'erreur HTTP ${res.status} : ${text}`);
      ok = false;
    }
  } catch (err) {
    log("❌", `Impossible de joindre l'API : ${err.message}`);
    ok = false;
  }

  // --- Test de non-régression : héritage du fallback SPA sur le vhost API ---
  //
  // Signature de la panne du 11/09/2026 : Apache réécrivait toute URL ne
  // correspondant pas à un fichier réel vers un /index.html absent du docroot de
  // l'API, ce qui produisait un 500 AVANT même d'atteindre Node. On sonde donc
  // volontairement une route inexistante : Express doit répondre 404. Un 500, ou
  // du HTML de SPA en 200, signifie que la garde .htaccess a sauté.
  const apiOrigin = new URL(config.apiHealthUrl).origin;
  const probeUrl = `${apiOrigin}/__bleadin_probe_404__?cb=${Date.now()}`;
  log("🔍", `Test de non-régression .htaccess : ${probeUrl}`);
  try {
    const res = await fetch(probeUrl);
    const body = await res.text();
    if (res.status === 500) {
      log("❌", "500 sur une route inexistante : le fallback SPA parent s'applique de nouveau au vhost API.");
      log("💡", "Correctif : `node scripts/cpanel-remote.js push` réinstalle la garde, ou voir scripts/api-htaccess-guard.conf");
      ok = false;
    } else if (res.status === 404) {
      log("✅", "Routage API isolé du fallback SPA (404 Express attendu).");
    } else if (body.includes("<!doctype html") || body.includes("<!DOCTYPE html")) {
      log("❌", `Une route inexistante de l'API renvoie du HTML (statut ${res.status}) : le fallback SPA parent fuit sur le vhost API.`);
      ok = false;
    } else {
      log("⚠️", `Statut inattendu ${res.status} sur la sonde de non-régression.`);
    }
  } catch (err) {
    log("❌", `Sonde de non-régression injoignable : ${err.message}`);
    ok = false;
  }

  log("🔍", `Test du Frontend : ${config.frontendUrl}`);
  try {
    const start = Date.now();
    const res = await fetch(config.frontendUrl);
    const duration = Date.now() - start;
    if (res.ok) {
      log("✅", `Frontend accessible ! Statut HTTP : ${res.status} (${duration}ms)`);
    } else {
      log("⚠️", `Frontend a retourné le statut HTTP ${res.status}`);
    }
  } catch (err) {
    log("⚠️", `Impossible de joindre le Frontend : ${err.message}`);
  }

  return ok;
}

async function cmdDeployAll() {
  console.log("\n🚀 Démarrage du pipeline complet de déploiement cPanel LWS...\n");
  cmdPackage();
  cmdPush();
  cmdChmod();
  cmdDbPush();
  cmdRestart();
  
  // Attendre 3 secondes que Passenger redémarre
  log("⏳", "Attente de 3 secondes pour le rechargement de Phusion Passenger...");
  await new Promise(r => setTimeout(r, 3000));
  
  const healthy = await cmdHealth();
  if (!healthy) {
    log("❌", "Déploiement terminé mais les vérifications de santé ont ÉCHOUÉ — voir ci-dessus.");
    process.exitCode = 1;
    return;
  }
  log("🎉", "Déploiement et vérifications terminés avec succès !");
}

function showHelp() {
  console.log(`
Bime Link / Bleadin — Outil CLI Déploiement & Maintenance cPanel LWS
Usage: node scripts/cpanel-remote.js <commande>

Commandes disponibles :
  build        Compile le serveur TypeScript et build l'application Vite
  package      Génère le dossier deploy/ et crée les archives ZIP (api.zip, client.zip)
  push         Synchronise les fichiers vers le serveur distant via SCP/SSH
  chmod        Applique les permissions indispensables (chmod -R 755 dist)
  guard-htaccess  (Ré)installe la garde .htaccess isolant l'API du fallback SPA parent
  restart      Déclenche le redémarrage de l'application Phusion Passenger (tmp/restart.txt)
  logs         Affiche les dernières lignes de logs d'erreurs (stderr.log)
  diag         Lance 'node app.js' directement dans le nodevenv distant via SSH
  clean-env    Assainit le fichier .env (supprime BOM UTF-8 et retours CRLF) local et distant
  db-push [--seed]  Applique 'prisma db push' DIRECTEMENT SUR LE SERVEUR via SSH (nodevenv distant).
                     Ajouter --seed pour exécuter 'prisma db seed' juste après.
  health       Interroge les endpoints de santé (/api/health et Frontend)
  deploy-all   Exécute le cycle complet : package -> push -> chmod -> db-push -> restart -> health

Configuration :
  Fichier .env.deploy (voir .env.deploy.example)
  `);
}

// Routeur CLI
const command = process.argv[2] || "--help";

switch (command) {
  case "build":
    cmdBuild();
    break;
  case "package":
    cmdPackage();
    break;
  case "push":
    cmdPush();
    break;
  case "guard-htaccess":
    cmdGuardApiHtaccess();
    break;
  case "chmod":
    cmdChmod();
    break;
  case "restart":
    cmdRestart();
    break;
  case "logs":
    cmdLogs();
    break;
  case "diag":
    cmdDiag();
    break;
  case "clean-env":
    cmdCleanEnv();
    break;
  case "db-push":
    cmdDbPush();
    break;
  case "health":
    if (!(await cmdHealth())) process.exitCode = 1;
    break;
  case "deploy-all":
    await cmdDeployAll();
    break;
  case "--help":
  case "-h":
  case "help":
  default:
    showHelp();
    break;
}
