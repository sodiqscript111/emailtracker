import type {
  CreateTrackedEmailResponse,
  PaginatedResponse,
  TrackedEmailSummary,
  DashboardStats,
} from '@email-tracker/shared';
import { getConfig } from './storage.js';

export class TrackerApiClient {
  private async fetchWithAuth(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const config = await getConfig();
    const url = `${config.apiBaseUrl.replace(/\/+$/, '')}${endpoint}`;

    const headers = new Headers(options.headers || {});
    if (config.apiToken) {
      headers.set('Authorization', `Bearer ${config.apiToken}`);
    }
    headers.set('Content-Type', 'application/json');

    return fetch(url, {
      ...options,
      headers,
    });
  }

  async createTrackedEmail(params: {
    recipientEmail: string;
    subject: string;
  }): Promise<CreateTrackedEmailResponse> {
    const res = await this.fetchWithAuth('/api/tracked-emails', {
      method: 'POST',
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const errorData = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(errorData.error?.message || `Failed to create tracking: ${res.statusText}`);
    }

    return res.json();
  }

  async markEmailSent(id: string, sentAt = Date.now()): Promise<void> {
    const res = await this.fetchWithAuth(`/api/tracked-emails/${id}/sent`, {
      method: 'POST',
      body: JSON.stringify({ sentAt }),
    });

    if (!res.ok) {
      throw new Error(`Failed to mark email sent: ${res.statusText}`);
    }
  }

  async listTrackedEmails(
    page = 1,
    limit = 25
  ): Promise<PaginatedResponse<TrackedEmailSummary>> {
    const res = await this.fetchWithAuth(`/api/tracked-emails?page=${page}&limit=${limit}`, {
      method: 'GET',
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch tracked emails: ${res.statusText}`);
    }

    return res.json();
  }

  async getStats(): Promise<DashboardStats> {
    const res = await this.fetchWithAuth('/api/stats', {
      method: 'GET',
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch stats: ${res.statusText}`);
    }

    return res.json();
  }

  async deleteTrackedEmail(id: string): Promise<void> {
    const res = await this.fetchWithAuth(`/api/tracked-emails/${id}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      throw new Error(`Failed to delete tracked email: ${res.statusText}`);
    }
  }
}

export const apiClient = new TrackerApiClient();
