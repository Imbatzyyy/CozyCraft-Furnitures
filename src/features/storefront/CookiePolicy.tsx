import { Layout } from '@/app/core';
import { openCookieSettings } from '@/lib/legal/cookie-consent';
import './cookie-consent.css';

export function Component() {
  return <Layout><article className="cookie-policy">
    <p className="cookie-eyebrow">COZYCRAFT · YOUR PRIVACY</p><h1>Cookies, with clarity.</h1>
    <p>Cookie & browser storage policy · Updated September 8, 2026</p>
    <p>CozyCraft Furnitures uses browser storage to provide the shopping and account services you request. This includes cookies, local storage (saved in your browser), and session storage (usually limited to a browser tab). This notice complements our <a href="/privacy">Privacy Policy</a>.</p>
    <h2>What we use and why</h2>
    <dl>
      <dt>Account and security</dt><dd>Sign-in sessions, account recovery, verification requests, and security controls help protect your account. Session information may persist across visits until sign-out or expiry; temporary verification and recovery records expire or are cleared by their workflows.</dd>
      <dt>Shopping and checkout</dt><dd>Storage supports requested selections, product comparisons, and payment recovery so a reload does not lose your checkout context or repeat an action. Temporary payment records are cleared when resolved or expired. Some saved shopping state remains until changed or browser data is cleared.</dd>
      <dt>Requested support and staff tools</dt><dd>Recent chatbot context and unsaved admin drafts can be kept in the current tab. These records support the conversation or editing task you initiate and are not advertising profiles.</dd>
      <dt>Your cookie choice</dt><dd>The local-storage record “cozycraft-cookie-choice” remembers your essential-only choice for 180 days. It contains the policy version, choice, and timestamp—not your name, email, or order details. An expired record is treated as unset on your next visit.</dd>
    </dl>
    <h2>No optional tracking currently</h2><p>The website currently includes no optional advertising or analytics trackers. “Keep essential only” acknowledges this notice; it is not permission for marketing, newsletters, or future tracking. If optional tracking is introduced, it must remain off until a separate choice is offered. Essential features cannot be disabled through this panel.</p>
    <h2>Third-party services</h2><p>When you choose Google sign-in or continue to PayMongo’s hosted payment page, those providers may use their own cookies and storage under their privacy notices. This panel does not manage storage on their websites. Website hosting also processes technical requests needed to deliver and secure pages.</p>
    <h2>Manage your choice</h2><p>You can reopen this panel from the footer at any time. Browser settings let you clear or block cookies and site storage, but doing so can sign you out or interrupt saved selections and payment recovery. Choices are browser-specific, not synchronized to your account. Blocking storage does not prevent browsing; this notice may reappear on a later visit.</p>
    <button onClick={openCookieSettings}>Open cookie settings</button>
    <h2>Questions?</h2><p>Contact <a href="mailto:cozycraftfurnitures2026@gmail.com">cozycraftfurnitures2026@gmail.com</a> about this notice or your information.</p>
  </article></Layout>;
}
