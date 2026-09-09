import type {
  DashboardStats,
  PaginatedResponse,
  TrackedEmailSummary,
  TrackedEmailDetail,
} from '@email-tracker/shared';

export interface DashboardSettings {
  apiBaseUrl: string;
  apiToken: string;
}

const STORAGE_KEY = 'email_tracker_dashboard_settings';

export function getSettings(): DashboardSettings {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch {
    // Ignore parse error
  }
  return {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787',
    apiToken: import.meta.env.VITE_API_TOKEN || 'dev-secret-token-change-in-prod',
  };
}

export function saveSettings(settings: DashboardSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

class DashboardApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const { apiBaseUrl, apiToken } = getSettings();
    const url = `${apiBaseUrl.replace(/\/+$/, '')}${endpoint}`;

    const headers = new Headers(options.headers || {});
    if (apiToken) {
      headers.set('Authorization', `Bearer ${apiToken}`);
    }
    headers.set('Content-Type', 'application/json');

    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('UNAUTHORIZED');
      }
      const errorData = await res.json().catch(() => ({}));
      throw new Error((errorData as { error?: { message?: string } }).error?.message || `HTTP ${res.status}: ${res.statusText}`);
    }

    return res.json();
  }

  async testConnection(): Promise<boolean> {
    const res = await this.request<{ status: string }>('/health');
    return res.status === 'ok';
  }

  async getStats(): Promise<DashboardStats> {
    return this.request<DashboardStats>('/api/stats');
  }

  async listEmails(page = 1, limit = 25, senderEmail?: string | null): Promise<PaginatedResponse<TrackedEmailSummary>> {
    let url = `/api/tracked-emails?page=${page}&limit=${limit}`;
    if (senderEmail) {
      url += `&senderEmail=${encodeURIComponent(senderEmail)}`;
    }
    return this.request<PaginatedResponse<TrackedEmailSummary>>(url);
  }

  async getSenders(): Promise<string[]> {
    const res = await this.request<{ senders: string[] }>('/api/senders');
    return res.senders || [];
  }

  async getEmailDetail(id: string): Promise<TrackedEmailDetail> {
    return this.request<TrackedEmailDetail>(`/api/tracked-emails/${id}`);
  }

  async deleteEmail(id: string): Promise<void> {
    await this.request<{ success: boolean }>(`/api/tracked-emails/${id}`, {
      method: 'DELETE',
    });
  }
}

export const dashboardApi = new DashboardApiClient();
