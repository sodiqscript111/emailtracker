import { apiClient } from '../lib/api.js';
import { getConfig } from '../lib/storage.js';
import type { TrackedEmailSummary } from '@email-tracker/shared';

function formatRelativeTime(timestamp: number | null): string {
  if (!timestamp) return '—';
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  return new Date(timestamp).toLocaleDateString();
}

async function loadData() {
  const totalEl = document.getElementById('totalCount');
  const openedEl = document.getElementById('openedCount');
  const unopenedEl = document.getElementById('unopenedCount');
  const listEl = document.getElementById('emailList');

  try {
    const stats = await apiClient.getStats();
    if (totalEl) totalEl.textContent = String(stats.totalTracked);
    if (openedEl) openedEl.textContent = String(stats.openedCount);
    if (unopenedEl) unopenedEl.textContent = String(stats.notOpenedCount);

    const emailData = await apiClient.listTrackedEmails(1, 10);
    if (!listEl) return;

    if (!emailData.items || emailData.items.length === 0) {
      listEl.innerHTML = '<div class="empty-state">No tracked emails yet</div>';
      return;
    }

    listEl.innerHTML = '';
    for (const item of emailData.items) {
      const card = createEmailCard(item);
      listEl.appendChild(card);
    }
  } catch (err) {
    console.error('Error loading popup data:', err);
    if (listEl) {
      listEl.innerHTML = `
        <div class="empty-state" style="color: #ef4444;">
          Cannot connect to backend.<br/>
          Check Worker status or Options.
        </div>
      `;
    }
  }
}

function createEmailCard(item: TrackedEmailSummary): HTMLElement {
  const card = document.createElement('div');
  card.className = 'email-card';

  const isOpened = item.openCount > 0;
  const badgeClass = isOpened ? 'badge-opened' : 'badge-unopened';
  const badgeText = isOpened ? `✓ Opened (${item.openCount})` : 'Not opened';
  const timeText = isOpened ? `Last: ${formatRelativeTime(item.lastOpenedAt)}` : `Sent: ${formatRelativeTime(item.sentAt || item.createdAt)}`;

  card.innerHTML = `
    <div class="email-top">
      <span class="recipient-email" title="${escapeHtml(item.recipientEmail)}">${escapeHtml(item.recipientEmail)}</span>
      <span class="status-badge ${badgeClass}">${badgeText}</span>
    </div>
    <div class="email-subject" title="${escapeHtml(item.subject)}">${escapeHtml(item.subject)}</div>
    <div class="email-meta">
      <span>${timeText}</span>
      <span>${item.openCount > 0 ? `${item.openCount} requests` : ''}</span>
    </div>
  `;

  return card;
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();

  document.getElementById('refreshBtn')?.addEventListener('click', () => {
    loadData();
  });

  document.getElementById('optionsBtn')?.addEventListener('click', () => {
    if (chrome?.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open('options.html');
    }
  });

  document.getElementById('dashboardBtn')?.addEventListener('click', async () => {
    const config = await getConfig();
    if (chrome?.tabs?.create) {
      chrome.tabs.create({ url: config.dashboardUrl });
    } else {
      window.open(config.dashboardUrl, '_blank');
    }
  });
});
