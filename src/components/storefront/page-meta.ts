import { useEffect } from "react";

const pageTitles: Array<[RegExp, string]> = [
  [/^\/(home)?$/, ""],
  [/^\/shop$/, "Shop all furniture"],
  [/^\/living-room$|^\/collections\/living-room$/, "Living room furniture"],
  [/^\/bedroom$|^\/collections\/bedroom$/, "Bedroom furniture"],
  [/^\/dining-room$|^\/collections\/dining-room$/, "Dining room furniture"],
  [/^\/new-arrivals$|^\/collections\/new-arrivals$/, "New arrivals"],
  [/^\/find-my-furniture$/, "Find my furniture"],
  [/^\/compare$/, "Compare pieces"],
  [/^\/products\//, "Furniture"],
  [/^\/journal\//, "Journal"],
  [/^\/cart$/, "Your bag"],
  [/^\/wishlist$/, "Wishlist"],
  [/^\/checkout$/, "Secure checkout"],
  [/^\/payment-return$/, "Payment status"],
  [/^\/orders$/, "Track your order"],
  [/^\/profile$/, "My account"],
  [/^\/login$/, "Sign in"],
  [/^\/signup$/, "Create your account"],
  [/^\/forgot-password$/, "Reset your password"],
  [/^\/reset-password$/, "Choose a new password"],
  [/^\/about$/, "Our story"],
  [/^\/contact$/, "Contact us"],
  [/^\/faq$/, "Frequently asked questions"],
  [/^\/terms$/, "Terms of service"],
  [/^\/privacy$/, "Privacy policy"],
  [/^\/refunds$/, "Returns & refunds"],
  [/^\/cookies$/, "Cookie policy"],
  [/^\/admin/, "Operations"],
];

export function titleForPath(pathname: string, storeName = "CozyCraft Furnitures") {
  const match = pageTitles.find(([pattern]) => pattern.test(pathname));
  if (!match) return `Page not found · ${storeName}`;
  return match[1] ? `${match[1]} · ${storeName}` : `${storeName} · Furniture for a warmer home`;
}

/** Sets a page-specific title after RouteShell applies the route default. */
export function usePageTitle(title: string | null | undefined, storeName = "CozyCraft Furnitures") {
  useEffect(() => {
    if (title) document.title = `${title} · ${storeName}`;
  }, [title, storeName]);
}
