import { reconcileUnipileAccounts } from "../services/unipileReconcile.service.js";

/**
 * Filet de sécurité facturation : toutes les 6 h, supprime les doublons d'identité LinkedIn
 * chez Unipile et signale (ou supprime si UNIPILE_AUTO_DELETE_ORPHANS=true) les comptes orphelins.
 */
const INTERVAL_MS = 6 * 60 * 60 * 1000;
let isRunning = false;

async function run() {
  if (isRunning) return;
  isRunning = true;
  try {
    await reconcileUnipileAccounts();
  } catch (err: any) {
    console.error("[UnipileReconcile] Erreur:", err?.message || err);
  } finally {
    isRunning = false;
  }
}

export function startUnipileReconcileScheduler() {
  console.log("🧹 [UnipileReconcile] Réconciliation des comptes Unipile démarrée (toutes les 6 h)");
  setTimeout(run, 2 * 60 * 1000);
  setInterval(run, INTERVAL_MS);
}
