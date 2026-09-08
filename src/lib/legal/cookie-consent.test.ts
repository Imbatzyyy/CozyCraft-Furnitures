import { describe, expect, it } from 'vitest';
import { COOKIE_CHOICE_MAX_AGE, cookieChoiceRecord, validCookieChoice } from './cookie-consent';
describe('essential-only cookie choice', () => {
  it('remembers a current acknowledgement', () => expect(validCookieChoice(cookieChoiceRecord(1000), 2000)).toBe(true));
  it('expires after 180 days', () => expect(validCookieChoice(cookieChoiceRecord(1000), 1000 + COOKIE_CHOICE_MAX_AGE)).toBe(false));
  it('rejects corrupt, absent, future, or obsolete choices', () => {
    for (const raw of [null, '', '{}', 'bad', cookieChoiceRecord(3000), '{"version":0,"choice":"essential-only","savedAt":1000}']) expect(validCookieChoice(raw, 2000)).toBe(false);
  });
  it('does not grant optional tracking consent', () => expect(JSON.parse(cookieChoiceRecord()).choice).toBe('essential-only'));
});
