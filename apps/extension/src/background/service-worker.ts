import { getConfig } from '../lib/storage.js';

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Email Tracker] Extension installed/updated:', details.reason);
  const config = await getConfig();
  console.log('[Email Tracker] Current configuration loaded:', {
    apiBaseUrl: config.apiBaseUrl,
    trackingBaseUrl: config.trackingBaseUrl,
    defaultTrackingEnabled: config.defaultTrackingEnabled,
  });
});

// Listen for messages from content scripts or popup if required
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ status: 'PONG' });
  }
  return true;
});
