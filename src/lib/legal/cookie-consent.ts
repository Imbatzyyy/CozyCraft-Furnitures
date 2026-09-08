export const COOKIE_CHOICE_KEY = 'cozycraft-cookie-choice';
export const COOKIE_POLICY_VERSION = 1;
export const COOKIE_CHOICE_MAX_AGE = 180 * 24 * 60 * 60 * 1000;
export function validCookieChoice(raw: string | null, now = Date.now()): boolean {
  try {
    const value = JSON.parse(raw ?? 'null');
    return value?.version === COOKIE_POLICY_VERSION && value?.choice === 'essential-only'
      && Number.isFinite(value.savedAt) && value.savedAt <= now && now - value.savedAt < COOKIE_CHOICE_MAX_AGE;
  } catch { return false; }
}
export function cookieChoiceRecord(now = Date.now()): string {
  return JSON.stringify({ version: COOKIE_POLICY_VERSION, choice: 'essential-only', savedAt: now });
}
export function openCookieSettings() {
  window.dispatchEvent(new Event('cozycraft-cookie-settings'));
}
