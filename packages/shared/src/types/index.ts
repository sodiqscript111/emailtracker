export type TrackedEmailStatus = 'created' | 'sent' | 'cancelled';

export interface TrackedEmail {
  id: string;
  trackingId: string;
  recipientEmail: string;
  senderEmail?: string | null;
  subject: string;
  createdAt: number;
  sentAt: number | null;
  status: TrackedEmailStatus;
}

export interface OpenEvent {
  id: number;
  trackedEmailId: string;
  occurredAt: number;
  userAgent: string | null;
  ipHash: string | null;
}

export interface TrackedEmailSummary {
  id: string;
  trackingId: string;
  recipientEmail: string;
  senderEmail?: string | null;
  subject: string;
  status: TrackedEmailStatus;
  createdAt: number;
  sentAt: number | null;
  firstOpenedAt: number | null;
  lastOpenedAt: number | null;
  openCount: number;
}

export interface TrackedEmailDetail extends TrackedEmailSummary {
  events: OpenEvent[];
}

export interface CreateTrackedEmailRequest {
  recipientEmail: string;
  senderEmail?: string | null;
  subject: string;
}

export interface CreateTrackedEmailResponse {
  id: string;
  trackingId: string;
  trackingUrl: string;
}

export interface MarkSentRequest {
  sentAt?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface DashboardStats {
  totalTracked: number;
  openedCount: number;
  notOpenedCount: number;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface ExtensionConfig {
  apiBaseUrl: string;
  trackingBaseUrl: string;
  apiToken: string;
  defaultTrackingEnabled: boolean;
}
