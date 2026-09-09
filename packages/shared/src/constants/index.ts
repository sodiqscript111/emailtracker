export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export const TRACKING_PATH_PREFIX = '/t/o/';
export const API_PATH_PREFIX = '/api/';

export const ERROR_CODES = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export const DEFAULT_CONFIG = {
  API_BASE_URL: 'http://localhost:8787',
  TRACKING_BASE_URL: 'http://localhost:8787',
  DEFAULT_TRACKING_ENABLED: false,
} as const;

// 42-byte minimal transparent 1x1 GIF
export const TRANSPARENT_GIF_BASE64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export const TRANSPARENT_GIF_BYTES = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
  0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x21, 0xf9, 0x04, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
  0x00, 0x02, 0x01, 0x44, 0x00, 0x3b,
]);
