export interface ComposeWindow {
  element: HTMLElement;
  id: string;
}

export interface GmailIntegration {
  findComposeWindows(): ComposeWindow[];
  findSendButton(compose: ComposeWindow): HTMLElement | null;
  findActionBar(compose: ComposeWindow): HTMLElement | null;
  getRecipients(compose: ComposeWindow): string[];
  getSubject(compose: ComposeWindow): string;
  getBody(compose: ComposeWindow): HTMLElement | null;
}

/**
 * Centralized registry of Gmail DOM selectors.
 * If Google updates Gmail's DOM classes or attributes,
 * modifications are isolated strictly to this file.
 */
export const GMAIL_SELECTORS = {
  composeContainers: [
    'div[role="dialog"]',
    'div.M9',
    'div[aria-label*="New Message"]',
    'div[aria-label*="Compose"]',
    'div.adP', // inline reply/forward container
    'div[role="region"][aria-label*="Reply"]',
  ],
  sendButtons: [
    'div[role="button"][data-tooltip*="Send"]',
    'div[role="button"][aria-label*="Send"]',
    'div[data-tooltip*="Send (Ctrl-Enter)"]',
    'div.T-I.J-J5-Ji.aoO.v7.T-I-atl.L3',
    'div.T-I.aoO',
  ],
  actionBarContainers: [
    'tr.btC',
    'div.btC',
    'div.gU.Up',
    'div.aDh',
    'div[role="toolbar"]',
  ],
  recipientInputs: [
    'input[name="to"]',
    'input[aria-label*="To"]',
    'textarea[name="to"]',
    'input[peoplekit-id]',
  ],
  recipientChips: [
    'span[email]',
    'div[data-hovercard-id]',
    'span[data-hovercard-id]',
    'div[role="option"]',
    'div[aria-label*="Recipient"]',
  ],
  subjectInputs: [
    'input[name="subjectbox"]',
    'input[aria-label*="Subject"]',
    'input[placeholder="Subject"]',
    'input[placeholder*="subject" i]',
  ],
  messageBodies: [
    'div[aria-label*="Message Body"]',
    'div[role="textbox"][contenteditable="true"]',
    'div.Am.Al.editable',
    'div.editable',
  ],
};

export class GmailAdapter implements GmailIntegration {
  /**
   * Scans for active compose, reply, and forward windows.
   */
  findComposeWindows(): ComposeWindow[] {
    const foundElements: HTMLElement[] = [];

    for (const selector of GMAIL_SELECTORS.composeContainers) {
      const elements = document.querySelectorAll<HTMLElement>(selector);
      for (const el of Array.from(elements)) {
        // Verify this element has a message body or send button inside
        const hasBody = GMAIL_SELECTORS.messageBodies.some((s) => el.querySelector(s));
        const hasSend = GMAIL_SELECTORS.sendButtons.some((s) => el.querySelector(s));

        if ((hasBody || hasSend) && !foundElements.includes(el)) {
          foundElements.push(el);
        }
      }
    }

    // Deduplicate: filter out nested child containers (e.g. div.M9 inside div[role="dialog"])
    const uniqueTopElements = foundElements.filter((el) => {
      return !foundElements.some((other) => other !== el && other.contains(el));
    });

    return uniqueTopElements.map((element, index) => {
      // Assign or read a unique instance ID attribute on the DOM node
      let instanceId = element.getAttribute('data-email-tracker-id');
      if (!instanceId) {
        instanceId = `compose_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 7)}`;
        element.setAttribute('data-email-tracker-id', instanceId);
      }
      return { element, id: instanceId };
    });
  }

  /**
   * Locates the primary Send button in a compose window.
   */
  findSendButton(compose: ComposeWindow): HTMLElement | null {
    for (const selector of GMAIL_SELECTORS.sendButtons) {
      const btn = compose.element.querySelector<HTMLElement>(selector);
      if (btn && btn.offsetParent !== null) {
        return btn;
      }
    }
    return null;
  }

  /**
   * Locates the bottom action bar / toolbar next to the Send button.
   */
  findActionBar(compose: ComposeWindow): HTMLElement | null {
    for (const selector of GMAIL_SELECTORS.actionBarContainers) {
      const bar = compose.element.querySelector<HTMLElement>(selector);
      if (bar) {
        return bar;
      }
    }
    // Fallback: parent of Send button
    const sendBtn = this.findSendButton(compose);
    return sendBtn ? (sendBtn.parentElement as HTMLElement) : null;
  }

  /**
   * Safely mounts the tracking UI next to the Send button or in the action bar.
   */
  attachTrackingUi(compose: ComposeWindow, uiElement: HTMLElement): boolean {
    const sendBtn = this.findSendButton(compose);
    if (sendBtn && sendBtn.parentElement) {
      // Place right next to the Send button container
      const sendGroup = sendBtn.closest('.dC') || sendBtn.closest('.aoO') || sendBtn;
      if (sendGroup && sendGroup.parentElement) {
        sendGroup.insertAdjacentElement('afterend', uiElement);
        return true;
      }
      sendBtn.parentElement.appendChild(uiElement);
      return true;
    }

    const actionBar = this.findActionBar(compose);
    if (actionBar) {
      if (actionBar.tagName.toLowerCase() === 'tr') {
        const td = actionBar.querySelector('td.gU.Up') || actionBar.querySelector('td');
        if (td) {
          td.appendChild(uiElement);
          return true;
        }
      }
      actionBar.appendChild(uiElement);
      return true;
    }

    return false;
  }

  /**
   * Extracts recipient email addresses from the compose window.
   */
  getRecipients(compose: ComposeWindow): string[] {
    const recipients = new Set<string>();
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

    // 1. Check recipient chips/elements (already selected emails)
    for (const selector of GMAIL_SELECTORS.recipientChips) {
      const chips = compose.element.querySelectorAll<HTMLElement>(selector);
      for (const chip of Array.from(chips)) {
        const emailAttr = chip.getAttribute('email') || chip.getAttribute('data-hovercard-id');
        if (emailAttr && emailAttr.includes('@')) {
          recipients.add(emailAttr.trim().toLowerCase());
        } else if (chip.textContent) {
          const matches = chip.textContent.match(emailRegex);
          if (matches) {
            matches.forEach((m) => recipients.add(m.trim().toLowerCase()));
          }
        }
      }
    }

    // 2. Check input fields (in case user just typed an address without comma)
    for (const selector of GMAIL_SELECTORS.recipientInputs) {
      const inputs = compose.element.querySelectorAll<HTMLInputElement>(selector);
      for (const input of Array.from(inputs)) {
        const val = input.value || input.getAttribute('value') || '';
        const matches = val.match(emailRegex);
        if (matches) {
          matches.forEach((m) => recipients.add(m.trim().toLowerCase()));
        }
      }
    }

    // 3. Fallback: Search recipient header area
    if (recipients.size === 0) {
      const toRow = compose.element.querySelector('div[name="to"]') || compose.element.querySelector('tr.afV') || compose.element.querySelector('div.aoD');
      if (toRow && toRow.textContent) {
        const matches = toRow.textContent.match(emailRegex);
        if (matches) {
          matches.forEach((m) => recipients.add(m.trim().toLowerCase()));
        }
      }
    }

    return Array.from(recipients);
  }

  /**
   * Extracts the subject from the compose window.
   */
  getSubject(compose: ComposeWindow): string {
    for (const selector of GMAIL_SELECTORS.subjectInputs) {
      const input = compose.element.querySelector<HTMLInputElement>(selector);
      if (input && input.value !== undefined) {
        return input.value.trim();
      }
    }
    return '';
  }

  /**
   * Locates the editable message body element.
   */
  getBody(compose: ComposeWindow): HTMLElement | null {
    for (const selector of GMAIL_SELECTORS.messageBodies) {
      const body = compose.element.querySelector<HTMLElement>(selector);
      if (body) {
        return body;
      }
    }
    return null;
  }

  /**
   * Auto-detects the sender's own email address from Gmail's DOM or compose window.
   */
  getCurrentSenderEmail(compose?: ComposeWindow): string | null {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

    // 1. Try compose window "From" selector if available
    if (compose) {
      const fromEl =
        compose.element.querySelector('input[name="from"]') ||
        compose.element.querySelector('.J-JN-M-I') ||
        compose.element.querySelector('span[email]');
      if (fromEl) {
        const text =
          fromEl.getAttribute('value') ||
          fromEl.getAttribute('email') ||
          fromEl.textContent ||
          '';
        const match = text.match(emailRegex);
        if (match) return match[0].toLowerCase();
      }
    }

    // 2. Try Google Account button in top navigation bar
    const accountBtn =
      document.querySelector('a[aria-label*="Google Account:"]') ||
      document.querySelector('a[aria-label*="Google"]') ||
      document.querySelector('header [aria-label*="@"]');
    if (accountBtn) {
      const label = accountBtn.getAttribute('aria-label') || '';
      const match = label.match(emailRegex);
      if (match) return match[0].toLowerCase();
    }

    // 3. Try document title: "Inbox - user@gmail.com - Gmail"
    const titleMatch = document.title.match(emailRegex);
    if (titleMatch) return titleMatch[0].toLowerCase();

    return null;
  }
}
