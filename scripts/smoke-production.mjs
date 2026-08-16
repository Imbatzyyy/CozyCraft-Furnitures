const baseUrl = (process.env.COZYCRAFT_BASE_URL ?? "https://www.cozycraftfurnitures.com").replace(/\/$/, "");
const routes = [
  "/",
  "/living-room",
  "/bedroom",
  "/dining-room",
  "/about",
  "/terms",
  "/privacy",
  "/login",
  "/signup",
  "/forgot-password",
  "/cart",
  "/profile",
  "/admin",
  "/admin/login",
  "/admin/member-tiers",
];
const requiredSecurityHeaders = {
  "content-security-policy": "default-src",
  "permissions-policy": "camera=()",
  "referrer-policy": "strict-origin-when-cross-origin",
  "strict-transport-security": "max-age=",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};

const failures = [];
for (const route of routes) {
  const response = await fetch(`${baseUrl}${route}`, { redirect: "follow" });
  const html = await response.text();
  if (!response.ok) failures.push(`${route}: HTTP ${response.status}`);
  if (!html.includes('id="root"')) failures.push(`${route}: SPA root is missing`);
  if (!response.headers.get("content-type")?.includes("text/html")) failures.push(`${route}: HTML content type is missing`);
  for (const [header, expected] of Object.entries(requiredSecurityHeaders)) {
    if (!response.headers.get(header)?.includes(expected)) {
      failures.push(`${route}: ${header} is missing or invalid`);
    }
  }
  if ((route.startsWith("/admin") || route === "/profile") && !response.headers.get("x-robots-tag")?.includes("noindex")) {
    failures.push(`${route}: private route is indexable`);
  }
}

const robots = await fetch(`${baseUrl}/robots.txt`);
const robotsText = await robots.text();
if (!robots.ok || !robotsText.includes("Disallow: /admin/")) failures.push("robots.txt does not protect admin routes");

const sitemap = await fetch(`${baseUrl}/sitemap.xml`);
const sitemapText = await sitemap.text();
if (!sitemap.ok || !sitemapText.includes(`${baseUrl}/about`)) failures.push("sitemap.xml is unavailable or incomplete");

if (failures.length) {
  console.error(`Production smoke test failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(`Production smoke test passed for ${routes.length} routes, security headers, robots.txt, and sitemap.xml.`);
