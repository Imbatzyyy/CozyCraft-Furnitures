// Reuses existing server credentials in memory. Never prints or persists keys.
// One product per request; unchanged photo sets are cached, max 91 by default.
import { execFileSync } from "node:child_process";
const ref = "gwjsivqksyimuabbdyqq";
const output = execFileSync(
  "npx",
  [
    "supabase",
    "projects",
    "api-keys",
    "--project-ref",
    ref,
    "--output",
    "json",
  ],
  { encoding: "utf8" },
);
const keys = JSON.parse(output.slice(output.indexOf("[")));
const key = keys.find((k) => k.name === "service_role")?.api_key;
if (!key) throw new Error("Release credential unavailable");
const base = `https://${ref}.supabase.co`;
const response = await fetch(
  base + "/rest/v1/products?select=id&status=eq.active&order=id",
  { headers: { apikey: key, Authorization: `Bearer ${key}` } },
);
if (!response.ok) throw new Error("Catalog unavailable");
const products = await response.json();
const requested = process.argv.find((v) => v.startsWith("--id="))?.slice(5);
const limit = Math.min(
  100,
  Number(process.argv.find((v) => v.startsWith("--limit="))?.slice(8) || 91),
);
let cooldown = 0;
for (const product of products
  .filter((p) => !requested || p.id === requested)
  .slice(0, limit)) {
  if (cooldown > 0)
    await new Promise((resolve) => setTimeout(resolve, cooldown * 1000));
  const result = await fetch(base + "/functions/v1/furniture-discovery", {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "index", productId: product.id }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await result.json();
  console.log(
    JSON.stringify({ product: product.id, status: result.status, ...data }),
  );
  if (!result.ok) {
    process.exitCode = 1;
    break;
  }
  cooldown = Math.min(60, Math.max(2, Number(data.nextIndexAfter) || 0));
}
