import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { serveProtected } from "../_shared/security-boundary.ts";
import { evidenceType, fileLimit, saveEvidence } from "./evidence.ts";

const origins = new Set(["https://cozycraftfurnitures.com", "https://www.cozycraftfurnitures.com", "http://localhost:5173"]);
const maxBody = 3 * fileLimit + 64 * 1024;
serveProtected(async req => {
  const origin = req.headers.get("Origin") ?? "";
  const headers = { "Access-Control-Allow-Origin": origins.has(origin) ? origin : "https://www.cozycraftfurnitures.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cozycraft-platform",
    "Cache-Control": "no-store", Vary: "Origin" };
  const reply = (status: number, error?: string) => Response.json(error ? { error } : { success: true }, { status, headers });
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return reply(405, "Use POST.");
  const client = createClient(Deno.env.get("SUPABASE_URL")!, (Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY"))!,
    { global: { headers: { Authorization: req.headers.get("Authorization")! } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return reply(403, "Please sign in again.");
  if (!req.body || !req.headers.get("content-type")?.startsWith("multipart/form-data")) return reply(400, "Upload the files using the request form.");
  if (Number(req.headers.get("content-length")) > maxBody) return reply(413, "Attachments are too large.");
  let total = 0, form: FormData;
  try {
    const bounded = req.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({ transform(chunk, controller) {
      total += chunk.byteLength;
      if (total > maxBody) throw Error("body too large");
      controller.enqueue(chunk);
    } }));
    form = await new Response(bounded, { headers: { "content-type": req.headers.get("content-type")! } }).formData();
  } catch { return reply(total > maxBody ? 413 : 400, "The upload was too large or could not be read."); }
  const field = (name: string) => typeof form.get(name) === "string" ? String(form.get(name)).trim() : "";
  const kind = field("kind"), support = kind === "support", message = field("message");
  if ((!support && kind !== "return") || message.length < 10 || message.length > 4000) return reply(400, "Provide a description of 10 to 4,000 characters.");
  const category = field("category"), priority = field("priority"), reason = field("reason"), order = field("order");
  if (support && (!["order","delivery","payment","product","return","account","general"].includes(category) || !["low","normal","high","urgent"].includes(priority))) return reply(400, "Choose a valid support category and priority.");
  if (!support && (!order || !reason || reason.length > 200)) return reply(400, "Choose an order and a return reason.");
  if (order) {
    const found = await client.from("orders").select("status").eq("id", order).eq("user_id", user.id).maybeSingle();
    if (found.error || !found.data || (!support && found.data.status !== "delivered")) return reply(400, "This order is not available for this request.");
  }
  const parts = form.getAll("file");
  if (!parts.length || parts.length > 3 || !parts.every(p => p instanceof File)) return reply(400, "Choose one to three attachments.");
  const files = parts as File[];
  for (const f of files) if (!await evidenceType(f, support)) return reply(400, "A file did not match its allowed type or size. Use JPG, PNG, WebP" + (support ? " or PDF" : "") + ", up to 5 MB each.");
  const storage = client.storage.from(support ? "support-attachments" : "return-evidence");
  const result = await saveEvidence(files,
    f => user.id + "/" + crypto.randomUUID() + "." + ({"image/jpeg":"jpg","image/png":"png","image/webp":"webp","application/pdf":"pdf"}[f.type]),
    async (p, f) => !(await storage.upload(p, f, { contentType: f.type, upsert: false })).error,
    async paths => !(await storage.remove(paths)).error,
    async paths => {
      const result = support ? await client.from("support_tickets").insert({ user_id: user.id, order_id: order || null, category, priority, subject: category[0].toUpperCase() + category.slice(1) + " support request", message, attachment_paths: paths })
        : await client.from("return_requests").insert({ user_id: user.id, order_id: order, reason, details: message, evidence_paths: paths });
      if (!result.error) return "saved";
      return result.status >= 400 && result.status < 500 && result.status !== 408 && result.error.code ? "rejected" : "unknown";
    });
  if (result === "saved") return reply(200);
  if (result === "unknown") return reply(503, "Submission could not be confirmed. Check your requests before submitting again.");
  return reply(result === "upload_failed" ? 503 : 400, result === "upload_failed" ? "The attachments could not be saved. Please try again." : "The request could not be saved. Check the order and your existing requests.");
});
