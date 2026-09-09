#!/usr/bin/env node
/**
 * deploy.js — Script de préparation du déploiement cPanel
 * 
 * Usage: node scripts/deploy.js
 * 
 * Ce script:
 * 1. Compile le serveur TypeScript → JavaScript (dist/)
 * 2. Build le client React/Vite (client/dist/)
 * 3. Génère le client Prisma
 * 4. Crée le dossier deploy/ prêt à uploader sur cPanel
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DEPLOY_DIR = path.join(ROOT, "deploy");
const DEPLOY_API = path.join(DEPLOY_DIR, "api");
const DEPLOY_CLIENT = path.join(DEPLOY_DIR, "client");

function run(cmd, label) {
  console.log(`\n🔨 ${label}...`);
  try {
    execSync(cmd, { stdio: "inherit", cwd: ROOT });
    console.log(`   ✅ ${label} — OK`);
  } catch (err) {
    console.error(`   ❌ ${label} — ÉCHEC`);
    process.exit(1);
  }
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

console.log("🚀 Bime Link — Préparation du déploiement cPanel\n");
console.log("=".repeat(50));

// Nettoyage
console.log("\n🧹 Nettoyage des anciens builds...");
if (fs.existsSync(DEPLOY_DIR)) fs.rmSync(DEPLOY_DIR, { recursive: true });
if (fs.existsSync(path.join(ROOT, "dist"))) fs.rmSync(path.join(ROOT, "dist"), { recursive: true });

// Étape 1: Compiler le serveur
run("npx tsc --outDir dist", "Compilation TypeScript du serveur");

// Étape 2: Générer Prisma Client (optionnel — sera refait sur le serveur cPanel)
console.log("\n🔨 Génération du client Prisma (optionnel)...");
try {
  execSync("npx prisma generate", { stdio: "inherit", cwd: ROOT });
  console.log("   ✅ Génération Prisma — OK");
} catch {
  console.log("   ⚠️  Prisma generate ignoré (sera fait sur le serveur cPanel)");
}

// Étape 3: Build du client
run("npm --prefix client install", "Installation dépendances client");
run("npm --prefix client run build", "Build Vite du client");

// Étape 4: Assembler le dossier API pour cPanel
console.log("\n📦 Assemblage du dossier API...");
fs.mkdirSync(DEPLOY_API, { recursive: true });

// Copier les fichiers compilés du serveur
copyDir(path.join(ROOT, "dist"), path.join(DEPLOY_API, "dist"));

// Copier le schema Prisma (nécessaire pour prisma generate sur le serveur)
copyDir(path.join(ROOT, "prisma"), path.join(DEPLOY_API, "prisma"));

// Copier node_modules essentiels — NON, on fera npm install sur le serveur
// Mais on copie le package.json et les fichiers de config
copyFile(path.join(ROOT, "package.json"), path.join(DEPLOY_API, "package.json"));
copyFile(path.join(ROOT, "package-lock.json"), path.join(DEPLOY_API, "package-lock.json"));
copyFile(path.join(ROOT, "app.js"), path.join(DEPLOY_API, "app.js"));
copyFile(path.join(ROOT, "tsconfig.json"), path.join(DEPLOY_API, "tsconfig.json"));

// Créer un .env template pour la production
const envTemplate = `# === Bime Link — Variables de Production ===
# ⚠️ REMPLIR AVEC VOS VALEURS DE PRODUCTION

# Base de données PostgreSQL (cPanel local)
DATABASE_URL="postgresql://CPUSER_bimeuser:MOT_DE_PASSE@localhost:5432/CPUSER_bimelink_db"

# Serveur
PORT=5000
NODE_ENV=production

# JWT Secret (utiliser une clé forte et unique !)
JWT_SECRET=CHANGER_CETTE_CLE_SECRETE_EN_PRODUCTION

# URL du frontend (pour CORS)
FRONTEND_URL=https://blink.croixance.net

# Self-ping pour garder Passenger actif
SELF_PING_URL=https://blink-api.croixance.net/api/health

# Unipile LinkedIn API
UNIPILE_API_KEY="VOTRE_CLE_API_UNIPILE"
UNIPILE_DSN="https://api64.unipile.com:19478"
UNIPILE_ACCOUNT_ID="VOTRE_ACCOUNT_ID"
`;
fs.writeFileSync(path.join(DEPLOY_API, ".env.template"), envTemplate);

console.log("   ✅ Dossier API assemblé");

// Étape 5: Assembler le dossier Client
console.log("\n📦 Assemblage du dossier Client...");
copyDir(path.join(ROOT, "client", "dist"), DEPLOY_CLIENT);
console.log("   ✅ Dossier Client assemblé");

// Résumé
console.log("\n" + "=".repeat(50));
console.log("✅ Déploiement préparé avec succès !\n");
console.log("📂 Structure créée :");
console.log("   deploy/");
console.log("   ├── api/          → Uploader vers blink-api.croixance.net/");
console.log("   │   ├── app.js");
console.log("   │   ├── dist/     (serveur compilé JS)");
console.log("   │   ├── prisma/");
console.log("   │   ├── package.json");
console.log("   │   └── .env.template");
console.log("   └── client/       → Uploader vers blink.croixance.net/");
console.log("       ├── index.html");
console.log("       ├── .htaccess");
console.log("       └── assets/");
console.log("\n📋 Prochaines étapes :");
console.log("   1. Copier deploy/api/.env.template → deploy/api/.env et remplir les valeurs");
console.log("   2. Uploader deploy/api/* → blink-api.croixance.net/ sur cPanel");
console.log("   3. Uploader deploy/client/* → blink.croixance.net/ sur cPanel");
console.log("   4. Via SSH: cd ~/blink-api.croixance.net && npm install && npx prisma generate && npx prisma db push");
console.log("   5. Redémarrer l'app Node.js dans cPanel");
