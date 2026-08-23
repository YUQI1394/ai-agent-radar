const { createClient } = require('@vercel/kv');
const { weekKey } = require('../lib/radar');

const SITE_URL = 'https://getaiagentradar.com';
const escapeXml = (value) => String(value).replace(/[<>&'\"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character]);

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method not allowed');
  }

  const staticUrls = [
    { path: '/', lastmod: null },
    { path: '/about', lastmod: '2026-08-22T00:00:00.000Z' },
    { path: '/contact', lastmod: '2026-08-22T00:00:00.000Z' },
    { path: '/privacy-policy', lastmod: '2026-08-22T00:00:00.000Z' },
    { path: '/terms-of-service', lastmod: '2026-08-21T00:00:00.000Z' }
  ];
  let agents = [];
  let reportDates = [];
  let updatedAt = new Date().toISOString();
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const kv = createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
      const [payload, archive, reports] = await Promise.all([kv.get('agents:latest'), kv.get('agents:archive'), kv.get('weekly:reports')]);
      agents = Array.isArray(archive?.agents) && archive.agents.length ? archive.agents : (Array.isArray(payload?.agents) ? payload.agents : []);
      updatedAt = payload?.updatedAt || updatedAt;
      reportDates = reports && typeof reports === 'object' && !Array.isArray(reports) ? Object.keys(reports) : [];
      const currentWeek = weekKey(updatedAt);
      if (!reportDates.includes(currentWeek)) reportDates.push(currentWeek);
    }
  } catch (error) {
    console.error('Sitemap agent lookup failed:', { name: error?.name, message: error?.message });
  }

  const urls = [
    ...staticUrls.map((page) => ({ loc: `${SITE_URL}${page.path}`, lastmod: page.lastmod || updatedAt })),
    ...reportDates.map((date) => ({ loc: `${SITE_URL}/weekly/${date}`, lastmod: date })),
    ...agents.map((agent) => ({ loc: `${SITE_URL}/agent/${encodeURIComponent(agent.slug || agent.id)}`, lastmod: agent.createdAt || updatedAt }))
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${escapeXml(url.loc)}</loc><lastmod>${escapeXml(new Date(url.lastmod).toISOString())}</lastmod></url>`).join('\n')}\n</urlset>`;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
  return res.status(200).send(xml);
};
