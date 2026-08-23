const { createClient } = require('@vercel/kv');

const SITE_URL = 'https://getaiagentradar.com';
const escapeXml = (value = '') => String(value).replace(/[<>&'\"]/g, (character) => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
})[character]);

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method not allowed');
  }

  let payload = { updatedAt: new Date().toISOString(), agents: [] };
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const kv = createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
      const stored = await kv.get('agents:latest');
      if (stored && typeof stored === 'object') payload = stored;
    }
  } catch (error) {
    console.error('RSS feed lookup failed:', { name: error?.name, message: error?.message });
  }

  const items = (Array.isArray(payload.agents) ? payload.agents : []).map((agent) => {
    const slug = encodeURIComponent(agent.slug || agent.id);
    const link = `${SITE_URL}/agent/${slug}`;
    return `<item>
      <title>${escapeXml(agent.name)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <description>${escapeXml(agent.description || agent.tagline)}</description>
      <pubDate>${new Date(agent.createdAt || payload.updatedAt || Date.now()).toUTCString()}</pubDate>
    </item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AI Agent Radar</title>
    <link>${SITE_URL}</link>
    <description>New and trending AI agents, refreshed every six hours.</description>
    <language>en</language>
    <lastBuildDate>${new Date(payload.updatedAt || Date.now()).toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    <atom:link href="${SITE_URL}/weekly" rel="related" type="text/html" />
    ${items}
  </channel>
</rss>`;

  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
  return res.status(200).send(xml);
};
