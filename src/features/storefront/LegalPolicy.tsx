import { Layout, useStore } from '@/app/core';
import { useLocation, Link } from 'react-router-dom';
import { CUSTOMER_PRIVACY_SECTIONS, CUSTOMER_TERMS_SECTIONS } from '@/lib/legal/customer-policies';
import './cookie-consent.css';

export function Component() {
  const { pathname } = useLocation();
  const { storeSettings } = useStore();
  const refunds = pathname === '/refunds';
  const privacy = pathname === '/privacy';
  const sections = refunds ? [
    { title: 'Cancellation requests', body: `The current self-service cancellation window is ${storeSettings.fulfillment_settings.cancellation_window_hours} hours after placing an order. Open Account → Orders to request cancellation while the order is eligible. A request does not cancel an order until approved. Contact customer care if the button is unavailable or you need to report an error.` },
    { title: 'Return requests', body: `The current self-service return window is ${storeSettings.fulfillment_settings.return_window_days} days after delivery. Open Account → Orders → Request return. Include your order number, the affected item, and a description of the issue. Provide relevant photos if requested; avoid including unrelated personal information.` },
    { title: 'Damaged, incorrect, or defective items', body: 'Contact customer care promptly if an item is damaged, incorrect, defective, or does not match its description. Keep the item and relevant packaging while the issue is assessed. Do not send it to an unconfirmed address. The team will explain the applicable remedy and return arrangements. Self-service deadlines do not remove mandatory consumer rights.' },
    { title: 'Change of mind and return arrangements', body: 'Do not assume that a change-of-mind return is automatically accepted. Contact customer care for eligibility, condition requirements, the return destination, and any applicable shipping costs before arranging a return. Statutory remedies for faulty or nonconforming goods are separate from discretionary change-of-mind requests.' },
    { title: 'Refund method and timing', body: 'An approved refund is handled through the applicable payment workflow. Online-payment refunds depend on the payment provider and financial institution. For cash-on-delivery orders, customer care must confirm the refund arrangement. Ask for the expected processing time and reference for your case; approval is not confirmation that funds have reached your account. Never send passwords, OTPs, or complete card details to support.' },
    { title: 'Help and your rights', body: `Contact ${storeSettings.contact_email} with your order number. This page explains current request options; it does not waive rights under Philippine consumer law. If a self-service option is unavailable, you may still contact customer care about a legal remedy or unresolved complaint.` },
  ] : privacy ? CUSTOMER_PRIVACY_SECTIONS : CUSTOMER_TERMS_SECTIONS;
  return <Layout><main className="cookie-policy"><p className="cookie-eyebrow">COZYCRAFT CUSTOMER INFORMATION</p><h1>{refunds ? 'Returns, cancellations & refunds.' : privacy ? 'Your privacy matters.' : 'Terms of use.'}</h1><p>Updated September 9, 2026</p><p>{refunds ? 'Read these details before ordering. The request windows below use the current store settings.' : 'Please read this information before using CozyCraft’s account and shopping services.'}</p>
    {sections.map(section => <section key={section.title}><h2>{section.title}</h2><p>{section.body}</p></section>)}
    <nav aria-label="Related policies" className="flex flex-wrap gap-5"><Link to="/refunds">Returns & refunds</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/cookies">Cookies</Link><Link to="/contact">Contact customer care</Link></nav>
  </main></Layout>;
}
