#!/usr/bin/env node

/**
 * run-smoke-tests.js - Smoke testing script for Bleadin local environment
 * Executed by the `expert-tester` skill.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const apiUrlIndex = args.indexOf('--api-url');
const baseUrl = apiUrlIndex !== -1 && args[apiUrlIndex + 1] ? args[apiUrlIndex + 1] : (process.env.API_URL || 'http://localhost:5000');
const outputIndex = args.indexOf('--output');
const outputPath = outputIndex !== -1 && args[outputIndex + 1] ? args[outputIndex + 1] : null;

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

const results = {
  timestamp: new Date().toISOString(),
  targetUrl: baseUrl,
  isDryRun,
  passedCount: 0,
  failedCount: 0,
  warnCount: 0,
  tests: []
};

function recordTest(id, name, status, durationMs, details, error = null) {
  const item = { id, name, status, durationMs, details, error };
  results.tests.push(item);
  if (status === 'PASS') {
    results.passedCount++;
    console.log(`  ${colors.green}✔ [PASS]${colors.reset} ${id} - ${name} (${durationMs}ms)`);
  } else if (status === 'WARN') {
    results.warnCount++;
    console.log(`  ${colors.yellow}⚠ [WARN]${colors.reset} ${id} - ${name} (${durationMs}ms): ${details}`);
  } else {
    results.failedCount++;
    console.log(`  ${colors.red}✖ [FAIL]${colors.reset} ${id} - ${name} (${durationMs}ms)`);
    if (error) console.log(`     ${colors.red}Error: ${error}${colors.reset}`);
  }
}

async function runStaticChecks() {
  console.log(`\n${colors.bold}${colors.cyan}--- Palier 1 : Contrôles Statiques & Compilation ---${colors.reset}`);

  // 1. Prisma Validate
  const startPrisma = Date.now();
  try {
    execSync('npx prisma validate', { stdio: 'pipe' });
    recordTest('STAT-01', 'Validation syntaxe Prisma schema', 'PASS', Date.now() - startPrisma, 'Schéma Prisma valide');
  } catch (err) {
    recordTest('STAT-01', 'Validation syntaxe Prisma schema', 'FAIL', Date.now() - startPrisma, 'Échec prisma validate', err.message);
  }

  // 2. TypeScript server build check
  const startTs = Date.now();
  try {
    execSync('npx tsc --noEmit', { stdio: 'pipe' });
    recordTest('STAT-02', 'Vérification typage TypeScript (tsc --noEmit)', 'PASS', Date.now() - startTs, 'Aucune erreur de compilation TS');
  } catch (err) {
    recordTest('STAT-02', 'Vérification typage TypeScript (tsc --noEmit)', 'FAIL', Date.now() - startTs, 'Erreurs de typage TypeScript détectées', err.stdout ? err.stdout.toString() : err.message);
  }

  // 3. Client build check
  const startClient = Date.now();
  try {
    execSync('npm --prefix client run build', { stdio: 'pipe' });
    recordTest('STAT-03', 'Build Bundle Frontend Vite', 'PASS', Date.now() - startClient, 'Build Vite client complété avec succès');
  } catch (err) {
    recordTest('STAT-03', 'Build Bundle Frontend Vite', 'FAIL', Date.now() - startClient, 'Échec compilation frontend Vite', err.stdout ? err.stdout.toString() : err.message);
  }
}

async function testEndpoint(id, name, path, method = 'GET', body = null, expectedStatus = 200, headers = {}) {
  const start = Date.now();
  try {
    const fetchOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }
    const response = await fetch(`${baseUrl}${path}`, fetchOptions);
    const duration = Date.now() - start;
    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (response.status === expectedStatus) {
      recordTest(id, name, 'PASS', duration, `Code ${response.status} reçu comme attendu`);
      return { success: true, data, status: response.status };
    } else {
      recordTest(id, name, 'FAIL', duration, `Attendu: ${expectedStatus}, Reçu: ${response.status}`, JSON.stringify(data));
      return { success: false, data, status: response.status };
    }
  } catch (err) {
    const duration = Date.now() - start;
    recordTest(id, name, 'FAIL', duration, `Impossible de contacter l'endpoint ${path}`, err.message);
    return { success: false, error: err.message };
  }
}

async function runApiChecks() {
  console.log(`\n${colors.bold}${colors.cyan}--- Palier 2 : Tests Dynamiques API (${baseUrl}) ---${colors.reset}`);

  // Test 1: Health check
  const healthRes = await testEndpoint('API-01', 'Vérification Endpoint /api/health', '/api/health', 'GET', null, 200);

  if (!healthRes.success && healthRes.error && healthRes.error.includes('ECONNREFUSED')) {
    console.log(`\n${colors.yellow}⚠️ Serveur API éteint sur ${baseUrl}. Lancez 'npm run dev:server' pour exécuter les tests dynamiques.${colors.reset}`);
    recordTest('API-WARN', 'Serveur local non démarré', 'WARN', 0, `Connexion refusée sur ${baseUrl}. Lancer le serveur local pour les tests API.`);
    return;
  }

  // Test 2: Auth route rejection with invalid credentials
  await testEndpoint(
    'API-02',
    'Rejet authentification avec faux identifiants',
    '/api/auth/login',
    'POST',
    { email: 'unregistered_test_user@bleadin.local', password: 'WrongPassword123!' },
    401
  );

  // Test 3: Protected route unauthorized without token
  await testEndpoint(
    'API-03',
    'Protection de route /api/prospects sans token',
    '/api/prospects',
    'GET',
    null,
    401
  );

  // Test 4: Protected route unauthorized without token (/api/campaigns)
  await testEndpoint(
    'API-04',
    'Protection de route /api/campaigns sans token',
    '/api/campaigns',
    'GET',
    null,
    401
  );

  // Test 5: Zod payload validation check (missing parameters on registration)
  await testEndpoint(
    'API-05',
    'Validation Zod paramètres invalides sur /api/auth/register',
    '/api/auth/register',
    'POST',
    { email: 'not-an-email' },
    400
  );
}

async function main() {
  console.log(`${colors.bold}🚀 Lancement de la suite de tests locaux Bleadin (expert-tester)...${colors.reset}`);
  
  await runStaticChecks();

  if (!isDryRun) {
    await runApiChecks();
  } else {
    console.log(`\n${colors.yellow}ℹ Mode --dry-run activé : tests API réseau ignorés.${colors.reset}`);
  }

  console.log(`\n${colors.bold}${colors.cyan}--- Résumé de Recette ---${colors.reset}`);
  console.log(`Total passés : ${colors.green}${results.passedCount}${colors.reset}`);
  console.log(`Total avertissements : ${colors.yellow}${results.warnCount}${colors.reset}`);
  console.log(`Total échecs : ${colors.red}${results.failedCount}${colors.reset}`);

  if (outputPath) {
    fs.writeFileSync(path.resolve(process.cwd(), outputPath), JSON.stringify(results, null, 2));
    console.log(`Rapport JSON écrit dans : ${outputPath}`);
  }

  if (results.failedCount > 0) {
    console.log(`\n${colors.bold}${colors.red}❌ Quality Gate Testing : ÉCHOUÉE (${results.failedCount} anomalie(s)). Délégation à debugger requise.${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`\n${colors.bold}${colors.green}✅ Quality Gate Testing : VALIDÉE avec succès !${colors.reset}\n`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Erreur fatale dans le script de smoke test:', err);
  process.exit(1);
});
