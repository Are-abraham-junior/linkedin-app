# Guide d'Architecture & Environnement : cPanel LWS (CloudLinux / Passenger / Neon)

Ce document détaille l'infrastructure d'hébergement cPanel LWS (Ligne Web Services) et les spécificités de son exécution Node.js.

---

## 1. Topologie d'Hébergement cPanel LWS

Sur un hébergement mutualisé ou Cloud cPanel chez LWS, l'application fonctionne sous **CloudLinux OS** avec le gestionnaire d'applications **Phusion Passenger** couplé à Apache.

```
┌────────────────────────────────────────────────────────┐
│ Apache Web Server (Ports 80 / 443 + mod_rewrite / SSL) │
└───────────────────────────┬────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
            ▼                               ▼
  [Front: app.bleadin.com]       [API: api.bleadin.com]
  Fichiers Statiques             Reverse-proxy Phusion Passenger
  React / Vite / .htaccess       Chargement de app.js (ESM)
                                 Activation CloudLinux nodevenv
                                 Connexion PostgreSQL Neon SSL
```

---

## 2. Phusion Passenger & Point d'Entrée `app.js`

### A. Rôle de `app.js`
cPanel configure Phusion Passenger pour exécuter un fichier de démarrage (par défaut `app.js`). Dans notre architecture, le code source TypeScript est compilé dans `dist/` :

```javascript
/**
 * app.js — Point d'entrée Phusion Passenger
 */
import "dotenv/config";
import "./dist/server/src/index.js";
```

### B. Cycle de Vie et Redémarrage (Reload)
Passenger maintient les processus Node.js en mémoire. Pour recharger le code sans redémarrer le serveur physique :
- **Signal universel :** Créer ou toucher le fichier `tmp/restart.txt` dans la racine de l'application :
  ```bash
  mkdir -p tmp && touch tmp/restart.txt
  ```
- **Interface cPanel :** Section *Logiciels* > *Setup Node.js App* > Cliquer sur l'icône de redémarrage (*Restart*).

### C. Gestion des Sockets et Ports
Passenger intercepte le port HTTP et passe une socket UNIX ou un pipe nommé à Node.js.  
Dans `server/src/index.ts`, `app.listen(PORT, ...)` est compatible nativement avec Passenger car Passenger surcharge la variable d'environnement ou le comportement de `listen()`.

---

## 3. Gestionnaire CloudLinux `nodevenv`

Sur cPanel LWS, les versions de Node.js sont cloisonnées via `nodevenv` (similaire aux virtualenvs Python) :

### A. Emplacement Standard
```bash
~/nodevenv/<chemin-de-l-app>/<version-node>/bin/activate
# Exemple :
~/nodevenv/api.bleadin.com/20/bin/activate
```

### B. Commandes Essentielles dans le Terminal SSH
Pour exécuter des commandes Node, npm ou Prisma sur le serveur distant :
```bash
# 1. Activer l'environnement Node dédié
source ~/nodevenv/api.bleadin.com/20/bin/activate

# 2. Se positionner dans le dossier de l'API
cd ~/api.bleadin.com

# 3. Vérifier les versions
node -v
npm -v

# 4. Exécuter une commande directe (diagnostic)
node app.js
```

---

## 4. Base de Données : PostgreSQL Managé Neon vs Interne cPanel

### Le Piège de PostgreSQL Hébergeur cPanel
Les bases PostgreSQL créées via l'interface cPanel locale présentent souvent deux limites critiques :
1. **Verrouillage en lecture seule** (`transaction_read_only = on`) si le quota ou les privilèges d'administrateur système cPanel sont restreints.
2. **Absence de support des types avancés Prisma** (`String[]`, énumérations natives, colonnes vectorielles ou JSONB complexes sans droits superuser).

### Solution de Production : PostgreSQL Neon avec Pooling
L'application Bleadin est connectée à une instance managée **Neon.tech** :
- Chaine de connexion : `postgresql://<user>:<password>@<endpoint>-pooler.<region>.aws.neon.tech/<db>?sslmode=require`
- Avantages : Zéro limite de permissions, SSL obligatoire et sécurisé, pooling PgBouncer natif, support parfait de Prisma v6.

---

## 5. Configuration Apache `.htaccess` pour le Frontend React

Pour une Single Page Application (SPA) React servie sur `app.bleadin.com`, Apache doit rediriger toutes les routes inconnues vers `index.html` :

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>

# En-têtes de sécurité
<IfModule mod_headers.c>
  Header set X-Content-Type-Options "nosniff"
  Header set X-Frame-Options "SAMEORIGIN"
  Header set X-XSS-Protection "1; mode=block"

  Header set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>

# Mise en cache des assets statiques Vite
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType application/javascript "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
</IfModule>
```
