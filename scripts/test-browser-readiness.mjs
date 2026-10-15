// Local fixtures only. These suites stub all external APIs and block realtime.
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
const port = "5196";
const base = `http://127.0.0.1:${port}`;
const run = (args, env = process.env) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, args, { stdio: "inherit", env });
  child.once("error", reject);
  child.once("exit", code => code === 0 ? resolve() : reject(new Error(`${args.join(" ")} failed (${code})`)));
});
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", port, "--strictPort"], { stdio: "inherit" });
let serverFailure;
server.once("error", error => { serverFailure = error; });
server.once("exit", code => { serverFailure = new Error(`Fixture server exited (${code})`); });
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    await delay(200);
    if (serverFailure) throw serverFailure;
    try { ready = (await fetch(base, { signal: AbortSignal.timeout(1000) })).ok; } catch {}
    if (ready) break;
  }
  if (!ready) throw new Error("Fixture server did not become ready");
  for (const script of ["test-admin-login.mjs", "test-product-recovery.mjs", "test-storefront-quality.mjs"]) {
    await run([`scripts/${script}`], { ...process.env, TEST_BASE_URL: base });
  }
} finally { server.kill("SIGTERM"); }
