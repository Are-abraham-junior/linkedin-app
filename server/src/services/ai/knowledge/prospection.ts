export const PROSPECTION_DOC = {
  slug: "prospection-linkedin",
  title: "Prospection LinkedIn — méthode et bonnes pratiques",
  category: "PROSPECTION",
  isCore: false,
  content: `# Méthode de prospection LinkedIn

## 1. Définir la cible (ICP) avant de chercher
Une bonne recherche combine trois axes :
- **Fonction / titre** : DG, Directeur général, CEO, Directeur commercial, DRH, DSI, Responsable achats, Fondateur…
  Pensez aux synonymes et aux variantes locales (ex. « Directeur Général » / « DG » / « Managing Director » / « CEO » ; « DRH » / « HR Director » / « Responsable RH »).
- **Secteur** : pétrole & gaz, banque, assurance, télécoms, BTP, agro-industrie, logistique, santé, éducation, SaaS…
- **Zone géographique** : pays ou ville (Côte d'Ivoire, Abidjan, Sénégal, Dakar, France, Paris, Maroc, Casablanca…).
Ajouter éventuellement la taille d'entreprise (ETI / grands comptes) et des mots-clés (« offshore », « raffinerie », « distribution »).

Conseils :
- Commencer par une recherche de **10 à 25 profils** pour vérifier la pertinence, puis élargir.
- Une recherche trop précise donne peu de résultats : retirer un critère à la fois (d'abord le secteur, puis la ville → pays).
- Toujours vérifier la cohérence des résultats (titre et entreprise) avant d'importer.

## 2. Choisir la séquence selon l'objectif
| Objectif | Séquence recommandée | Pourquoi |
|---|---|---|
| Prise de rendez-vous B2B (décideurs) | VISIT_FOLLOW_INVITE ou INVITE_AND_3_MESSAGES | Le pré-chauffage (visite + follow) augmente l'acceptation ; 2-3 relances de valeur pour obtenir une réponse |
| Cibles très sollicitées (DG, C-level) | VISIT_FOLLOW_INVITE puis message court | Les dirigeants acceptent plus facilement quand ils ont « vu » la personne avant l'invitation |
| Génération de leads volume | INVITE_AND_FOLLOWUPS | Simple, efficace, 2 relances suffisent |
| Recrutement / réseau | SOFT_INVITE | Invitation sans note = meilleur taux d'acceptation ; le message vient après |
| Réactivation de contacts existants | DIRECT_MESSAGES | Les contacts sont déjà connectés : pas d'invitation |
| Consulting / freelance | VISIT_INVITE_1_MESSAGE | Approche consultative, un seul message de présentation |

## 3. Délais entre les étapes
- Visite → Follow : 1 jour. Follow → Invitation : 1 à 2 jours.
- Invitation → 1er message après acceptation : 1 jour (le jour même paraît automatisé).
- Entre deux relances : 3 à 5 jours. Jamais plus de 3 messages sans réponse.
- Durée totale d'une séquence : 10 à 15 jours.

## 4. Repères de performance
- Taux d'acceptation d'invitation : 25–40 % (bon ciblage), > 40 % avec pré-chauffage et note personnalisée courte, < 20 % = revoir la cible ou la note.
- Taux de réponse après connexion : 10–25 %.
- Une invitation **sans note** a souvent un taux d'acceptation supérieur à une note générique ; une note très personnalisée bat les deux.
- Retirer les invitations en attente depuis plus de 3-4 semaines (LinkedIn pénalise un grand nombre d'invitations sans réponse).

## 5. Erreurs à éviter
- Pitcher son produit dans la note d'invitation ou le 1er message.
- Envoyer des volumes élevés dès la connexion du compte (warm-up de 14 jours).
- Mélanger dans une même liste des prospects connectés et non connectés pour une campagne d'invitation (les connectés ne seront pas enrôlés).
- Relancer plus de 3 fois ou sans apporter de nouvelle valeur.
- Utiliser des variables non supportées : seules {{firstName}}, {{lastName}}, {{company}}, {{headline}} existent.
- Cibler trop large (« tous les directeurs en Afrique ») : préférer un couple secteur × pays.

## 6. Limites LinkedIn à respecter
- ~100 invitations par semaine maximum (limite LinkedIn), 80–100 par jour absolu.
- Messages : 100–150 par jour maximum. Visites : ~100 par jour (150 avec Sales Navigator).
- Le filtre par secteur d'activité et par taille d'entreprise nécessite un compte Sales Navigator ; en compte Standard, mettre le secteur dans les mots-clés.
- Les checkpoints (vérification d'identité) surviennent surtout lors de pics d'activité inhabituels : rester progressif.

## 7. Déroulé type avec Bleadin IA
1. Clarifier la cible (fonction, secteur, zone, nombre).
2. Rechercher (search_linkedin_profiles) et présenter les résultats.
3. Créer ou choisir une liste, y ajouter les profils.
4. Proposer une séquence adaptée à l'objectif et rédiger les messages (validation utilisateur).
5. Préparer le brouillon, récapituler (liste, nombre de prospects, étapes) et demander la confirmation de lancement.
`,
};
