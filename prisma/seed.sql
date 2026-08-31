
-- Clean existing data
DELETE FROM "Message";
DELETE FROM "Conversation";
DELETE FROM "ActionQueue";
DELETE FROM "ProspectCampaignState";
DELETE FROM "CampaignStep";
DELETE FROM "Campaign";
DELETE FROM "Prospect";
DELETE FROM "ProspectList";
DELETE FROM "LinkedInAccount";
DELETE FROM "User";
DELETE FROM "Organization";

-- 1. Create Default Organizations
INSERT INTO "Organization" ("id", "name", "slug", "plan", "createdAt", "updatedAt")
VALUES 
  ('org-main-001', 'Bime Link Technologies', 'bime-link-hq', 'ENTERPRISE', NOW(), NOW()),
  ('org-client-001', 'Acme Growth Agency', 'acme-growth', 'PRO', NOW(), NOW());

-- 2. Create Users
INSERT INTO "User" ("id", "email", "passwordHash", "name", "avatarUrl", "role", "status", "organizationId", "maxDailyInvites", "maxDailyMsg", "createdAt", "updatedAt")
VALUES 
  ('usr-superadmin-001', 'jeanregis@bimelink.io', '$2b$10$RT56jOI8CFSw49pSBdHxTOClJ05u.ntK5qYqjKxIJC3OgsAz0H0jO', 'Jean-Regis N''GUESSAN', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', 'SUPER_ADMIN', 'ACTIVE', 'org-main-001', 50, 100, NOW(), NOW()),
  ('usr-tenantadmin-001', 'sarah.growth@acme.com', '$2b$10$.DtrxwP/mqcPkpKl035xYexqnXA4vRIv8xS791d/VWHugVM258C4G', 'Sarah Traoré', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80', 'USER', 'ACTIVE', 'org-client-001', 30, 70, NOW(), NOW()),
  ('usr-normaluser-001', 'marc.sales@acme.com', '$2b$10$.DtrxwP/mqcPkpKl035xYexqnXA4vRIv8xS791d/VWHugVM258C4G', 'Marc Koffi', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', 'USER', 'ACTIVE', 'org-client-001', 25, 50, NOW(), NOW());

-- 3. Create Connected LinkedIn Account for Super Admin
INSERT INTO "LinkedInAccount" ("id", "userId", "unipileAccountId", "accountName", "headline", "profilePicture", "status", "dailyInvitesSent", "dailyMsgSent", "createdAt", "updatedAt")
VALUES 
  ('acc-linkedin-001', 'usr-superadmin-001', 'unipile_acc_jr_nguessan_01', 'Jean-Regis N''GUESSAN', 'CEO & Growth Lead @ Bime Link', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', 'CONNECTED', 19, 44, NOW(), NOW());

-- 4. Create Prospect Lists
INSERT INTO "ProspectList" ("id", "userId", "name", "description", "color", "createdAt", "updatedAt")
VALUES 
  ('list-ci-001', 'usr-superadmin-001', 'DG Côte d''Ivoire', 'Directeurs Généraux et CEOs basés à Abidjan', '#592eff', NOW(), NOW()),
  ('list-azure-001', 'usr-superadmin-001', 'Microsoft Azure Administrator (AZ-104)', 'Ingénieurs Cloud et DevOps certifiés Azure', '#2ed6ff', NOW(), NOW());

-- 5. Create Prospects
INSERT INTO "Prospect" ("id", "listId", "firstName", "lastName", "headline", "company", "location", "linkedinUrl", "email", "connectionStatus", "tags", "doNotContact", "createdAt", "updatedAt")
VALUES 
  ('prsp-001', 'list-ci-001', 'Serge Olivier', 'SOH', 'Principal CEO @ Pierre Evan GROUP', 'Pierre Evan GROUP', 'Abidjan, Côte d''Ivoire', 'https://linkedin.com/in/serge-olivier-soh', 'serge.soh@pierreevan.com', 'CONNECTED', ARRAY['VIP', 'Décisionnaire'], false, NOW(), NOW()),
  ('prsp-002', 'list-ci-001', 'Behi Laetitia', 'OUHEI', 'PDG @ Kansor Collection', 'Kansor Collection', 'Abidjan, Côte d''Ivoire', 'https://linkedin.com/in/laetitia-ouhei', 'l.ouhei@kansor.ci', 'CONNECTED', ARRAY['Retail', 'CEO'], false, NOW(), NOW()),
  ('prsp-003', 'list-azure-001', 'Bafo Eric Wilfried', 'TOURE', 'Cloud Infrastructure Architect', 'Orange CI', 'Abidjan, Côte d''Ivoire', 'https://linkedin.com/in/wilfried-toure', 'wilfried.toure@orange.ci', 'PENDING', ARRAY['Cloud', 'DevOps'], false, NOW(), NOW());

-- 6. Create Campaign
INSERT INTO "Campaign" ("id", "userId", "accountId", "name", "status", "type", "createdAt", "updatedAt")
VALUES 
  ('cmp-azure-001', 'usr-superadmin-001', 'acc-linkedin-001', 'Microsoft Azure Administrator (AZ-104)', 'ACTIVE', 'INVITATION_AND_3_MESSAGES', NOW(), NOW());

INSERT INTO "CampaignStep" ("id", "campaignId", "stepOrder", "actionType", "delayDays", "messageText", "createdAt")
VALUES 
  ('step-azure-001', 'cmp-azure-001', 1, 'INVITATION', 0, 'Bonjour {{firstName}}, impressionné par votre parcours chez {{company}}. Connectons-nous !', NOW());

INSERT INTO "ProspectCampaignState" ("id", "campaignId", "prospectId", "currentStepId", "status", "createdAt", "updatedAt")
VALUES 
  ('pcs-001', 'cmp-azure-001', 'prsp-003', 'step-azure-001', 'WAITING_CONDITION', NOW(), NOW());

-- 7. Create Conversation & Messages
INSERT INTO "Conversation" ("id", "prospectId", "unipileChatId", "lastMessageText", "lastMessageAt", "unreadCount", "createdAt", "updatedAt")
VALUES 
  ('conv-001', 'prsp-001', 'chat_soh_001', 'Parfait Jean-Regis, je suis disponible jeudi à 14h.', NOW(), 1, NOW(), NOW());

INSERT INTO "Message" ("id", "conversationId", "senderType", "text", "sentAt")
VALUES 
  ('msg-001', 'conv-001', 'USER', 'Bonjour Serge, ravi d''échanger avec vous !', NOW() - INTERVAL '2 hours'),
  ('msg-002', 'conv-001', 'PROSPECT', 'Parfait Jean-Regis, je suis disponible jeudi à 14h.', NOW() - INTERVAL '30 minutes');
