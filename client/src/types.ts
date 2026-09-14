export type Role = "SUPER_ADMIN" | "USER";
export type UserStatus = "ACTIVE" | "SUSPENDED" | "PENDING_INVITE";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  avatarUrl?: string | null;
}

export interface LinkedInAccount {
  id: string;
  accountName: string | null;
  headline: string | null;
  profilePicture: string | null;
  status: string;
  dailyInvitesSent: number;
  dailyMsgSent: number;
  isPremium?: boolean;
  hasSalesNavigator?: boolean;
  accountType?: "STANDARD" | "PREMIUM" | "SALES_NAVIGATOR" | "RECRUITER" | string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl: string | null;
  role: Role;
  orgRole?: "OWNER" | "ADMIN" | "MEMBER";
  status: UserStatus;
  hasLinkedInAccount?: boolean;
  organizationId?: string | null;
  organization?: Organization | null;
  maxDailyInvites: number;
  maxDailyMsg: number;
  createdAt?: string;
  linkedinEmail?: string | null;
  linkedInAccount?: LinkedInAccount | null;
  stats?: {
    lists?: number;
    campaigns?: number;
    listsCount?: number;
    campaignsCount?: number;
  };
}

export interface TeamMemberBreakdown {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  orgRole: "OWNER" | "ADMIN" | "MEMBER";
  status: UserStatus;
  hasLinkedInAccount: boolean;
  linkedInAccountName?: string | null;
  dailyInvitesSent: number;
  dailyMsgSent: number;
  maxDailyInvites: number;
  maxDailyMsg: number;
  totalCampaigns: number;
  activeCampaigns: number;
  totalProspects: number;
}

export interface TeamMetrics {
  totalMembers: number;
  connectedAccounts: number;
  totalProspects: number;
  totalCampaigns: number;
  activeCampaigns: number;
  totalInvitesSent: number;
  totalMsgSent: number;
  membersBreakdown: TeamMemberBreakdown[];
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
  status?: "sending" | "sent" | "delivered" | "read" | "error";
  attachments?: Array<{
    id?: string;
    file_name?: string;
    file_type?: string;
    url?: string;
    size?: number;
  }>;
}

export interface InboxProspect {
  id: string;
  firstName: string;
  lastName: string;
  headline?: string;
  company?: string;
  location?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  linkedinUrl: string;
  connectionStatus: "CONNECTED" | "PENDING" | "NOT_CONNECTED" | string;
  tags?: string[];
  doNotContact?: boolean;
  list?: {
    id: string;
    name: string;
    color?: string;
  };
  campaignState?: {
    campaignId: string;
    campaignName: string;
    status: ProspectStepStatus;
    currentStepOrder?: number;
  } | null;
}

export interface InboxConversation {
  id: string;
  unipileChatId?: string;
  lastMessageText?: string;
  lastMessageAt?: string;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  prospect: InboxProspect;
}

export interface ProspectItem {
  id: string;
  listId: string;
  firstName: string;
  lastName: string;
  headline?: string;
  company?: string;
  location?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  linkedinUrl: string;
  connectionStatus: string;
  tags: string[];
  doNotContact: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Rapports ────────────────────────────────────────────────────────────────

export interface ReportActionCounters {
  invitesSent: number;
  messagesSent: number;
  visits: number;
  follows: number;
  failedActions: number;
  queued: number;
  repliesReceived: number;
}

export interface ReportCampaignStats extends ReportActionCounters {
  totalProspects: number;
  acceptedCount: number;
  repliedCount: number;
  completedCount: number;
  waitingCondition: number;
  waitingDelay: number;
  failed: number;
  acceptanceRate: number;
  replyRate: number;
}

export interface ReportTimelinePoint {
  date: string;
  invitesSent: number;
  messagesSent: number;
  replies: number;
}

export interface ReportProspect {
  id: string;
  firstName: string;
  lastName: string;
  headline?: string | null;
  company?: string | null;
  location?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedinUrl: string;
  connectionStatus: string;
  status: ProspectStepStatus;
  currentStepOrder: number | null;
  currentStepType: ActionType | null;
  lastActionAt?: string | null;
  enrolledAt: string;
}

export interface ReportCampaign {
  id: string;
  name: string;
  status: CampaignStatus;
  type: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; orgRole?: string | null } | null;
  steps: CampaignStep[];
  stats: ReportCampaignStats;
  previousStats?: ReportActionCounters | null;
  timeline: ReportTimelinePoint[];
  prospects?: ReportProspect[];
}

export interface ReportComparison {
  period: { from: string; to: string };
  summary: ReportActionCounters;
  deltas: Record<keyof ReportActionCounters, number | null>;
}

export type ReportEmailFrequency = "NONE" | "DAILY" | "WEEKLY";

export interface ReportSettings {
  emailFrequency: ReportEmailFrequency;
  lastSentAt: string | null;
  available: boolean;
}

export interface ReportHistoryEntry {
  id: string;
  userId: string;
  userName: string;
  kind: "PDF" | "XLSX" | "CONTACTS";
  filename: string;
  periodFrom: string;
  periodTo: string;
  campaignIds: string[];
  campaignsCount: number;
  prospectsCount?: number;
  createdAt: string;
}

export interface ReportSummary extends ReportActionCounters {
  campaigns: number;
  activeCampaigns: number;
  totalProspects: number;
  acceptedCount: number;
  repliedCount: number;
  completedCount: number;
  failed: number;
  acceptanceRate: number;
  replyRate: number;
}

export interface CampaignReport {
  generatedAt: string;
  period: { from: string; to: string };
  owner: { name: string; email: string; organizationName: string | null };
  summary: ReportSummary;
  comparison?: ReportComparison | null;
  campaigns: ReportCampaign[];
}

export interface DailyEvolutionPoint {
  date: string;
  dayLabel: string;
  prospectsAdded: number;
  actionsExecuted: number;
  invitesSent: number;
  messagesSent: number;
  repliesReceived?: number;
}

export interface DashboardStats {
  owner?: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
    orgRole: string | null;
    organizationName?: string | null;
  } | null;
  listsCount: number;
  prospectsCount: number;
  connectedProspects: number;
  pendingProspects: number;
  notConnectedProspects: number;
  doNotContactProspects: number;
  repliedProspects: number;
  acceptanceRate: number;
  responseRate: number;
  activeCampaignsCount: number;
  totalCampaignsCount: number;
  queuedActionsCount: number;
  executedActionsCount: number;
  emailsFoundCount: number;
  phonesFoundCount: number;
  evolution: DailyEvolutionPoint[];
  evolution30d?: DailyEvolutionPoint[];
  linkedInAccount: {
    status: string;
    accountName: string | null;
    headline: string | null;
    profilePicture: string | null;
    dailyInvitesSent: number;
    dailyMsgSent: number;
  } | null;
}
