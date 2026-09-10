# Runbooks Opérationnels : Déploiement & Maintenance cPanel LWS

Ce document détaille les procédures pas-à-pas pour les opérations de mise en production, maintenance et restauration d'urgence sur l'infrastructure cPanel LWS.

---

## Runbook 1 : Déploiement Initial (Setup Initial d'un Compte ou Sous-domaine)

### Étape 1 : Création des Sous-domaines dans cPanel
1. Accéder au panneau cPanel LWS > Section **Domaines** > **Domaines**.
2. Créer les deux domaines/sous-domaines :
   - `app.bleadin.com` (Répertoire racine : `~/app.bleadin.com`)
   - `api.bleadin.com` (Répertoire racine : `~/api.bleadin.com`)
3. Activer le certificat SSL Let's Encrypt / AutoSSL sur les deux domaines.

### Étape 2 : Configuration de l'Application Node.js dans cPanel
1. Dans cPanel, ouvrir **Setup Node.js App**.
2. Cliquer sur **Create Application** :
   - **Node.js version :** Choisir **20.x** (ou LTS récente).
   - **Application mode :** **Production**.
   - **Application root :** `api.bleadin.com` (ou chemin exact du dossier).
   - **Application URL :** `api.bleadin.com`.
   - **Application startup file :** `app.js`.
3. Cliquer sur **Create**.
4. Noter la commande d'activation du `nodevenv` affichée en haut de la page (ex: `source /home/.../nodevenv/api.bleadin.com/20/bin/activate`).

### Étape 3 : Premier Déploiement
1. Renseigner `.env.deploy` en local (depuis `.env.deploy.example`).
2. Lancer le déploiement complet :
   ```bash
   npm run deploy:remote
   ```
3. Via le terminal SSH cPanel :
   ```bash
   source ~/nodevenv/api.bleadin.com/20/bin/activate
   cd ~/api.bleadin.com
   npm install --omit=dev
   npx prisma generate
   ```
4. Redémarrer l'application depuis cPanel ou via :
   ```bash
   npm run remote:restart
   ```
5. Valider avec `npm run remote:health`.

---

## Runbook 2 : Déploiement Continu / Mises à Jour Régulières

Pour toute nouvelle mise à jour (nouvelles fonctionnalités, correctifs) :

```bash
# 1. Vérifier la compilation locale
npm run build:server
npx prisma validate

# 2. Exécuter le pipeline complet automatisé
npm run deploy:remote

# 3. Vérifier les métriques de santé
npm run remote:health
```

Si le terminal SSH n'est pas utilisé pour le push automatique, utiliser le **Runbook 3**.

---

## Runbook 3 : Déploiement de Secours via l'Interface Web cPanel (Sans SSH)

En cas d'indisponibilité de SSH ou de restriction réseau :

1. **Générer les archives en local :**
   ```bash
   npm run deploy:package
   ```
   *Ceci génère `deploy/api.zip` et `deploy/client.zip`.*

2. **Uploader l'API :**
   - Ouvrir **Gestionnaire de fichiers** (File Manager) dans cPanel.
   - Naviguer dans le dossier de l'API (`~/api.bleadin.com`).
   - Cliquer sur **Charger** et envoyer `deploy/api.zip`.
   - Faire un clic droit sur `api.zip` > **Extraire** (Extract).
   - Supprimer le fichier `api.zip`.
   - S'assurer que le fichier `.env` de production est bien présent dans le dossier racine de l'API.

3. **Uploader le Client Frontend :**
   - Naviguer dans le dossier du client (`~/app.bleadin.com`).
   - Cliquer sur **Charger** et envoyer `deploy/client.zip`.
   - Extraire `client.zip` directement dans la racine du dossier client.
   - Supprimer `client.zip`.
   - Vérifier la présence du fichier `.htaccess`.

4. **Redémarrer Passenger :**
   - Aller dans **Setup Node.js App** > Cliquer sur **Restart**.
   - Tester l'URL publique `https://app.bleadin.com` et `https://api.bleadin.com/api/health`.

---

## Runbook 4 : Procédure de Rollback d'Urgence

En cas de régression majeure après mise en production :

1. **Restauration via l'archive précédente :**
   Si des archives versionnées sont conservées dans `deploy/backups/`, réextraire la version précédente.
2. **Re-pointage immédiat :**
   ```bash
   # Via SSH
   cd ~/api.bleadin.com
   # Rétablir dist précédent si renommé dist_backup
   mv dist dist_broken && mv dist_previous dist
   mkdir -p tmp && touch tmp/restart.txt
   ```
3. **Tester la santé :**
   ```bash
   curl -I https://api.bleadin.com/api/health
   ```
