import { generateTrackingPixelHtml } from '@email-tracker/shared';

export const PIXEL_MARKER_ATTR = 'data-email-tracker-pixel';

/**
 * Injects a 1x1 transparent tracking pixel into the email body HTML.
 */
export function injectTrackingPixel(bodyElement: HTMLElement, trackingUrl: string): boolean {
  if (!bodyElement) return false;

  // Check if pixel is already injected
  const existingPixel = bodyElement.querySelector(`img[${PIXEL_MARKER_ATTR}]`);
  if (existingPixel) {
    existingPixel.setAttribute('src', trackingUrl);
    return true;
  }

  // Create pixel DOM element
  const pixelImg = document.createElement('img');
  pixelImg.setAttribute('src', trackingUrl);
  pixelImg.setAttribute('width', '1');
  pixelImg.setAttribute('height', '1');
  pixelImg.setAttribute('alt', '');
  pixelImg.setAttribute('style', 'display:block;width:1px;height:1px;border:0');
  pixelImg.setAttribute(PIXEL_MARKER_ATTR, 'true');

  // Insert at the bottom of the body
  bodyElement.appendChild(pixelImg);
  return true;
}

/**
 * Removes any injected tracking pixel from the body (e.g. if tracking is toggled OFF).
 */
export function removeTrackingPixel(bodyElement: HTMLElement): void {
  if (!bodyElement) return;
  const existing = bodyElement.querySelectorAll(`img[${PIXEL_MARKER_ATTR}]`);
  existing.forEach((el) => el.remove());
}
