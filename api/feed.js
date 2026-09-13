const { createClient } = require('@vercel/kv');
const { cleanIssueEvidence } = require('../lib/opportunity-themes');
const { category } = require('../lib/radar');

const SITE_URL = 'https://getaiagentradar.com';
const DOMAINS = {
  security: 'Security', finance: 'Finance', research: 'Research', coding: 'Coding',
  marketing: 'Marketing', design: 'Design', productivity: 'Productivity', infrastructure: 'Agent Infrastructure'
};
const escapeXml = (value = '') => String(value).replace(/[<>&'\"]/g, (character) => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
})[character]);
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
})[character]);

function formatDate(value) {
  const date = new Date(value || 0);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
    : 'Date unavailable';
}

function renderReader(entries, selectedSlug = '') {
  const selectedDomain = DOMAINS[selectedSlug] || '';
  const feedUrl = `${SITE_URL}/feed.xml${selectedSlug ? `?domain=${encodeURIComponent(selectedSlug)}` : ''}`;
  const cards = entries.map((entry) => `<article class="rss-card rss-${entry.type}" data-rss-entry="${entry.type}" data-rss-domain="${escapeHtml(entry.domain)}"><div><span>${entry.type === 'agent' ? 'PROJECT' : 'DEMAND SIGNAL'} · ${escapeHtml(entry.domain)}</span><time datetime="${escapeHtml(entry.publishedAt)}">${escapeHtml(formatDate(entry.publishedAt))}</time></div><h2><a href="${escapeHtml(entry.path)}">${escapeHtml(entry.displayTitle)}</a></h2><p>${escapeHtml(entry.description)}</p></article>`).join('');
  const empty = '<div class="workspace-empty"><h2>No feed entries yet</h2><p>The feed will update after the next qualified GitHub signal is published.</p><a class="button button-primary" href="/feed.xml">Open RSS XML</a></div>';
  const domainLinks = [`<a href="/rss"${selectedSlug ? '' : ' aria-current="page"'}>All fields</a>`, ...Object.entries(DOMAINS).map(([slug, name]) => `<a href="/rss?domain=${slug}"${slug === selectedSlug ? ' aria-current="page"' : ''}>${escapeHtml(name)}</a>`)].join('');
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Read the latest open-source AI agent projects and GitHub demand signals, or subscribe with any RSS app."><meta name="robots" content="${selectedSlug ? 'noindex, follow' : 'index, follow'}"><link rel="canonical" href="${SITE_URL}/rss"><link rel="alternate" type="application/rss+xml" title="AI Agent Radar${selectedDomain ? ` ${escapeHtml(selectedDomain)}` : ''} RSS Feed" href="${escapeHtml(feedUrl)}"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/styles.css"><title>${selectedDomain ? `${escapeHtml(selectedDomain)} RSS` : 'RSS Reader'} · AI Agent Radar</title></head><body><header class="site-header"><a class="brand" href="/">AI Agent Radar</a><nav class="site-nav"><a href="/">Home</a><a href="/opportunities">Opportunities</a><a href="/patterns">Patterns</a><a href="/workspace">Workspace</a><a href="/weekly">Weekly Radar</a><a href="/rss" aria-current="page">RSS</a></nav></header><main class="page-shell report-shell rss-shell"><section class="report-hero"><span class="eyebrow">READ OR SUBSCRIBE</span><h1>${selectedDomain ? `${escapeHtml(selectedDomain)} ` : ''}Intelligence <span>Feed</span></h1><p>Read the latest filtered projects and GitHub-backed demand signals here. To receive updates in an RSS app, copy the XML feed address below.</p></section><section class="rss-subscribe"><div><span class="analysis-label">${selectedDomain ? `${escapeHtml(selectedDomain.toUpperCase())} ` : ''}RSS SUBSCRIPTION URL</span><h2>Follow every refresh</h2><p>A web browser may display the XML feed as code. That is normal—the address is designed to be pasted into an RSS reader.</p></div><div class="rss-copy"><label for="rss-url">Feed address</label><div><input id="rss-url" type="url" value="${escapeHtml(feedUrl)}" readonly><button class="button button-primary" id="rss-copy" type="button">Copy feed URL</button></div><span id="rss-copy-status" aria-live="polite"></span></div></section><nav class="opportunity-domains rss-domains" aria-label="Choose a professional feed">${domainLinks}</nav><nav class="rss-filters" aria-label="Filter feed entries"><button type="button" class="active" data-rss-filter="all">All updates</button><button type="button" data-rss-filter="opportunity">Demand signals</button><button type="button" data-rss-filter="agent">Projects</button><a href="${escapeHtml(`/feed.xml${selectedSlug ? `?domain=${selectedSlug}` : ''}`)}">Open raw XML ↗</a></nav><div class="rss-result"><strong id="rss-count">${entries.length}</strong><span id="rss-status">${selectedDomain ? `${escapeHtml(selectedDomain)} feed entries` : 'current feed entries'}</span></div><section id="rss-list" class="rss-list" aria-live="polite">${cards || empty}</section><noscript><p class="rss-noscript">The feed is fully readable without JavaScript. Filters and the copy button require JavaScript.</p></noscript></main><footer class="site-footer"><p>AI Agent Radar · Free, independent open-source intelligence</p><nav class="footer-links"><a href="/feed.xml">RSS XML</a><span>·</span><a href="/about">About</a><span>·</span><a href="/privacy-policy">Privacy Policy</a><span>·</span><a href="/contact">Contact</a></nav></footer><script src="/rss-reader.js"></script><script src="/analytics.js"></script></body></html>`;
}

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
    return { type: 'agent', domain: agent.category || category(agent), displayTitle: agent.name, title: `[Agent] ${agent.name}`, path: `/agent/${slug}`, link: `${SITE_URL}/agent/${slug}`, description: agent.description || agent.tagline, publishedAt: agent.firstSeenAt || agent.updatedAt || payload.updatedAt };
  });
  const opportunityEntries = agents.flatMap((agent) => cleanIssueEvidence(agent.evidenceIssues || []).map((issue) => ({
    type: 'opportunity',
    domain: agent.category || category(agent),
    displayTitle: issue.title,
    title: `[Opportunity] ${issue.title}`,
    path: `/opportunity/${encodeURIComponent(issue.id)}`,
    link: `${SITE_URL}/opportunity/${encodeURIComponent(issue.id)}`,
    description: `Demand evidence from ${agent.name}: ${Number(issue.comments || 0)} comments and ${Number(issue.reactions || 0)} positive reactions.`,
    publishedAt: issue.firstSeenAt || issue.updatedAt || payload.updatedAt
  })));
  const selectedSlug = String(req.query?.domain || '').trim().toLowerCase();
  if (selectedSlug && !DOMAINS[selectedSlug]) return res.status(400).send('Unknown professional field');
  const entries = [...agentEntries, ...opportunityEntries]
    .sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0))
    .filter((entry) => !selectedSlug || entry.domain === DOMAINS[selectedSlug])
    .slice(0, 50);

  if (req.query?.format === 'html') {
    if (selectedSlug) res.setHeader('X-Robots-Tag', 'noindex, follow');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=1800');
    return res.status(200).send(renderReader(entries, selectedSlug));
  }

  const items = entries.map((entry) => `<item>
      <title>${escapeXml(entry.title)}</title>
      <link>${escapeXml(entry.link)}</link>
      <guid isPermaLink="true">${escapeXml(entry.link)}</guid>
      <description>${escapeXml(entry.description)}</description>
      <category>${escapeXml(entry.domain)}</category>
      <pubDate>${new Date(entry.publishedAt || payload.updatedAt || Date.now()).toUTCString()}</pubDate>
    </item>`).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AI Agent Radar${selectedSlug ? ` · ${escapeXml(DOMAINS[selectedSlug])}` : ''}</title>
    <link>${SITE_URL}</link>
    <description>Professionally filtered open-source AI agent projects and traceable demand opportunities from GitHub, refreshed every six hours.</description>
    <language>en</language>
    <lastBuildDate>${new Date(payload.updatedAt || Date.now()).toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml${selectedSlug ? `?domain=${selectedSlug}` : ''}" rel="self" type="application/rss+xml" />
    <atom:link href="${SITE_URL}/weekly" rel="related" type="text/html" />
    ${items}
  </channel>
</rss>`;

  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
  return res.status(200).send(xml);
};
