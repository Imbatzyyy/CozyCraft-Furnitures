const canonicalOrigin = "https://www.cozycraftfurnitures.com";

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const safePath = (value: string) => {
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return "/new-arrivals";
};

export type NewsletterProduct = {
  id: string;
  name: string;
  category: string;
  price: number;
  image_url: string;
};

export type NewsletterCampaignEmail = {
  subject: string;
  preheader: string;
  heading: string;
  body: string;
  cta_label: string;
  cta_path: string;
  products: NewsletterProduct[];
};

const emailFrame = (content: string, footer: string, preheader = "") =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body style="margin:0;background:#f3efe8;font-family:Arial,sans-serif;color:#201e1b"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div><div style="padding:32px 14px"><div style="max-width:640px;margin:auto;background:#fff;border:1px solid #ded7cc;border-radius:24px;overflow:hidden"><div style="padding:26px 30px;text-align:center;border-bottom:1px solid #e6dfd5"><img src="${canonicalOrigin}/email-logo.png" alt="CozyCraft Furnitures" width="150" style="display:inline-block;max-width:150px;height:auto"><p style="margin:12px 0 0;font-size:10px;font-weight:bold;letter-spacing:2.4px;color:#756e65">THOUGHTFUL FURNITURE</p></div>${content}<div style="padding:20px 30px;background:#eee8de;color:#6e675e;font-size:12px;line-height:1.65">${footer}</div></div></div></body></html>`;

export function buildConfirmationEmail(confirmUrl: string) {
  const content = `<div style="padding:36px 30px"><p style="margin:0 0 12px;font-size:11px;font-weight:bold;letter-spacing:2px;color:#756e65">CONFIRM YOUR SUBSCRIPTION</p><h1 style="margin:0 0 18px;font:42px/1.08 Georgia,serif">A quieter inbox, thoughtfully furnished.</h1><p style="margin:0;color:#655f58;line-height:1.75">Confirm that you would like occasional product arrivals, room ideas, and CozyCraft announcements.</p><p style="margin:28px 0 0"><a href="${escapeHtml(confirmUrl)}" style="display:inline-block;padding:15px 22px;border-radius:12px;background:#201e1b;color:#fff;text-decoration:none;font-weight:bold">Confirm subscription</a></p><p style="margin:22px 0 0;color:#817a71;font-size:12px;line-height:1.6">If you did not request this, you can safely ignore this message.</p></div>`;
  return emailFrame(content, "This confirmation was requested from the newsletter form at cozycraftfurnitures.com.", "Confirm your CozyCraft subscription.");
}

export function buildCampaignEmail(
  campaign: NewsletterCampaignEmail,
  unsubscribeUrl: string,
) {
  const products = campaign.products.slice(0, 4).map((product) => {
    const productUrl = `${canonicalOrigin}/products/${encodeURIComponent(product.id)}`;
    return `<td style="width:50%;padding:7px;vertical-align:top"><a href="${productUrl}" style="display:block;color:#201e1b;text-decoration:none"><img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" style="width:100%;height:190px;object-fit:cover;border-radius:14px;background:#eee8de"><p style="margin:12px 0 4px;font-weight:bold">${escapeHtml(product.name)}</p><p style="margin:0;color:#746d64;font-size:13px">₱${Number(product.price).toLocaleString("en-PH")}</p></a></td>`;
  });
  const rows = [];
  for (let i = 0; i < products.length; i += 2) {
    rows.push(`<tr>${products[i]}${products[i + 1] ?? '<td style="width:50%"></td>'}</tr>`);
  }
  const productSection = rows.length
    ? `<table role="presentation" style="width:calc(100% + 14px);margin:24px -7px 0;border-collapse:collapse">${rows.join("")}</table>`
    : "";
  const content = `<div style="padding:38px 30px"><p style="margin:0 0 12px;font-size:11px;font-weight:bold;letter-spacing:2px;color:#756e65">COZYCRAFT EDIT</p><h1 style="margin:0 0 18px;font:42px/1.08 Georgia,serif">${escapeHtml(campaign.heading)}</h1><div style="color:#655f58;line-height:1.75;white-space:pre-line">${escapeHtml(campaign.body)}</div>${productSection}<p style="margin:30px 0 0"><a href="${canonicalOrigin}${safePath(campaign.cta_path)}" style="display:inline-block;padding:15px 22px;border-radius:12px;background:#201e1b;color:#fff;text-decoration:none;font-weight:bold">${escapeHtml(campaign.cta_label)}</a></p></div>`;
  const footer = `You received this because you subscribed to CozyCraft updates. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#4d4842">Unsubscribe in one click</a>. Need help? Email cozycraftfurnitures2026@gmail.com.`;
  return emailFrame(content, footer, campaign.preheader);
}

export const newsletterOrigin = canonicalOrigin;
