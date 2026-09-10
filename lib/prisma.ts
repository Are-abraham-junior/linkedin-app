import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Résolution absolue du dossier racine du projet (garantit de trouver .env sous Passenger où process.cwd() !== dossier app)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../../");

// Forcer le chargement du .env local depuis projectRoot ET process.cwd()
dotenv.config({ path: path.join(projectRoot, ".env"), override: true });
dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: true });

/**
 * BRIDAGE DES THREADS — INDISPENSABLE SUR HÉBERGEMENT MUTUALISÉ CLOUDLINUX (LWS).
 *
 * Le moteur Prisma (Rust/Tokio) dimensionne son pool de threads sur le nombre de
 * cœurs CPU visibles (30 sur ce serveur), alors que CloudLinux plafonne le compte
 * à ~33 threads toutes applications confondues. Sans bridage, la création de
 * threads échoue (EAGAIN), le thread de `futures-timer` meurt et le moteur panique
 * (« timer has gone away ») : toute requête reste alors bloquée indéfiniment.
 *
 * Défini ici (et non uniquement dans env.js) afin que TOUS les points d'entrée en
 * bénéficient : serveur Express, scripts de seed, scripts de maintenance.
 * Doit impérativement être positionné avant l'instanciation de PrismaClient.
 */
process.env.TOKIO_WORKER_THREADS = process.env.TOKIO_WORKER_THREADS || "2";
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || "2";

// Résolution ultra-robuste de DATABASE_URL (gère BOM UTF-8, quotes, espaces)
const rawUrl =
  process.env.DATABASE_URL ||
  process.env["﻿DATABASE_URL"] ||
  Object.entries(process.env).find(([k]) => k.includes("DATABASE_URL"))?.[1] ||
  "";

const connectionString = rawUrl.replace(/^["'\s]+|["'\s]+$/g, "").trim();

if (!connectionString) {
  console.error("❌ [Prisma] ERREUR CRITIQUE: Aucune variable DATABASE_URL trouvée !");
  console.error("Dossier projet résolu:", projectRoot);
  console.error("process.cwd():", process.cwd());
  console.error("Variables disponibles:", Object.keys(process.env).filter((k) => !k.startsWith("npm_")));
  throw new Error("DATABASE_URL manquante ou vide dans l'environnement");
}

/**
 * Le mode de connexion (TCP classique vs socket Unix) et l'usage de SSL sont
 * pilotés ENTIÈREMENT par le contenu de DATABASE_URL — pas par du code.
 * `pg` (via `pg-connection-string`) sait nativement :
 *   - Se connecter en TCP :
 *       postgresql://user:pass@127.0.0.1:5432/dbname
 *       postgresql://user:pass@127.0.0.1:5432/dbname?sslmode=require
 *   - Se connecter via socket Unix, en passant le RÉPERTOIRE du socket comme
 *     "host" (hostname de l'URL laissé vide, socket dir en query param) :
 *       postgresql://user:pass@/dbname?host=/var/run/postgresql
 *   - Par défaut, sans `sslmode`/`ssl*` dans l'URL, SSL reste désactivé — ce
 *     qui correspond au Postgres local LWS qui ne supporte pas SSL.
 *
 * Pour changer de mode de connexion en production : éditer UNIQUEMENT
 * DATABASE_URL dans le .env distant, puis `touch tmp/restart.txt`. Aucun
 * redéploiement de code n'est nécessaire.
 *
 * DB_SSL (optionnel, prioritaire sur l'URL) permet de forcer explicitement :
 *   DB_SSL=false  -> désactive SSL même si l'URL contient sslmode=require
 *   DB_SSL=true   -> force SSL (rejectUnauthorized: false, certif LWS non fournie)
 *   (absent)      -> laisse pg-connection-string décider depuis DATABASE_URL
 */
const dbSslEnv = (process.env.DB_SSL || "").trim().toLowerCase();
let sslOverride: pg.PoolConfig["ssl"] | undefined;
if (["false", "disable", "off", "0"].includes(dbSslEnv)) {
  sslOverride = false;
} else if (["true", "require", "on", "1"].includes(dbSslEnv)) {
  sslOverride = { rejectUnauthorized: false };
}

const poolConfig: pg.PoolConfig = { connectionString };
if (sslOverride !== undefined) {
  poolConfig.ssl = sslOverride;
}

const pool = new pg.Pool(poolConfig);

// Éviter tout crash de processus Node sur erreur de socket / pool idle
pool.on("error", (err) => {
  console.error("⚠️ [Prisma/pg.Pool] Erreur de pool non fatale :", err.message);
});

const isSocketUrl = /[?&]host=%2F|[?&]host=\//i.test(connectionString);
console.log(
  `🔌 [Prisma] Connexion PostgreSQL (${isSocketUrl ? "socket Unix" : "TCP"})` +
    (sslOverride !== undefined ? ` — SSL forcé via DB_SSL=${dbSslEnv}` : " — SSL piloté par DATABASE_URL")
);

const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
