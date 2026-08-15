export type Decision = "ALLOW" | "HOLD" | "BLOCK";
export type Severity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type CircuitStatus = "RUNNING" | "PAUSED" | "HALTED" | "KILLED";
export type PlatformMode = "READ_ONLY" | "DRY_RUN" | "LIVE";

export interface PublishRequest {
  agentId: string;
  channelId: string;
  platform: "youtube" | "instagram" | "mock";
  title: string;
  description?: string;
  contentText: string;
  syntheticMedia?: boolean;
  targetRegions?: string[];
  publicInterestTopic?: boolean;
  humanEditorialReview?: boolean;
  platformDisclosureEnabled?: boolean;
  customDisclosureAttached?: boolean;
  scheduledAt?: string;
}

export interface HistoricalPost {
  id: string;
  agentId: string;
  channelId: string;
  title: string;
  contentText: string;
  createdAt: Date;
}

export interface PolicyResult {
  policyId: string;
  name: string;
  severity: Severity;
  passed: boolean;
  score: number;
  decision: Decision;
  reason: string;
  evidence?: Record<string, unknown>;
}

export interface PolicyContext {
  request: PublishRequest;
  history: HistoricalPost[];
  attemptsLastHour: number;
  channelDailyBaseline: number;
  thresholds?: Record<string, { warnAt?: number; holdAt?: number; blockAt?: number }>;
}

export interface RemediationPlan {
  required: boolean;
  autoRetryAllowed: boolean;
  maxAutomaticRetries: 0 | 1;
  actions: Array<{
    policyId: string;
    instruction: string;
    automaticallyCorrectable: boolean;
  }>;
}

export interface GatewayResult {
  decision: Decision;
  riskScore: number;
  riskLevel: Severity;
  violations: PolicyResult[];
  policyResults: PolicyResult[];
  remediation: RemediationPlan;
  decisionId: string;
  auditHash: string;
  publisherMode: PlatformMode;
  publication: {
    published: boolean;
    mode: PlatformMode;
    externalId?: string;
    reason?: string;
    privacyStatus?: "private";
    visibility?: "public";
  };
}

export interface PlatformDelivery {
  youtube?: {
    userId: string;
  };
  video?: {
    bytes: Uint8Array;
    mimeType: string;
  };
  instagram?: {
    publicConfirmation: boolean;
    shareToFeed: boolean;
    videoUrl?: string;
  };
}
