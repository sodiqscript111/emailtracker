import type { ExtensionConfig } from '@email-tracker/shared';
import { DEFAULT_CONFIG } from '@email-tracker/shared';

export interface FullExtensionConfig extends ExtensionConfig {
  dashboardUrl: string;
}

const DEFAULT_FULL_CONFIG: FullExtensionConfig = {
  apiBaseUrl: 'http://localhost:8787',
  trackingBaseUrl: 'http://localhost:8787',
  apiToken: 'dev-secret-token-change-in-prod',
  defaultTrackingEnabled: true,
  dashboardUrl: 'http://localhost:5173',
};

export async function getConfig(): Promise<FullExtensionConfig> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    try {
      const stored = await chrome.storage.sync.get(DEFAULT_FULL_CONFIG);
      return { ...DEFAULT_FULL_CONFIG, ...stored };
    } catch {
      // Fallback to local
      const stored = await chrome.storage.local.get(DEFAULT_FULL_CONFIG);
      return { ...DEFAULT_FULL_CONFIG, ...stored };
    }
  }
  return DEFAULT_FULL_CONFIG;
}

export async function saveConfig(config: Partial<FullExtensionConfig>): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    try {
      await (chrome.storage.sync || chrome.storage.local).set(config);
    } catch {
      await chrome.storage.local.set(config);
    }
  }
}
