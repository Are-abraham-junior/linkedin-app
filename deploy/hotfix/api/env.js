import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 1. Charger impérativement depuis le dossier racine absolu du projet (indépendant de process.cwd())
dotenv.config({ path: path.join(__dirname, ".env"), override: true });

// 2. Filet de secours via process.cwd()
dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: true });

/**
 * 3. BRIDAGE DES THREADS — INDISPENSABLE SUR HÉBERGEMENT MUTUALISÉ CLOUDLINUX (LWS)
 *
 * Le moteur de requêtes de Prisma est écrit en Rust et s'appuie sur Tokio, qui
 * dimensionne son pool de threads sur le nombre de cœurs CPU visibles.
 * Sur ce serveur mutualisé : 30 cœurs visibles, mais CloudLinux (LVE) plafonne
 * le compte à ~33 threads/processus TOUTES applications confondues.
 *
 * Résultat sans bridage : Tokio tente de créer ~30 threads, la création échoue
 * (EAGAIN), le thread interne de `futures-timer` meurt, et le moteur panique
 * (« timer has gone away ») puis se fige — TOUTE requête base reste bloquée
 * indéfiniment, sans message d'erreur exploitable côté application.
 *
 * Ces variables doivent être positionnées AVANT tout import de Prisma, d'où
 * leur présence ici (env.js est le tout premier import de app.js).
 * Ne pas retirer sans avoir vérifié `nproc` et la limite de threads du compte.
 */
process.env.TOKIO_WORKER_THREADS = process.env.TOKIO_WORKER_THREADS || "2";
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || "2";
