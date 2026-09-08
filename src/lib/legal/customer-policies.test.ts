import { describe, expect, it } from 'vitest';
import { CUSTOMER_POLICY_VERSION, CUSTOMER_PRIVACY_SECTIONS, CUSTOMER_TERMS_SECTIONS } from './customer-policies';
describe('customer policy release', () => {
  it('versions the current public and signup agreement together', () => expect(CUSTOMER_POLICY_VERSION).toBe('2026-09-09'));
  it('includes customer rights and avoids an unverified deletion deadline', () => {
    const body = CUSTOMER_PRIVACY_SECTIONS.map(section => section.body).join(' ');
    expect(body).toContain('withdraw consent');
    expect(body).not.toContain('within 90 days');
  });
  it('preserves statutory rights', () => expect(CUSTOMER_TERMS_SECTIONS.map(section => section.body).join(' ')).toContain('non-waivable'));
});
