// Local-only navigation regression harness. No production route or data writes.
import { createServer } from 'vite';
const server = await createServer({
  server: { host: '127.0.0.1', port: 5176, strictPort: true },
  plugins: [{ name: 'navigation-preview', configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url !== '/') return next();
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(await server.transformIndexHtml('/', '<!doctype html><html data-surface="store"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CozyCraft navigation · local QA</title></head><body><div id="root"></div><script type="module" src="/scripts/navigation-preview.tsx"></script></body></html>'));
    });
  } }],
});
await server.listen(); server.printUrls();
