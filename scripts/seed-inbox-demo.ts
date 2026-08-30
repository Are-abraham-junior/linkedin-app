import { prisma } from "../lib/prisma.js";

async function main() {
  console.log("--- SEED CONVERSATIONS INBOX DEMO ---");
  const user = await prisma.user.findFirst();
  if (!user) return;

  // Trouver ou créer des prospects
  let list = await prisma.prospectList.findFirst({ where: { userId: user.id } });
  if (!list) {
    list = await prisma.prospectList.create({
      data: {
        userId: user.id,
        name: "Prospects LinkedIn Démo",
        color: "#592eff",
      },
    });
  }

  const demoProspects = [
    {
      firstName: "Claire",
      lastName: "Delorme",
      company: "HubSpot France",
      headline: "Directrice des Partenariats & Ventes B2B",
      avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face",
      linkedinUrl: "https://www.linkedin.com/in/claire-delorme-demo",
      lastMsg: "Bonjour ! Merci pour votre note. Je serais ravie de faire le point jeudi à 14h, est-ce que cela vous conviendrait ?",
      messages: [
        { senderType: "USER", text: "Bonjour Claire, ravi de faire partie de votre réseau ! Quel est votre projet phare en ce moment chez HubSpot France ?" },
        { senderType: "PROSPECT", text: "Bonjour ! Merci pour votre note. Je serais ravie de faire le point jeudi à 14h, est-ce que cela vous conviendrait ?" },
      ],
      unreadCount: 1,
    },
    {
      firstName: "Marc",
      lastName: "Lemoine",
      company: "Capgemini",
      headline: "VP Engineering & Transformation Cloud",
      avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
      linkedinUrl: "https://www.linkedin.com/in/marc-lemoine-demo",
      lastMsg: "C'est noté, je vous recontacte dès la fin de mon sprint.",
      messages: [
        { senderType: "USER", text: "Bonjour Marc, j'ai vu vos publications sur l'optimisation des architectures cloud. Seriez-vous curieux de découvrir notre approche ?" },
        { senderType: "PROSPECT", text: "Bonjour ! Votre retour d'expérience semble intéressant." },
        { senderType: "USER", text: "Avec grand plaisir ! Voici une synthèse rapide de nos cas clients récents." },
        { senderType: "PROSPECT", text: "C'est noté, je vous recontacte dès la fin de mon sprint." },
      ],
      unreadCount: 0,
    },
    {
      firstName: "Sarah",
      lastName: "Benali",
      company: "Alan",
      headline: "Head of Growth & Acquisition",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face",
      linkedinUrl: "https://www.linkedin.com/in/sarah-benali-demo",
      lastMsg: "Pouvez-vous m'envoyer votre calendrier Calendly ?",
      messages: [
        { senderType: "USER", text: "Bonjour Sarah, félicitations pour vos récents chiffres de croissance chez Alan !" },
        { senderType: "PROSPECT", text: "Merci beaucoup ! Nous accélérons fortement ce trimestre." },
        { senderType: "USER", text: "Avez-vous 10 minutes cette semaine pour échanger sur vos canaux d'acquisition ?" },
        { senderType: "PROSPECT", text: "Pouvez-vous m'envoyer votre calendrier Calendly ?" },
      ],
      unreadCount: 1,
    },
  ];

  for (const dp of demoProspects) {
    let p = await prisma.prospect.findFirst({
      where: {
        listId: list.id,
        firstName: dp.firstName,
        lastName: dp.lastName,
      },
    });

    if (!p) {
      p = await prisma.prospect.create({
        data: {
          listId: list.id,
          firstName: dp.firstName,
          lastName: dp.lastName,
          company: dp.company,
          headline: dp.headline,
          avatarUrl: dp.avatarUrl,
          linkedinUrl: dp.linkedinUrl,
          connectionStatus: "CONNECTED",
        },
      });
    }

    const existingConv = await prisma.conversation.findFirst({
      where: { prospectId: p.id },
    });

    if (!existingConv) {
      const conv = await prisma.conversation.create({
        data: {
          prospectId: p.id,
          unipileChatId: `unipile_demo_${p.id}`,
          lastMessageText: dp.lastMsg,
          lastMessageAt: new Date(),
          unreadCount: dp.unreadCount,
        },
      });

      for (const m of dp.messages) {
        await prisma.message.create({
          data: {
            conversationId: conv.id,
            senderType: m.senderType,
            text: m.text,
            sentAt: new Date(),
          },
        });
      }
      console.log(`✓ Conversation démo créée pour ${p.firstName} ${p.lastName}`);
    }
  }

  console.log("--- SEED TERMINE ---");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
