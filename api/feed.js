const { createClient } = require('@vercel/kv');
const { cleanIssueEvidence } = require('../lib/opportunity-themes');

const SITE_URL = 'https://getaiagentradar.com';
const escapeXml = (value = '') => String(value).replace(/[<>&'\"]/g, (character) => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
})[character]);

module.exports = async function handler(req, res) {
  if (!['GET', 'HEAD'].includes(req.method)) {
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

  const agents = Array.isArray(payload.agents) ? payload.agents : [];
  const agentEntries = agents.map((agent) => {
    const slug = encodeURIComponent(agent.slug || agent.id);
    return { title: `[Agent] ${agent.name}`, link: `${SITE_URL}/agent/${slug}`, description: agent.description || agent.tagline, publishedAt: agent.firstSeenAt || agent.updatedAt || payload.updatedAt };
  });
  const opportunityEntries = agents.flatMap((agent) => cleanIssueEvidence(agent.evidenceIssues || []).map((issue) => ({
    title: `[Opportunity] ${issue.title}`,
    link: `${SITE_URL}/opportunity/${encodeURIComponent(issue.id)}`,
    description: `Demand evidence from ${agent.name}: ${Number(issue.comments || 0)} comments and ${Number(issue.reactions || 0)} positive reactions.`,
    publishedAt: issue.firstSeenAt || issue.updatedAt || payload.updatedAt
  })));
  const items = [...agentEntries, ...opportunityEntries]
    .sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0))
    .slice(0, 50)
    .map((entry) => `<item>
      <title>${escapeXml(entry.title)}</title>
      <link>${escapeXml(entry.link)}</link>
      <guid isPermaLink="true">${escapeXml(entry.link)}</guid>
      <description>${escapeXml(entry.description)}</description>
      <pubDate>${new Date(entry.publishedAt || payload.updatedAt || Date.now()).toUTCString()}</pubDate>
    </item>`).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AI Agent Radar</title>
    <link>${SITE_URL}</link>
    <description>Professionally filtered open-source AI agent projects and traceable demand opportunities from GitHub, refreshed every six hours.</description>
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
