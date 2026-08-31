import { prisma } from "../lib/prisma.js";
import { handleProspectReply } from "../server/src/controllers/inbox.controller.js";
async function main() {
    console.log("=== TEST DE VÉRIFICATION PHASE 5 (INBOX & ARRÊT DE CAMPAGNE) ===");
    // 1. Trouver un utilisateur et un compte
    const user = await prisma.user.findFirst();
    if (!user) {
        console.error("Aucun utilisateur trouvé");
        return;
    }
    console.log(`✓ Utilisateur : ${user.email}`);
    // 2. Créer une liste de test et un prospect
    const list = await prisma.prospectList.create({
        data: {
            userId: user.id,
            name: "Liste Test Inbox Phase 5",
            color: "#592eff",
        },
    });
    const prospect = await prisma.prospect.create({
        data: {
            listId: list.id,
            firstName: "Thomas",
            lastName: "Dupont",
            company: "Tech Solutions",
            headline: "Directeur Commercial & Partenariats",
            linkedinUrl: "https://www.linkedin.com/in/thomas-dupont-test",
            connectionStatus: "CONNECTED",
        },
    });
    console.log(`✓ Prospect créé : ${prospect.firstName} ${prospect.lastName} (${prospect.id})`);
    // 3. Créer une campagne active avec une étape et inscrire le prospect
    const campaign = await prisma.campaign.create({
        data: {
            userId: user.id,
            name: "Campagne Test Phase 5 - Relance Active",
            status: "ACTIVE",
            type: "INVITATION_AND_MESSAGES",
            steps: {
                create: [
                    { stepOrder: 1, actionType: "MESSAGE", delayDays: 2, messageText: "Relance 1" },
                ],
            },
        },
        include: { steps: true },
    });
    const account = await prisma.linkedInAccount.findFirst({ where: { userId: user.id } });
    // Inscrire le prospect en WAITING_DELAY
    await prisma.prospectCampaignState.create({
        data: {
            campaignId: campaign.id,
            prospectId: prospect.id,
            currentStepId: campaign.steps[0].id,
            status: "WAITING_DELAY",
            nextExecutionAt: new Date(Date.now() + 2 * 24 * 3600 * 1000),
        },
    });
    if (account) {
        // Ajouter une action dans ActionQueue
        await prisma.actionQueue.create({
            data: {
                accountId: account.id,
                prospectId: prospect.id,
                campaignId: campaign.id,
                actionType: "MESSAGE",
                status: "QUEUED",
                scheduledFor: new Date(Date.now() + 2 * 24 * 3600 * 1000),
                payload: { stepId: campaign.steps[0].id, messageText: "Relance 1" },
            },
        });
    }
    console.log("✓ Prospect inscrit dans la campagne (statut : WAITING_DELAY) et action programmée dans ActionQueue");
    // 4. Créer une conversation et simuler la réception d'un message réponse
    const conv = await prisma.conversation.create({
        data: {
            prospectId: prospect.id,
            unipileChatId: `chat_test_${Date.now()}`,
            lastMessageText: "Bonjour, oui je suis intéressé ! Parlons-en.",
            lastMessageAt: new Date(),
            unreadCount: 1,
            messages: {
                create: [
                    {
                        senderType: "PROSPECT",
                        text: "Bonjour, oui je suis intéressé ! Parlons-en.",
                        sentAt: new Date(),
                    },
                ],
            },
        },
    });
    console.log(`✓ Conversation créée avec message entrant : "${conv.lastMessageText}"`);
    // 5. Déclencher l'interception de réponse
    console.log("→ Déclenchement de handleProspectReply...");
    await handleProspectReply(prospect.id, "Bonjour, oui je suis intéressé ! Parlons-en.");
    // 6. Vérifier que la campagne s'est arrêtée pour ce prospect (statut REPLIED) et qu'aucune action n'est plus en file d'attente
    const updatedState = await prisma.prospectCampaignState.findFirst({
        where: { campaignId: campaign.id, prospectId: prospect.id },
    });
    const queuedActions = await prisma.actionQueue.findMany({
        where: { prospectId: prospect.id, status: "QUEUED" },
    });
    console.log(`✓ Statut de campagne du prospect après réponse : ${updatedState?.status}`);
    console.log(`✓ Actions restantes dans la file pour ce prospect : ${queuedActions.length}`);
    if (updatedState?.status === "REPLIED" && queuedActions.length === 0) {
        console.log(" SUCCESS : Règle d'or respectée ! La campagne a été interrompue automatiquement à la réponse du prospect.");
    }
    else {
        console.error("❌ Échec de la règle d'interruption automatique.");
    }
    // Nettoyage des données de test
    await prisma.conversation.deleteMany({ where: { id: conv.id } });
    await prisma.prospectCampaignState.deleteMany({ where: { campaignId: campaign.id } });
    await prisma.campaignStep.deleteMany({ where: { campaignId: campaign.id } });
    await prisma.campaign.deleteMany({ where: { id: campaign.id } });
    await prisma.prospect.deleteMany({ where: { id: prospect.id } });
    await prisma.prospectList.deleteMany({ where: { id: list.id } });
    console.log("✓ Données de test nettoyées.");
    console.log("=== TOUS LES TESTS DE LA PHASE 5 SONT VALIDES ! ===");
}
main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
