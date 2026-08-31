import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
    console.log("--- TEST ENREGISTREMENT BROUILLON ---");
    // 1. Trouver un utilisateur
    const user = await prisma.user.findFirst();
    if (!user) {
        console.error("Aucun utilisateur trouvé !");
        return;
    }
    console.log(`Utilisateur test : ${user.email} (${user.id})`);
    // 2. Simuler la création directe d'un brouillon
    const draft = await prisma.campaign.create({
        data: {
            userId: user.id,
            name: "Campagne Test Brouillon - Visite & Invitation",
            type: "VISIT_INVITE_1_MESSAGE",
            status: "DRAFT",
            steps: {
                create: [
                    {
                        stepOrder: 1,
                        actionType: "VISIT_PROFILE",
                        delayDays: 0,
                    },
                    {
                        stepOrder: 2,
                        actionType: "INVITATION",
                        delayDays: 1,
                        messageText: "Bonjour {{firstName}}, test brouillon",
                    },
                ],
            },
        },
        include: {
            steps: true,
        },
    });
    console.log(`Brouillon créé avec succès ! ID = ${draft.id}, Status = ${draft.status}`);
    // 3. Vérifier la récupération des campagnes pour cet utilisateur
    const drafts = await prisma.campaign.findMany({
        where: { userId: user.id, status: "DRAFT" },
        include: { steps: true },
    });
    console.log(`Nombre total de brouillons trouvés en BDD pour cet utilisateur : ${drafts.length}`);
    drafts.forEach((d) => console.log(` - [${d.status}] ${d.name} (${d.steps.length} étapes)`));
    console.log("TEST BROUILLON RÉUSSI AVEC SUCCÈS !");
}
main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
