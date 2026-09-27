// Local-only visual QA; optional aggregate snapshot, never a production route.
// Run: node scripts/preview-intelligence.mjs
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';
const snapshotPath = process.env.FORECAST_PREVIEW_SNAPSHOT;
if (snapshotPath && (!snapshotPath.startsWith('/tmp/cozy-forecast-') || !snapshotPath.endsWith('.json'))) throw new Error('Use an approved temporary aggregate snapshot');
const snapshot = snapshotPath ? JSON.parse(readFileSync(snapshotPath, 'utf8')) : null;
const server = await createServer({
  server: { host: '127.0.0.1', port: 5179, strictPort: true },
  plugins: [{ name: 'intelligence-preview', configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url === '/__forecast_snapshot') {
        res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control','no-store');
        res.end(JSON.stringify({ snapshot })); return;
      }
      if (req.url !== '/') return next();
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(await server.transformIndexHtml('/', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CozyCraft Intelligence · local QA</title></head><body><div id="root"></div><script type="module" src="/scripts/intelligence-preview.tsx"></script></body></html>'));
    });
  } }],
});
await server.listen(); server.printUrls();
