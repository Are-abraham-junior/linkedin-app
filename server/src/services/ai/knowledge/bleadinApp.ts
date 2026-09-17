import { BILLING_PLANS, DAILY_SAFETY_CAPS, ENRICHMENT_COST, WARMUP_DAYS } from "../../../config/plans.js";

function plansTable(): string {
  const rows = Object.entries(BILLING_PLANS).map(([id, p]) => {
    return `| ${p.name} (${id}) | ${p.monthly} €/mois (${p.annual} €/mois en annuel) | ${p.maxProspects.toLocaleString("fr-FR")} prospects | ${p.maxTeamSeats} siège(s) | ${p.enrichmentTokens} tokens/mois | invitations ${p.actions.invites.week}/sem · ${p.actions.invites.month}/mois | messages ${p.actions.messages.week}/sem · ${p.actions.messages.month}/mois | visites ${p.actions.visits.week}/sem · ${p.actions.visits.month}/mois | follows ${p.actions.follows.week}/sem · ${p.actions.follows.month}/mois |`;
  });
  return [
    "| Offre | Prix | Prospects max | Équipe | Enrichissement | Invitations | Messages | Visites | Follows |",
    "|---|---|---|---|---|---|---|---|---|",
    ...rows,
  ].join("\n");
}

export const BLEADIN_APP_DOC = {
  slug: "bleadin-app",
  title: "Bleadin — présentation de l'application",
  category: "BLEADIN",
  isCore: true,
  content: `# Bleadin — ce que c'est

Bleadin est une plateforme SaaS de prospection LinkedIn automatisée. Elle se connecte au compte LinkedIn de l'utilisateur (via un partenaire technique, Unipile) pour rechercher des profils, gérer des listes de prospects, lancer des séquences d'actions (visites de profil, follows, invitations, messages) et centraliser la messagerie LinkedIn.

Bleadin IA est l'assistant intégré : il agit comme un expert en prospection LinkedIn. Il peut chercher des profils, créer, renommer et supprimer des listes, y ajouter des profils, proposer une séquence de campagne, rédiger les messages, lire une campagne existante (étapes, messages, délais, statistiques), modifier ses messages et ses délais (brouillon, active ou en pause), conseiller une stratégie de prospection et préparer le lancement. **Le lancement d'une campagne et la suppression d'une liste exigent toujours une confirmation explicite de l'utilisateur (clic sur le bouton de la carte).** Il ne peut pas : supprimer une campagne, envoyer un message immédiat hors campagne, connecter le compte LinkedIn, ni modifier l'offre ou la facturation.

## Menus de l'application
- **Tableau de bord** : indicateurs (invitations envoyées, acceptées, messages, réponses), activité récente.
- **Contacts & Prospects** : listes de prospects (CRM). Import par recherche LinkedIn (critères, URL de recherche, engagements d'un post), fichier CSV/Excel, ou via Bleadin IA.
- **Messagerie (Inbox)** : miroir de la messagerie LinkedIn, avec fiche prospect.
- **Campagnes** : création (assistant en 4 étapes : modèle → liste/prospects → messages → lancement), suivi (funnel, statuts), pause/reprise, brouillons.
- **Rapports** : rapports d'activité, export PDF/Excel, envoi automatique par e-mail (quotidien/hebdomadaire).
- **Équipe** : membres de l'organisation (OWNER / ADMIN / MEMBER).
- **Paramètres** : compte, connexion LinkedIn, heures et jours de travail, fuseau horaire, imports, intégrations (Brevo, HubSpot, Google Sheets), clés API, facturation.
- **Bleadin IA** : le chat avec l'assistant (réservé aux offres Pro et Business).

## Chemins dans l'application (pour guider l'utilisateur pas à pas)
Quand l'utilisateur veut faire quelque chose lui-même, décrire ces clics (jamais des noms techniques) :
- Chercher des prospects sur LinkedIn : **Contacts & Prospects → bouton « Importer des prospects » → onglet « Recherche LinkedIn »** → saisir le poste, le lieu, les mots-clés → « Rechercher » → cocher les profils → bouton « Importer (N profils) » en choisissant la liste (nouvelle ou existante).
- Importer un fichier : **Contacts & Prospects → « Importer des prospects » → onglet « Fichier CSV / Excel »**.
- Créer, renommer ou supprimer une liste : **Contacts & Prospects → panneau des listes** (menu de la liste : « Renommer la liste » / « Supprimer »).
- Créer une campagne : **Campagnes → « Nouvelle campagne »** → 1) choisir un modèle de séquence → 2) choisir la ou les listes → 3) relire et personnaliser les messages et les délais → 4) « Sauvegarder » (brouillon, retrouvable dans l'onglet « Brouillons ») ou « Lancer la campagne ».
- Modifier les messages ou les délais d'une campagne existante : **Campagnes → ouvrir la campagne → « Éditer la séquence »**.
- Mettre en pause / reprendre : **Campagnes → bouton pause/lecture sur la campagne**.
- Connecter LinkedIn : **Paramètres → onglet « LinkedIn & Connexions » → « Connecter mon compte »**.
- Heures et jours d'envoi, fuseau horaire : **Paramètres → onglet « Mon Compte »** (section heures et jours de travail).
- Voir les quotas : **Tableau de bord** (jauges) ou demander à Bleadin IA.
- Répondre à un prospect : **Messagerie (Inbox)**.
Alternative toujours proposée : Bleadin IA peut faire lui-même la recherche, la liste, la séquence et la préparation du lancement ; l'utilisateur n'a plus qu'à valider.

## Prospects et listes
- Un prospect = une personne LinkedIn (prénom, nom, titre, entreprise, localisation, URL LinkedIn, statut de connexion NOT_CONNECTED / PENDING / CONNECTED).
- Les prospects sont rangés dans des **listes**. Une liste sert de cible à une campagne.
- Dédoublonnage automatique sur l'URL LinkedIn : un même profil n'est pas importé deux fois.
- Les e-mails et téléphones ne sont **jamais** récupérés automatiquement : ils sont révélés à la demande avec des **tokens d'enrichissement** (${ENRICHMENT_COST.email} token par e-mail trouvé, ${ENRICHMENT_COST.phone} par téléphone trouvé, remboursés si rien n'est trouvé). Chaque révélation compte comme une visite de profil.

## Campagnes
Une campagne = une **séquence ordonnée d'étapes** appliquée à chaque prospect d'une ou plusieurs listes.

Types d'étapes :
- **VISIT_PROFILE** : visite du profil (signal doux, augmente le taux d'acceptation).
- **FOLLOW** : s'abonner au profil.
- **INVITATION** : demande de connexion, avec ou sans note (note ≤ 300 caractères).
- **MESSAGE** : message LinkedIn (nécessite que le prospect soit connecté au 1er degré).
- **DELAY** : attente.
Chaque étape a un **délai en jours** (delayDays) par rapport à l'étape précédente.

Règles d'éligibilité automatiques :
- Si la 1re étape est une **INVITATION** : seuls les prospects **non connectés** sont enrôlés.
- Si la 1re étape est un **MESSAGE** : seuls les prospects **déjà connectés** sont enrôlés.
- Un prospect déjà engagé dans une campagne active n'est pas ré-enrôlé.
- Après une invitation, la séquence attend l'**acceptation** avant d'envoyer le message suivant (vérification toutes les 5 minutes). Si le prospect répond, la séquence s'arrête pour lui.

Variables de personnalisation utilisables dans les messages : \`{{firstName}}\`, \`{{lastName}}\`, \`{{company}}\`, \`{{headline}}\`. Aucune autre variable n'existe.

Statuts de campagne : DRAFT (brouillon), ACTIVE, PAUSED, COMPLETED, ARCHIVED.

Modèles de séquences disponibles (identifiants) : INVITE_AND_3_MESSAGES, VISIT_FOLLOW_INVITE, VISIT_INVITE_1_MESSAGE, INVITE_AND_FOLLOWUPS, SOFT_INVITE, DIRECT_MESSAGES.

## Sécurité du compte LinkedIn : quotas et horaires
- Les actions s'exécutent uniquement pendant les **heures et jours de travail** configurés par l'utilisateur (par défaut lundi–vendredi, 08:00–19:00, fuseau de l'utilisateur), espacées de façon aléatoire.
- Les quotas sont **hebdomadaires et mensuels** selon l'offre ; le volume journalier est réparti automatiquement et varie chaque jour (jamais un chiffre fixe) pour rester naturel aux yeux de LinkedIn.
- Plafonds journaliers de sécurité jamais dépassés : ${DAILY_SAFETY_CAPS.invites} invitations, ${DAILY_SAFETY_CAPS.messages} messages, ${DAILY_SAFETY_CAPS.visits} visites, ${DAILY_SAFETY_CAPS.follows} follows.
- Un compte LinkedIn fraîchement connecté est en **montée en charge** pendant ${WARMUP_DAYS} jours (volumes réduits).
- LinkedIn limite lui-même les invitations à environ 100/semaine ; Bleadin respecte cette limite.
- Si LinkedIn demande une vérification (checkpoint) ou si le compte est déconnecté, les campagnes sont mises en pause automatiquement jusqu'à reconnexion dans Paramètres → LinkedIn.

## Offres et quotas
${plansTable()}

Les quotas exacts restants d'un utilisateur ne sont connus qu'en interrogeant son compte (outil get_account_status) — ne jamais les deviner.

## Ce que Bleadin ne fait PAS
- Pas d'envoi d'e-mails de prospection (les e-mails servent uniquement aux rapports automatiques).
- Pas de scraping massif : les recherches passent par le compte LinkedIn de l'utilisateur et respectent ses limites.
- Pas d'InMail, pas de publication de posts, pas de commentaires automatiques.
- Pas d'accès à un CRM externe autre que les intégrations listées.
`,
};
