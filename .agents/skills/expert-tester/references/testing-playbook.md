# 📘 TESTING PLAYBOOK — DOMAINES APPLICATIFS BLEADIN

Ce guide opérationnel regroupe les procédures de test spécifiques aux différents modules de l'application Bleadin. Utilisez-le pour concevoir rapidement des matrices de test exhaustives.

---

## 1. 🗄️ Base de Données & Modèles Prisma

### Vérifications Systématiques
- **Syntaxe du schéma :** `npx prisma validate`
- **Génération du client :** `npx prisma generate`
- **Synchronisation locale / Neon :** `npx prisma db push` (sans perte de données critiques)

### Cas de Test Clés
1. **Intégrité Multi-Tenant :** Vérifier que chaque prospect, campagne, et compte LinkedIn est strictement lié à un `userId` ou `organizationId`.
2. **Types de données Postgres :** Validation des tableaux de chaînes (`tags String[]`) et colonnes JSONB (`metadata`, `settings`).
3. **Relations & Cascades :** Suppression en cascade ou désactivation logique (`isDeleted`) sur les campagnes avec `ActionQueue`.

---

## 2. 🔐 Authentification & Sécurité (Auth & Security)

### Endpoints
- `POST /api/auth/register` : Création de compte avec mot de passe haché (bcrypt).
- `POST /api/auth/login` : Vérification mot de passe, génération JWT valide avec payload contenant `userId` et `email`.
- `GET /api/auth/me` : Endpoint protégé par `authMiddleware`, validation du token Bearer.

### Cas de Test & Payloads
- **Succès :** Login avec credentials valides ➔ HTTP 200, JWT reçu dans `data.token` ou cookie HTTPOnly.
- **Identifiants invalides :** Mauvais mot de passe ➔ HTTP 401 avec message générique (prévention d'énumération).
- **Format Invalide :** Email non valide ou mot de passe < 6 caractères ➔ HTTP 400 avec erreurs Zod explicites.
- **Accès non autorisé :** Appel d'une route privée sans header `Authorization: Bearer <token>` ➔ HTTP 401.
- **Token expiré / corrompu :** Header `Authorization: Bearer invalid.token.xyz` ➔ HTTP 401 / 403.

---

## 3. 👥 Gestion des Prospects & CRM

### Endpoints
- `GET /api/prospects` : Liste paginée des prospects avec filtres (tags, statut, recherche texte).
- `POST /api/prospects` : Création unitaire d'un prospect (validation Zod sur `linkedinUrl`).
- `POST /api/prospects/import` : Import groupé XLSX/CSV.
- `PATCH /api/prospects/:id` : Mise à jour du statut ou des tags.

### Scénarios de Test
- **Déduplication :** Tenter d'insérer deux fois la même URL LinkedIn pour un même utilisateur ➔ Détection et fusion ou avertissement, pas de doublon sale.
- **Filtrage par tags :** Vérifier que le filtrage sur `tags @> ARRAY['VIP']` fonctionne sans latence.
- **Performance :** Liste de 500+ prospects chargée en moins de 200ms avec pagination (`limit`, `offset` ou curseur).

---

## 4. 🚀 Campagnes & File d'Attente (Queue & Scheduler)

### Endpoints
- `POST /api/campaigns` : Création de séquence (étapes, délais, conditions).
- `POST /api/campaigns/:id/start` : Démarrage d'une campagne ➔ injection d'actions dans `ActionQueue`.
- `POST /api/campaigns/:id/pause` : Mise en pause immédiate.
- `GET /api/queue/stats` : Statistiques de la file (actions en attente, exécutées, échouées).

### Scénarios de Test
- **Jitter & Délais :** Vérifier que les actions planifiées ont un délai aléatoire calculé (30s à 120s) pour éviter l'activité robotique.
- **Quotas Journaliers :** S'assurer que le nombre d'invitations quotidiennes ne dépasse pas la limite configurée (ex: max 100/jour par compte LinkedIn).
- **Reprise après crash :** En cas d'interruption du worker, les actions `PENDING` ou `PROCESSING` doivent pouvoir être réclamées sans doublon (verrouillage transactionnel).

---

## 5. 🔗 Intégration Unipile & LinkedIn

### Points d'Attention
- Référence API officielle : [https://developer.unipile.com/reference](https://developer.unipile.com/reference).
- Ne jamais envoyer de requêtes d'envoi d'invitations réelles en environnement de test local sauf avec des comptes de test autorisés.
- Utiliser des mocks ou vérifier les handlers d'événements webhook.

### Scénarios de Test
- **Webhook Message Reçu :** Simulation d'un payload Unipile `message.received` ➔ Stockage dans la table des messages et mise à jour du prospect en `REPLIED`.
- **Compte Déconnecté (401 Unipile) :** Simulation d'un token LinkedIn expiré ➔ Statut `DISCONNECTED`, suspension de la queue du compte, notification UI sans plantage de l'API.
- **Rate Limit 429 Unipile :** Simulation d'un 429 ➔ Pause du worker pour la durée du `Retry-After` avec backoff exponentiel.

---

## 6. 🎨 Frontend React & Système de Design Adora

### Vérifications
- **Compilation Vite :** `npm --prefix client run build` doit compiler sans warning bloquant ni erreur de typage.
- **Adora Tokens :**
  - Couleur primaire : Electric Violet `#592eff`.
  - Bordures & Rayons : `rounded-3xl` / `rounded-[40px]`.
  - Fonds doux et cartes blanches contrastées.
- **Erreurs Console :** Zéro warning React critique (pas de `key` manquante dans les listes, pas de boucles de rendu `useEffect`).
- **Comportement Responsive :** Test sur résolutions Desktop (1440px), Laptop (1024px) et Mobile (375px).
- **États UI :** Chaque vue de données doit gérer élégamment ses 3 états :
  1. `isLoading = true` : Skeleton loaders ou spinner Adora harmonieux.
  2. `isError = true` : Message d'erreur clair avec bouton de réessai.
  3. `data.length === 0` : Empty state explicite avec Call to Action.
