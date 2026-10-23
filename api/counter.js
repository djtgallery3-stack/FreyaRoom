/**
 * Vercel Serverless Function: Visitor Counter API
 * Endpoint: /api/counter
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. Primary: hits.sh (increments live on every page hit)
  try {
    const upstream = await fetch('https://hits.sh/djtgallery3-freya-room.vercel.app.svg', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FreyaRoomCounter/1.0)',
      },
      signal: AbortSignal.timeout(3500),
    });
    if (upstream.ok) {
      const text = await upstream.text();
      const match = text.match(/hits:\s*([0-9]+)/i);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > 0) {
          return res.status(200).json({ visitors: num, source: 'hits.sh' });
        }
      }
    }
  } catch {
    // fallback to secondary provider
  }

  // 2. Secondary fallback: visitor-badge.laobi.icu
  try {
    const upstream2 = await fetch('https://visitor-badge.laobi.icu/badge?page_id=djtgallery3.freya-room', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FreyaRoomCounter/1.0)',
      },
      signal: AbortSignal.timeout(3500),
    });
    if (upstream2.ok) {
      const text2 = await upstream2.text();
      const match2 = text2.match(/<text[^>]*>([0-9]+)<\/text>/g);
      if (match2 && match2.length > 0) {
        const last = match2[match2.length - 1].replace(/<[^>]+>/g, '');
        const num2 = parseInt(last, 10);
        if (!isNaN(num2) && num2 > 0) {
          return res.status(200).json({ visitors: num2, source: 'laobi' });
        }
      }
    }
  } catch {
    // fallback
  }

  return res.status(200).json({ visitors: 1, fallback: true });
}
