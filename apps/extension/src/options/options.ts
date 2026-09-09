import { getConfig, saveConfig } from '../lib/storage.js';

document.addEventListener('DOMContentLoaded', async () => {
  const apiBaseUrlInput = document.getElementById('apiBaseUrl') as HTMLInputElement;
  const apiTokenInput = document.getElementById('apiToken') as HTMLInputElement;
  const dashboardUrlInput = document.getElementById('dashboardUrl') as HTMLInputElement;
  const defaultTrackingInput = document.getElementById('defaultTrackingEnabled') as HTMLInputElement;
  const form = document.getElementById('settingsForm') as HTMLFormElement;
  const statusEl = document.getElementById('saveStatus') as HTMLElement;

  // Load existing config
  const config = await getConfig();
  if (apiBaseUrlInput) apiBaseUrlInput.value = config.apiBaseUrl;
  if (apiTokenInput) apiTokenInput.value = config.apiToken;
  if (dashboardUrlInput) dashboardUrlInput.value = config.dashboardUrl;
  if (defaultTrackingInput) defaultTrackingInput.checked = config.defaultTrackingEnabled;

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const newConfig = {
      apiBaseUrl: apiBaseUrlInput.value.trim().replace(/\/+$/, ''),
      trackingBaseUrl: apiBaseUrlInput.value.trim().replace(/\/+$/, ''),
      apiToken: apiTokenInput.value.trim(),
      dashboardUrl: dashboardUrlInput.value.trim().replace(/\/+$/, ''),
      defaultTrackingEnabled: defaultTrackingInput.checked,
    };

    try {
      await saveConfig(newConfig);
      statusEl.textContent = 'Settings saved successfully!';
      statusEl.style.color = '#16a34a';
      setTimeout(() => {
        statusEl.textContent = '';
      }, 3000);
    } catch (err) {
      statusEl.textContent = 'Failed to save settings.';
      statusEl.style.color = '#dc2626';
    }
  });
});
