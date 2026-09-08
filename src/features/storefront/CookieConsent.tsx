import { useEffect, useRef, useState } from 'react';
import { COOKIE_CHOICE_KEY, cookieChoiceRecord, validCookieChoice } from '@/lib/legal/cookie-consent';
import './cookie-consent.css';

export function CookieConsent() {
  const [visible, setVisible] = useState(() => {
    try { return !validCookieChoice(localStorage.getItem(COOKIE_CHOICE_KEY)); } catch { return true; }
  });
  const panel = useRef<HTMLElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const open = () => { returnFocus.current = document.activeElement as HTMLElement; setVisible(true); requestAnimationFrame(() => panel.current?.focus()); };
    const sync = (event: StorageEvent) => {
      if (event.key === COOKIE_CHOICE_KEY || event.key === null) setVisible(!validCookieChoice(event.newValue));
    };
    window.addEventListener('cozycraft-cookie-settings', open);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('cozycraft-cookie-settings', open); window.removeEventListener('storage', sync); };
  }, []);
  if (!visible) return null;
  return <section className="cookie-notice" aria-labelledby="cookie-notice-title" tabIndex={-1} ref={panel}>
    <div><p className="cookie-eyebrow">YOUR PRIVACY, SIMPLY</p><h2 id="cookie-notice-title">Just the essentials.</h2>
      <p>We use cookies and similar browser storage to keep your account secure and your shopping working. We currently use no optional advertising or analytics trackers.</p>
      <p className="cookie-small">Your choice stays in this browser for 180 days. If storage is blocked, it lasts for this visit only.</p></div>
    <div className="cookie-actions"><button onClick={() => {
      try { localStorage.setItem(COOKIE_CHOICE_KEY, cookieChoiceRecord()); } catch { /* In-memory acknowledgement still works. */ }
      setVisible(false); returnFocus.current?.focus();
    }}>Keep essential only</button><a href="/cookies">Read cookie policy</a></div>
  </section>;
}
