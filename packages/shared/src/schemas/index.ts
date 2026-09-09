import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants/index.js';
import type { CreateTrackedEmailRequest } from '../types/index.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TRACKING_ID_REGEX = /^[a-zA-Z0-9_-]{16,64}$/;

export function isValidEmail(email: unknown): email is string {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  return trimmed.length > 3 && trimmed.length <= 254 && EMAIL_REGEX.test(trimmed);
}

export function isValidSubject(subject: unknown): subject is string {
  return typeof subject === 'string' && subject.length <= 500;
}

export function isValidTrackingId(id: unknown): id is string {
  return typeof id === 'string' && TRACKING_ID_REGEX.test(id);
}

export function validateCreateEmailRequest(
  data: unknown
): { valid: true; value: CreateTrackedEmailRequest } | { valid: false; error: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const { recipientEmail, subject, senderEmail } = data as Record<string, unknown>;

  if (!isValidEmail(recipientEmail)) {
    return { valid: false, error: 'Invalid or missing "recipientEmail"' };
  }

  if (subject !== undefined && !isValidSubject(subject)) {
    return { valid: false, error: '"subject" must be a string up to 500 characters' };
  }

  const validSender = typeof senderEmail === 'string' && isValidEmail(senderEmail) ? senderEmail.trim() : null;

  return {
    valid: true,
    value: {
      recipientEmail: recipientEmail.trim(),
      subject: typeof subject === 'string' ? subject.trim() : '(No subject)',
      senderEmail: validSender,
    },
  };
}

export function parsePaginationParams(
  pageParam: unknown,
  limitParam: unknown
): { page: number; limit: number; offset: number } {
  let page = parseInt(String(pageParam), 10);
  if (isNaN(page) || page < 1) {
    page = 1;
  }

  let limit = parseInt(String(limitParam), 10);
  if (isNaN(limit) || limit < 1) {
    limit = DEFAULT_PAGE_SIZE;
  } else if (limit > MAX_PAGE_SIZE) {
    limit = MAX_PAGE_SIZE;
  }

  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * Generate standard HTML tracking pixel tag.
 */
export function generateTrackingPixelHtml(trackingUrl: string): string {
  return `<img src="${trackingUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0" />`;
}

/**
 * Generate a cryptographically random high-entropy tracking identifier.
 * Uses Web Crypto API (supported in Node 19+, Cloudflare Workers, and Browser).
 */
export function generateSecureId(byteLength = 16): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buffer = new Uint8Array(byteLength);
    crypto.getRandomValues(buffer);
    return Array.from(buffer)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback if crypto is unavailable (e.g. older env)
  let result = '';
  const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  for (let i = 0; i < byteLength * 2; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}
