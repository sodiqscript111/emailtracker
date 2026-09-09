export interface ComposeTrackingUi {
  container: HTMLElement;
  isTrackingEnabled(): boolean;
  setTrackingEnabled(enabled: boolean): void;
  showWarning(message: string): void;
  clearWarning(): void;
  setStatus(statusText: string, isError?: boolean): void;
}

export function createTrackingControl(initialEnabled = false): ComposeTrackingUi {
  let isEnabled = initialEnabled;

  const container = document.createElement('div');
  container.className = 'email-tracker-compose-control';
  container.setAttribute(
    'style',
    'display: inline-flex; align-items: center; margin: 0 8px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 12px; user-select: none; vertical-align: middle;'
  );

  // Toggle label container
  const label = document.createElement('label');
  label.setAttribute(
    'style',
    'display: inline-flex; align-items: center; cursor: pointer; padding: 4px 9px; border-radius: 6px; border: 1px solid #cbd5e1; background-color: #f8fafc; transition: all 0.15s;'
  );
  label.title = 'Personal Email Open Tracker (Click to enable/disable)';

  // Checkbox input
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = initialEnabled;
  checkbox.setAttribute(
    'style',
    'margin: 0 6px 0 0; cursor: pointer; accent-color: #2563eb; width: 14px; height: 14px;'
  );

  // Text label
  const textSpan = document.createElement('span');
  textSpan.textContent = 'Track email';
  textSpan.setAttribute('style', 'font-weight: 600; font-size: 12px; color: #334155;');

  // Status indicator badge
  const statusBadge = document.createElement('span');
  statusBadge.setAttribute(
    'style',
    'margin-left: 6px; font-size: 10px; padding: 1px 6px; border-radius: 10px; font-weight: 700; transition: all 0.2s;'
  );

  function updateBadge() {
    if (checkbox.checked) {
      statusBadge.textContent = 'ON';
      statusBadge.style.backgroundColor = '#dcfce7';
      statusBadge.style.color = '#15803d';
      label.style.borderColor = '#93c5fd';
      label.style.backgroundColor = '#eff6ff';
      textSpan.style.color = '#1d4ed8';
    } else {
      statusBadge.textContent = 'OFF';
      statusBadge.style.backgroundColor = '#f1f5f9';
      statusBadge.style.color = '#64748b';
      label.style.borderColor = '#cbd5e1';
      label.style.backgroundColor = '#f8fafc';
      textSpan.style.color = '#64748b';
    }
  }

  updateBadge();

  checkbox.addEventListener('change', () => {
    isEnabled = checkbox.checked;
    updateBadge();
  });

  label.appendChild(checkbox);
  label.appendChild(textSpan);
  label.appendChild(statusBadge);
  container.appendChild(label);

  // Inline feedback / warning message container
  const messageEl = document.createElement('span');
  messageEl.className = 'email-tracker-message';
  messageEl.setAttribute(
    'style',
    'margin-left: 6px; font-size: 11px; display: none; padding: 3px 8px; border-radius: 4px; font-weight: 500;'
  );
  container.appendChild(messageEl);

  return {
    container,
    isTrackingEnabled() {
      return isEnabled;
    },
    setTrackingEnabled(enabled: boolean) {
      isEnabled = enabled;
      checkbox.checked = enabled;
      updateBadge();
    },
    showWarning(message: string) {
      messageEl.textContent = `⚠️ ${message}`;
      messageEl.style.display = 'inline-block';
      messageEl.style.backgroundColor = '#fef3c7';
      messageEl.style.color = '#b45309';
      messageEl.style.border = '1px solid #fde68a';
    },
    clearWarning() {
      messageEl.style.display = 'none';
      messageEl.textContent = '';
    },
    setStatus(statusText: string, isError = false) {
      messageEl.textContent = statusText;
      messageEl.style.display = 'inline-block';
      if (isError) {
        messageEl.style.backgroundColor = '#fee2e2';
        messageEl.style.color = '#b91c1c';
        messageEl.style.border = '1px solid #fecaca';
      } else {
        messageEl.style.backgroundColor = '#eff6ff';
        messageEl.style.color = '#1d4ed8';
        messageEl.style.border = '1px solid #bfdbfe';
      }
    },
  };
}
