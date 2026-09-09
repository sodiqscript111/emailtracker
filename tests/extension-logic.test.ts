import { describe, it, expect } from 'vitest';
import {
  generateSecureId,
  generateTrackingPixelHtml,
  isValidTrackingId,
  isValidEmail,
  validateCreateEmailRequest,
  TRANSPARENT_GIF_BYTES,
  TRACKING_PATH_PREFIX,
} from '@email-tracker/shared';

describe('Extension Core Logic & Tracking Helpers', () => {
  describe('Secure Tracking ID Generation', () => {
    it('generates high-entropy random identifiers with sufficient length', () => {
      const id1 = generateSecureId(16);
      const id2 = generateSecureId(16);

      expect(id1).toHaveLength(32);
      expect(id2).toHaveLength(32);
      expect(id1).not.toBe(id2);
      expect(isValidTrackingId(id1)).toBe(true);
      expect(isValidTrackingId(id2)).toBe(true);
    });

    it('rejects sequential or short invalid IDs', () => {
      expect(isValidTrackingId('123')).toBe(false);
      expect(isValidTrackingId('')).toBe(false);
      expect(isValidTrackingId('special@characters!')).toBe(false);
    });
  });

  describe('Tracking URL and Pixel Tag Generation', () => {
    it('constructs well-formed opaque tracking URLs', () => {
      const baseUrl = 'https://tracker.example.com';
      const trackingId = '01kabc1234567890abcdef1234567890';
      const trackingUrl = `${baseUrl}${TRACKING_PATH_PREFIX}${trackingId}`;

      expect(trackingUrl).toBe('https://tracker.example.com/t/o/01kabc1234567890abcdef1234567890');
      // Must not contain personal data
      expect(trackingUrl).not.toContain('@');
    });

    it('generates compliant 1x1 image pixel tag according to specification', () => {
      const trackingUrl = 'https://tracker.example.com/t/o/abc123xyz7894560123';
      const html = generateTrackingPixelHtml(trackingUrl);

      expect(html).toContain('src="https://tracker.example.com/t/o/abc123xyz7894560123"');
      expect(html).toContain('width="1"');
      expect(html).toContain('height="1"');
      expect(html).toContain('style="display:block;width:1px;height:1px;border:0"');
      expect(html).toContain('alt=""');
    });
  });

  describe('Recipient & Input Validation (Single-recipient MVP)', () => {
    it('validates standard email addresses correctly', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('john.doe+work@sub.domain.co')).toBe(true);
      expect(isValidEmail('plainaddress')).toBe(false);
      expect(isValidEmail('@missingusername.com')).toBe(false);
      expect(isValidEmail('missing-at-sign.com')).toBe(false);
    });

    it('validates create email request payload', () => {
      const valid = validateCreateEmailRequest({
        recipientEmail: 'target@example.com',
        subject: 'Important contract',
      });
      expect(valid.valid).toBe(true);

      const invalidEmail = validateCreateEmailRequest({
        recipientEmail: 'not-an-email',
        subject: 'Important contract',
      });
      expect(invalidEmail.valid).toBe(false);

      const missingEmail = validateCreateEmailRequest({
        subject: 'Important contract',
      });
      expect(missingEmail.valid).toBe(false);
    });
  });

  describe('Pixel Binary Buffer Validity', () => {
    it('provides standard 42-byte transparent GIF header', () => {
      expect(TRANSPARENT_GIF_BYTES.length).toBe(42);
      // GIF89a header
      const header = String.fromCharCode(...TRANSPARENT_GIF_BYTES.slice(0, 6));
      expect(header).toBe('GIF89a');
    });
  });
});
