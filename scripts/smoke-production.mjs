const baseUrl = (process.env.COZYCRAFT_BASE_URL ?? "https://www.cozycraftfurnitures.com").replace(/\/$/, "");
const routes = ["/", "/living-room", "/bedroom", "/dining-room", "/about", "/login", "/cart"];

const failures = [];
for (const route of routes) {
  const response = await fetch(`${baseUrl}${route}`, { redirect: "follow" });
  const html = await response.text();
  if (!response.ok) failures.push(`${route}: HTTP ${response.status}`);
  if (!html.includes('id="root"')) failures.push(`${route}: SPA root is missing`);
  if (!response.headers.get("content-security-policy")) failures.push(`${route}: CSP header is missing`);
  if (response.headers.get("x-content-type-options") !== "nosniff") failures.push(`${route}: nosniff header is missing`);
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

console.log(`Production smoke test passed for ${routes.length} routes, robots.txt, and sitemap.xml.`);
