export const REDACTION_DOC = {
  slug: "redaction-messages",
  title: "Rédaction des messages LinkedIn",
  category: "REDACTION",
  isCore: false,
  content: `# Rédiger des messages LinkedIn qui obtiennent des réponses

## Contraintes techniques
- Note d'invitation : **300 caractères maximum** (variables comprises après remplacement — viser 200-250).
- Message LinkedIn : rester sous 500 caractères pour le 1er message, 300 pour les relances. Les messages longs ne sont pas lus sur mobile.
- Variables disponibles : {{firstName}}, {{lastName}}, {{company}}, {{headline}}. Ne jamais en inventer d'autres ({{poste}}, {{ville}}, {{secteur}} n'existent pas).
- Pas de liens dans la note d'invitation. Pas de pièce jointe.
- Toujours en français si le prospect est francophone, sans anglicismes gratuits.

## Structure d'une note d'invitation (≤ 300 caractères)
1. Salutation personnalisée : « Bonjour {{firstName}}, »
2. Un point d'accroche crédible et spécifique (secteur, entreprise, actualité, point commun).
3. Une raison d'échanger, sans pitch.
4. Formule courte.

Exemple bon : « Bonjour {{firstName}}, je suis avec intérêt les évolutions du secteur pétrolier en Côte d'Ivoire et le rôle de {{company}}. J'aimerais échanger sur vos enjeux logistiques. Au plaisir d'être en relation ! » (≈ 200 caractères)

Exemple mauvais : « Bonjour, je suis commercial chez X, leader des solutions Y. Nous proposons -30 % ce mois-ci, découvrez notre offre sur www… » — pitch, lien, aucune personnalisation.

## Structure du 1er message après connexion
1. Remercier brièvement pour la connexion.
2. Montrer qu'on connaît son contexte (1 phrase).
3. Poser **une question ouverte** liée à un enjeu de son poste (pas une question fermée).
4. Ne pas vendre. Ne pas proposer de rendez-vous dès le 1er message sauf si l'accroche est très forte.

Exemple bon : « Merci pour la connexion {{firstName}} ! Chez {{company}}, comment gérez-vous aujourd'hui la traçabilité de vos approvisionnements ? Curieux d'avoir votre regard. »

Exemple mauvais : « Merci ! Voici notre plaquette, quand êtes-vous disponible pour une démo de 30 minutes ? »

## Relances (messages 2 et 3)
- Relance 1 (J+3 à J+5) : **apporter de la valeur** — un chiffre, un retour d'expérience, une idée concrète liée à son secteur. Terminer par une question simple.
- Relance 2 (J+4 à J+5 après) : **message de rupture**, bienveillant et court : on n'insiste pas, on laisse la porte ouverte.
- Jamais « je me permets de relancer mon précédent message » seul : toujours ajouter un élément nouveau.

Exemple relance de valeur : « Bonjour {{firstName}}, un retour rapide : une entreprise comparable à {{company}} a réduit de 20 % ses délais de dédouanement en digitalisant ses bons de commande. Est-ce un sujet chez vous en ce moment ? »

Exemple message de rupture : « Bonjour {{firstName}}, je ne veux pas être insistant. Si le sujet n'est pas prioritaire, aucun souci — je reste disponible et continue de suivre l'actualité de {{company}}. Belle journée ! »

## Ton et style
- Tutoiement / vouvoiement : vouvoiement par défaut pour des dirigeants.
- Phrases courtes, un seul sujet par message, une seule question.
- Éviter : « leader », « innovant », « révolutionnaire », « solution clé en main », les majuscules, les émojis en série, les points d'exclamation multiples.
- Personnaliser au-delà du prénom : secteur, pays, actualité, défi typique du poste.

## Adaptation par persona
- **DG / CEO** : parler résultats, croissance, risques, temps. Messages très courts.
- **Directeur commercial** : pipeline, taux de conversion, cycle de vente.
- **DRH** : recrutement, rétention, formation, marque employeur.
- **DSI / CTO** : sécurité, intégration, dette technique, coûts.
- **Achats / Supply** : coûts, délais, fiabilité fournisseurs, conformité.
- **Fondateur de start-up** : traction, financement, go-to-market ; tutoiement possible.

## Check-list avant validation d'un message
- [ ] Longueur respectée (invitation ≤ 300 caractères).
- [ ] Variables valides uniquement.
- [ ] Une seule question, ouverte.
- [ ] Aucun pitch produit dans l'invitation ni dans le 1er message.
- [ ] Pas de lien, pas de faute, pas de formule vide.
- [ ] Le message aurait du sens même sans les variables.
`,
};
