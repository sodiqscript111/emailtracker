import type { ComposeWindow, GmailAdapter } from './gmail/adapter.js';
import { createTrackingControl, type ComposeTrackingUi } from './compose/ui.js';
import { injectTrackingPixel } from './tracking/injector.js';
import { apiClient } from '../lib/api.js';
import { getConfig } from '../lib/storage.js';

export class ComposeHandler {
  private ui: ComposeTrackingUi | null = null;
  private isProcessingSend = false;
  private isBypassingIntercept = false;

  constructor(
    public readonly compose: ComposeWindow,
    private readonly adapter: GmailAdapter
  ) {}

  async init(): Promise<void> {
    const config = await getConfig();

    // Create tracking UI control
    this.ui = createTrackingControl(config.defaultTrackingEnabled);

    // Safely mount next to Send button or in action bar
    const mounted = this.adapter.attachTrackingUi(this.compose, this.ui.container);
    if (!mounted) {
      console.warn('[Email Tracker] Could not find suitable container for tracking toggle');
      return;
    }

    // Attach interceptor to Send button
    this.bindSendButton();
    // Attach interceptor to keyboard shortcuts (Ctrl+Enter / Cmd+Enter)
    this.bindKeyboardShortcuts();
  }

  private bindSendButton(): void {
    const sendBtn = this.adapter.findSendButton(this.compose);
    if (!sendBtn) return;

    sendBtn.addEventListener(
      'click',
      (event) => {
        // If tracking is disabled, or if we've already injected the pixel and are programmatically sending, proceed!
        if (!this.ui?.isTrackingEnabled() || this.isBypassingIntercept) {
          return;
        }

        // Synchronously STOP Gmail's click handler from immediately sending before we inject the pixel!
        event.preventDefault();
        event.stopImmediatePropagation();

        // Perform tracking registration, inject pixel, and then re-trigger send
        this.executeSendWithTracking(sendBtn);
      },
      true // Capture phase: intercepted before Gmail's internal listeners receive the event
    );
  }

  private bindKeyboardShortcuts(): void {
    this.compose.element.addEventListener(
      'keydown',
      (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          if (!this.ui?.isTrackingEnabled() || this.isBypassingIntercept) {
            return;
          }

          event.preventDefault();
          event.stopImmediatePropagation();

          const sendBtn = this.adapter.findSendButton(this.compose);
          if (sendBtn) {
            this.executeSendWithTracking(sendBtn);
          }
        }
      },
      true
    );
  }

  /**
   * Orchestrates the complete tracking workflow:
   * 1. Extracts recipient and subject
   * 2. Calls Worker API to create tracking ID
   * 3. Injects 1x1 tracking pixel into the email body
   * 4. Marks tracking ID as sent
   * 5. Programmatically clicks Send so Gmail sends the email containing the pixel
   */
  private async executeSendWithTracking(sendBtn: HTMLElement): Promise<void> {
    if (this.isProcessingSend) return;
    this.isProcessingSend = true;

    this.ui?.setStatus('Tracking...', false);

    try {
      const recipients = this.adapter.getRecipients(this.compose);
      const subject = this.adapter.getSubject(this.compose) || '(No subject)';
      const body = this.adapter.getBody(this.compose);

      if (!body) {
        console.warn('[Email Tracker] Could not locate email body element');
      }

      // Check single recipient MVP requirement
      if (recipients.length > 1) {
        this.ui?.showWarning('Tracking supports 1 recipient per email');
        this.isProcessingSend = false;
        return;
      }

      const recipientEmail = recipients.length > 0 ? recipients[0] : 'recipient@mail.tracked';
      const senderEmail = this.adapter.getCurrentSenderEmail(this.compose);

      // 1. Register tracking record on backend
      const { id, trackingUrl } = await apiClient.createTrackedEmail({
        recipientEmail,
        senderEmail,
        subject,
      });

      // 2. Inject pixel into message body
      if (body) {
        injectTrackingPixel(body, trackingUrl);
      }

      // 3. Mark record as sent
      await apiClient.markEmailSent(id, Date.now());

      this.ui?.setStatus('✓ Tracked', false);

      // 4. Trigger normal Gmail send with the pixel now present in the body
      this.isBypassingIntercept = true;
      sendBtn.click();

      setTimeout(() => {
        this.isBypassingIntercept = false;
        this.isProcessingSend = false;
      }, 1200);
    } catch (err) {
      console.error('[Email Tracker] Error during send flow:', err);
      const msg = err instanceof Error ? err.message : String(err);
      this.ui?.setStatus(`Error: ${msg}`, true);

      // Allow sending even if tracking backend had a network error
      this.isBypassingIntercept = true;
      sendBtn.click();
      setTimeout(() => {
        this.isBypassingIntercept = false;
        this.isProcessingSend = false;
      }, 1200);
    }
  }

  destroy(): void {
    if (this.ui) {
      this.ui.container.remove();
      this.ui = null;
    }
  }
}
