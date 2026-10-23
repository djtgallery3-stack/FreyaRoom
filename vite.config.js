import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

function counterMiddleware(server) {
  server.middlewares.use('/api/counter', async (req, res) => {
    try {
      const up = await fetch('https://hits.sh/djtgallery3-freya-room.vercel.app.svg', {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FreyaRoomLocal/1.0)' },
      });
      const t = await up.text();
      const m = t.match(/hits:\s*([0-9]+)/i);
      const visitors = m && m[1] ? parseInt(m[1], 10) : 1;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(JSON.stringify({ visitors, source: 'local-hits.sh' }));
    } catch {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(JSON.stringify({ visitors: 1, fallback: true }));
    }
  });
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    {
      name: 'api-counter-middleware',
      configureServer: counterMiddleware,
      configurePreviewServer: counterMiddleware,
    },
  ],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
});
