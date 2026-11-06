/**
 * NOXIRA Website Configuration
 *
 * GOOGLE_FORM_1_URL: Link to Google Form 1 for candidate intake.
 * When empty, all Apply buttons on the site appear disabled with the message:
 * "Application link is not available yet."
 */
export const GOOGLE_FORM_1_URL = '';

export function isGoogleFormConfigured() {
  return Boolean(GOOGLE_FORM_1_URL && GOOGLE_FORM_1_URL.trim().length > 0);
}

export const APPLICATION_UNAVAILABLE_MESSAGE = 'Application link is not available yet.';
