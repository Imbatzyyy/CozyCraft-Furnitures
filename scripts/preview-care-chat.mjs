// Local-only visual QA. Requests are fixtures, not paid AI or production data.
// Run: node scripts/preview-care-chat.mjs, then open http://localhost:5178.
import { createServer } from 'vite';
const server = await createServer({
  server: { host: '127.0.0.1', port: 5178, strictPort: true },
  plugins: [{
    name: 'care-preview-fixtures', enforce: 'pre',
    resolveId(source, importer) { if (source === './assistant.service' && importer?.endsWith('/assistant/CareChatPanel.tsx')) return '\0care-preview-service'; },
    load(id) { if (id === '\0care-preview-service') return `export async function askCare(body) { return {message:{from:'care',text:'You can turn your points into a voucher from Home Circle.\\n\\n1. Open My Account, then Home Circle.\\n2. Choose the voucher you can afford and review its points cost.\\n3. Confirm the exchange, then check Available rewards for the saved expiry.\\n\\nAt checkout, choose an eligible voucher before reviewing the final total. Expired vouchers cannot be used.',actions:[{label:'Open Home Circle',href:'/profile?tab=home-circle'},{label:'Open my bag',href:'/cart'}],sources:['Website help']},retryAfter:0}; }`; },
    configureServer(server) { server.middlewares.use(async (req, res, next) => { if (req.url !== '/') return next(); res.setHeader('Content-Type','text/html; charset=utf-8'); res.end(await server.transformIndexHtml('/', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CozyCraft Care · local QA fixtures</title></head><body><div id="root"></div><script type="module" src="/scripts/care-chat-preview.tsx"></script></body></html>')); }); },
  }],
});
await server.listen(); server.printUrls();
