export type Role = "SUPER_ADMIN" | "USER";
export type UserStatus = "ACTIVE" | "SUSPENDED" | "PENDING_INVITE";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

export interface LinkedInAccount {
  id: string;
  accountName: string | null;
  headline: string | null;
  profilePicture: string | null;
  status: string;
  dailyInvitesSent: number;
  dailyMsgSent: number;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: Role;
  status: UserStatus;
  organizationId?: string | null;
  organization?: Organization | null;
  maxDailyInvites: number;
  maxDailyMsg: number;
  createdAt?: string;
  linkedInAccount?: LinkedInAccount | null;
  stats?: {
    lists?: number;
    campaigns?: number;
    listsCount?: number;
    campaignsCount?: number;
  };
}

export interface PlatformMetrics {
  totalUsers: number;
  totalOrganizations: number;
  totalProspects: number;
  totalCampaigns: number;
  activeCampaigns: number;
  totalMessages: number;
  connectedAccounts: number;
  usersByRole: Record<string, number>;
}

export type CampaignStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
export type ActionType = "INVITATION" | "MESSAGE" | "VISIT_PROFILE" | "VISIT" | "FOLLOW" | "DELAY";
export type ProspectStepStatus =
  | "PENDING"
  | "WAITING_CONDITION"
  | "WAITING_DELAY"
  | "IN_PROGRESS"
  | "REPLIED"
  | "COMPLETED"
  | "FAILED";

export interface CampaignStep {
  id?: string;
  stepOrder: number;
  actionType: ActionType;
  delayDays: number;
  messageText?: string | null;
}

export interface CampaignStats {
  totalProspects: number;
  acceptedCount: number;
  repliedCount: number;
  completedCount: number;
  acceptanceRate: number;
  replyRate: number;
  waitingCondition?: number;
  waitingDelay?: number;
  failed?: number;
}

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  type: string;
  createdAt: string;
  updatedAt: string;
  stepsCount?: number;
  steps: CampaignStep[];
  stats: CampaignStats;
}

export interface ChatMessage {
  id: string;
  unipileMessageId?: string;
  senderType: "USER" | "PROSPECT";
  text: string;
  sentAt: string;
}

export interface InboxConversation {
  id: string;
  unipileChatId?: string;
  lastMessageText?: string;
  lastMessageAt?: string;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  prospect: {
    id: string;
    firstName: string;
    lastName: string;
    headline?: string;
    company?: string;
    avatarUrl?: string;
    linkedinUrl: string;
    connectionStatus: string;
    tags?: string[];
    campaignState?: {
      campaignId: string;
      campaignName: string;
      status: ProspectStepStatus;
      currentStepOrder?: number;
    } | null;
  };
}


