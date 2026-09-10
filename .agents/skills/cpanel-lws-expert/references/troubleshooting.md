# Matrice de Dépannage & Diagnostic de Production (cPanel LWS)

Ce document répertorie tous les incidents fréquents rencontrés lors du déploiement et de la télé-maintenance d'une stack Node.js/Express/Prisma sur cPanel LWS, avec leur diagnostic et leur remédiation immédiate.

---

## 1. Erreur `find: Permission denied` ou `ERR_MODULE_NOT_FOUND` sur `dist/`

### Symptôme
- Passenger affiche une page d'erreur 500 ou les logs mentionnent `Cannot find module './dist/server/src/index.js'`.
- Pourtant, le fichier existe bien dans l'arborescence du serveur.

### Cause Racine
Les archives ZIP générées sous Windows ou transférées sans permissions POSIX perdent le bit d'exécution (`+x`) indispensable sous Linux pour traverser les répertoires.

### Résolution Immédiate
Exécuter via SSH :
```bash
cd ~/api.bleadin.com
chmod -R 755 dist
chmod 644 .env
chmod 644 app.js package.json
```
Ou depuis votre machine locale :
```bash
node scripts/cpanel-remote.js chmod
```

---

## 2. Erreur 500 ou 503 Générique Phusion Passenger (Page Blanche ou HTML Passenger)

### Symptôme
- Le navigateur affiche : *500 Internal Server Error* ou *We're sorry, but something went wrong*.
- Passenger masque l'exception Node.js réelle pour des raisons de sécurité.

### Protocole de Démasquage Immédiat (Diagnostic Direct)
Pour voir l'exception réelle en plein écran avec sa stack trace :

1. **Via l'outil distant local :**
   ```bash
   node scripts/cpanel-remote.js diag
   ```
2. **Ou directement en session SSH sur le serveur :**
   ```bash
   source ~/nodevenv/api.bleadin.com/20/bin/activate
   cd ~/api.bleadin.com
   node app.js
   ```
   *L'erreur exacte (variable manquante, exception de syntaxe, plantage Prisma) s'affiche immédiatement dans la console.*
3. **Une fois identifiée et corrigée :** interrompre le processus (`Ctrl + C`) et redémarrer Passenger :
   ```bash
   node scripts/cpanel-remote.js restart
   ```

---

## 3. Consultation Rapide des Logs Distants (`stderr.log`)

### Commande
```bash
node scripts/cpanel-remote.js logs
# Ou en SSH :
tail -n 100 ~/api.bleadin.com/stderr.log
```

### Points d'Attention
- Si `stderr.log` est volumineux, le purger : `> ~/api.bleadin.com/stderr.log`
- Les erreurs de requêtes HTTP non interceptées et les exceptions asynchrones non catchées y sont consignées.

---

## 4. Rejet Base de Données : `transaction_read_only = on` ou Rejet `pg_hba.conf`

### Symptôme
- L'API démarre mais toute écriture de prospect, campagne ou log échoue avec `read-only transaction`.
- Message d'erreur Postgres : `ERROR: cannot execute INSERT in a read-only transaction`.

### Cause
La base PostgreSQL locale cPanel est bridée par les règles de l'hébergeur LWS ou ses quotas disk/transaction.

### Résolution
Bascule immédiate sur **Neon.tech** managé :
1. Vérifier que la variable `DATABASE_URL` dans `.env` pointe bien vers Neon avec `sslmode=require` :
   ```env
   DATABASE_URL="postgresql://neondb_owner:***@ep-***-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
   ```
2. Pousser le schéma Prisma :
   ```bash
   node scripts/cpanel-remote.js db-push
   ```
3. Redémarrer l'application.

---

## 5. Problèmes de CORS (Cross-Origin Resource Sharing)

### Symptôme
- Dans la console du navigateur sur `https://app.bleadin.com` :  
  `Access to fetch at 'https://api.bleadin.com/api/...' from origin 'https://app.bleadin.com' has been blocked by CORS policy`.

### Vérifications
1. Dans `~/api.bleadin.com/.env`, la variable `FRONTEND_URL` doit être strictement identique au domaine appelant (sans slash final) :
   ```env
   FRONTEND_URL=https://app.bleadin.com
   ```
2. Dans le code Express (`server/src/index.ts`), vérifier que le middleware `cors` autorise les origines configurées ainsi que les méthodes préflight `OPTIONS`.

---

## 6. Version Node.js Incompatible sous cPanel (Setup Node.js App)

### Symptôme
- `SyntaxError: Cannot use import statement outside a module` ou `fetch is not defined`.

### Cause
cPanel a initialisé l'application avec Node 14.x ou 16.x par défaut. Bleadin nécessite **Node.js 20.x ou 22.x**.

### Résolution
1. Se connecter à l'interface cPanel LWS.
2. Aller dans **Setup Node.js App** (Configuration de l'application Node.js).
3. Modifier la version de Node.js pour choisir **20.x** (ou version LTS supérieure).
4. Enregistrer et cliquer sur **Run NPM Install** si nécessaire.
5. Redémarrer l'application.

---

## 7. Blocage Pare-feu Sortant TCP 5432 (ETIMEDOUT vers Neon)

### Symptôme
- Les connexions vers Neon échouent après 10 secondes avec `connect ETIMEDOUT ep-***.aws.neon.tech:5432`.

### Cause
Sur les serveurs mutualisés cPanel (comme LWS), le pare-feu externe CloudLinux/CSF bloque tous les flux sortants sur les ports non standards (notamment TCP 5432).

### Résolution
Utiliser le driver adaptateur **Neon Serverless avec tunnel WebSocket** sur le port standard HTTPS/443 :
```javascript
import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";

neonConfig.webSocketConstructor = ws;
const pool = new NeonPool({ connectionString });
const adapter = new PrismaNeon(pool);
const prisma = new PrismaClient({ adapter });
```

---

## 8. Erreur `No database host or connection string was set, and key parameters have default values (host: localhost, user: ...)`

### Symptôme
- Prisma ou `@neondatabase/serverless` lève l'exception :  
  `Error: No database host or connection string was set, and key parameters have default values (host: localhost, user: c2862963c, db: c2862963c, password: null). Is an environment variable missing?`
- Pourtant `.env` semble bien présent et `dotenv` indique `◇ injected env from .env`.

### Causes Racines
1. **BOM UTF-8 invisible (`\xEF\xBB\xBF`) :** Si le fichier `.env` a été édité ou créé sous Windows avec encodage UTF-8 avec BOM, la première ligne commence par `\uFEFF`. La variable injectée devient `process.env["\uFEFFDATABASE_URL"]` au lieu de `process.env["DATABASE_URL"]` !
2. **`DATABASE_URL` absent ou vide :** La chaîne passée à `new NeonPool({ connectionString })` est `undefined` ou `""`.

### Résolution
1. **Nettoyer `.env` sur le serveur :**
   ```bash
   node -e 'const fs = require("fs"); fs.writeFileSync(".env", fs.readFileSync(".env", "utf8").replace(/^\uFEFF/, "").replace(/\r/g, ""));'
   ```
2. **Résolution défensive dans `lib/prisma.ts` :**
   Toujours rechercher `DATABASE_URL` avec tolérance au BOM et nettoyer les guillemets superflus :
   ```javascript
   const rawUrl = process.env.DATABASE_URL || process.env["\uFEFFDATABASE_URL"] || Object.entries(process.env).find(([k]) => k.includes("DATABASE_URL"))?.[1] || "";
   const connectionString = rawUrl.replace(/^["'\s]+|["'\s]+$/g, "").trim();
   ```
