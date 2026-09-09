import { prisma } from "../lib/prisma.js";
import bcrypt from "bcryptjs";
async function main() {
    console.log("🌱 Seeding database for Bime Link with Multi-Tenant structure...");
    // Clean existing data
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.actionQueue.deleteMany();
    await prisma.prospectCampaignState.deleteMany();
    await prisma.campaignStep.deleteMany();
    await prisma.campaign.deleteMany();
    await prisma.prospect.deleteMany();
    await prisma.prospectList.deleteMany();
    await prisma.linkedInAccount.deleteMany();
    await prisma.user.deleteMany();
    await prisma.organization.deleteMany();
    const defaultPasswordHash = await bcrypt.hash("Admin123!", 10);
    const userPasswordHash = await bcrypt.hash("User123!", 10);
    // 1. Create Default Organizations
    const mainOrg = await prisma.organization.create({
        data: {
            name: "Bime Link Technologies",
            slug: "bime-link-hq",
            plan: "ENTERPRISE",
        },
    });
    const clientOrg = await prisma.organization.create({
        data: {
            name: "Acme Growth Agency",
            slug: "acme-growth",
            plan: "PRO",
        },
    });
    // 2. Create Super Admin User
    const superAdmin = await prisma.user.create({
        data: {
            email: "jeanregis@bimelink.io",
            passwordHash: defaultPasswordHash,
            name: "Jean-Regis N'GUESSAN",
            avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
            role: "SUPER_ADMIN",
            status: "ACTIVE",
            organizationId: mainOrg.id,
            maxDailyInvites: 50,
            maxDailyMsg: 100,
        },
    });
    // 3. Create Tenant Admin and User
    const tenantAdmin = await prisma.user.create({
        data: {
            email: "sarah.growth@acme.com",
            passwordHash: userPasswordHash,
            name: "Sarah Traoré",
            avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
            role: "USER",
            status: "ACTIVE",
            organizationId: clientOrg.id,
            maxDailyInvites: 30,
            maxDailyMsg: 70,
        },
    });
    const normalUser = await prisma.user.create({
        data: {
            email: "marc.sales@acme.com",
            passwordHash: userPasswordHash,
            name: "Marc Koffi",
            avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
            role: "USER",
            status: "ACTIVE",
            organizationId: clientOrg.id,
            maxDailyInvites: 25,
            maxDailyMsg: 50,
        },
    });
    // 4. Create Connected LinkedIn Account for Super Admin
    const account = await prisma.linkedInAccount.create({
        data: {
            userId: superAdmin.id,
            unipileAccountId: "unipile_acc_jr_nguessan_01",
            accountName: "Jean-Regis N'GUESSAN",
            headline: "CEO & Growth Lead @ Bime Link",
            profilePicture: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
            status: "CONNECTED",
            dailyInvitesSent: 19,
            dailyMsgSent: 44,
        },
    });
    // 5. Create Prospect Lists for Super Admin
    const listCI = await prisma.prospectList.create({
        data: {
            userId: superAdmin.id,
            name: "DG Côte d'Ivoire",
            description: "Directeurs Généraux et CEOs basés à Abidjan",
            color: "#592eff",
        },
    });
    const listAzure = await prisma.prospectList.create({
        data: {
            userId: superAdmin.id,
            name: "Microsoft Azure Administrator (AZ-104)",
            description: "Ingénieurs Cloud et DevOps certifiés Azure",
            color: "#2ed6ff",
        },
    });
    // 6. Create Prospects
    const p1 = await prisma.prospect.create({
        data: {
            listId: listCI.id,
            firstName: "Serge Olivier",
            lastName: "SOH",
            headline: "Principal CEO @ Pierre Evan GROUP",
            company: "Pierre Evan GROUP",
            location: "Abidjan, Côte d'Ivoire",
            linkedinUrl: "https://linkedin.com/in/serge-olivier-soh",
            email: "serge.soh@pierreevan.com",
            connectionStatus: "CONNECTED",
            tags: ["VIP", "Décisionnaire"],
        },
    });
    const p2 = await prisma.prospect.create({
        data: {
            listId: listCI.id,
            firstName: "Behi Laetitia",
            lastName: "OUHEI",
            headline: "PDG @ Kansor Collection",
            company: "Kansor Collection",
            location: "Abidjan, Côte d'Ivoire",
            linkedinUrl: "https://linkedin.com/in/laetitia-ouhei",
            email: "l.ouhei@kansor.ci",
            connectionStatus: "CONNECTED",
            tags: ["Retail", "CEO"],
        },
    });
    const p3 = await prisma.prospect.create({
        data: {
            listId: listAzure.id,
            firstName: "Bafo Eric Wilfried",
            lastName: "TOURE",
            headline: "Cloud Infrastructure Architect",
            company: "Orange CI",
            location: "Abidjan, Côte d'Ivoire",
            linkedinUrl: "https://linkedin.com/in/wilfried-toure",
            email: "wilfried.toure@orange.ci",
            connectionStatus: "PENDING",
            tags: ["Cloud", "DevOps"],
        },
    });
    // 7. Create Sample Campaign
    const campaignAzure = await prisma.campaign.create({
        data: {
            userId: superAdmin.id,
            accountId: account.id,
            name: "Microsoft Azure Administrator (AZ-104)",
            status: "ACTIVE",
            type: "INVITATION_AND_3_MESSAGES",
        },
    });
    const step1 = await prisma.campaignStep.create({
        data: {
            campaignId: campaignAzure.id,
            stepOrder: 1,
            actionType: "INVITATION",
            delayDays: 0,
            messageText: "Bonjour {{firstName}}, impressionné par votre parcours chez {{company}}. Connectons-nous !",
        },
    });
    await prisma.prospectCampaignState.create({
        data: {
            campaignId: campaignAzure.id,
            prospectId: p3.id,
            currentStepId: step1.id,
            status: "WAITING_CONDITION",
        },
    });
    // 8. Create Conversation
    const conv1 = await prisma.conversation.create({
        data: {
            prospectId: p1.id,
            unipileChatId: "chat_soh_001",
            lastMessageText: "Parfait Jean-Regis, je suis disponible jeudi à 14h.",
            lastMessageAt: new Date(),
            unreadCount: 1,
        },
    });
    await prisma.message.createMany({
        data: [
            {
                conversationId: conv1.id,
                senderType: "USER",
                text: "Bonjour Serge, ravi d'échanger avec vous !",
                sentAt: new Date(Date.now() - 3600000 * 2),
            },
            {
                conversationId: conv1.id,
                senderType: "PROSPECT",
                text: "Parfait Jean-Regis, je suis disponible jeudi à 14h.",
                sentAt: new Date(Date.now() - 1800000),
            },
        ],
    });
    console.log("✅ Seed completed: Super Admin (jeanregis@bimelink.io / Admin123!), Tenant Admin & Users created!");
}
main()
    .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
