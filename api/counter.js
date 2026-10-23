/**
 * Vercel Serverless Function: Visitor Counter API
 * Endpoint: /api/counter
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const BASE_VISITS = 1428;

  try {
    const upstream = await fetch('https://komarev.com/ghpvc/?username=djtgallery3-stack-freyaroom&style=flat');
    if (upstream.ok) {
      const text = await upstream.text();
      const match = text.match(/<text[^>]*>([0-9]+)<\/text>/g);
      if (match && match.length > 0) {
        const last = match[match.length - 1].replace(/<[^>]+>/g, '');
        const num = parseInt(last, 10);
        if (!isNaN(num)) {
          return res.status(200).json({ visitors: BASE_VISITS + num });
        }
      }
    }
  } catch {
    // Upstream fallback
  }

  return res.status(200).json({ visitors: BASE_VISITS });
}
