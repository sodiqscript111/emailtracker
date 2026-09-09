import { GmailAdapter, type ComposeWindow } from './gmail/adapter.js';
import { ComposeHandler } from './compose.js';

class GmailTrackerExtension {
  private adapter = new GmailAdapter();
  private activeComposeHandlers = new Map<string, ComposeHandler>();
  private observer: MutationObserver | null = null;
  private debounceTimer: number | null = null;

  init(): void {
    console.log('[Email Tracker] Initializing Gmail integration content script');

    // Run initial scan
    this.scanComposeWindows();

    // Set up debounced MutationObserver to detect compose/reply/forward dialogs
    this.observer = new MutationObserver(() => {
      if (this.debounceTimer !== null) {
        window.clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = window.setTimeout(() => {
        this.scanComposeWindows();
      }, 250);
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  private scanComposeWindows(): void {
    const currentWindows = this.adapter.findComposeWindows();
    const currentWindowIds = new Set(currentWindows.map((w) => w.id));

    // Cleanup closed compose windows
    for (const [id, handler] of this.activeComposeHandlers.entries()) {
      if (!currentWindowIds.has(id) || !document.body.contains(handler.compose.element)) {
        handler.destroy();
        this.activeComposeHandlers.delete(id);
      }
    }

    // Initialize new compose windows
    for (const compose of currentWindows) {
      if (!this.activeComposeHandlers.has(compose.id)) {
        const handler = new ComposeHandler(compose, this.adapter);
        this.activeComposeHandlers.set(compose.id, handler);
        handler.init().catch((err) => {
          console.error('[Email Tracker] Error initializing compose handler:', err);
        });
      }
    }
  }

  destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    for (const handler of this.activeComposeHandlers.values()) {
      handler.destroy();
    }
    this.activeComposeHandlers.clear();
  }
}

const extension = new GmailTrackerExtension();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => extension.init());
} else {
  extension.init();
}
