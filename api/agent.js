const { createClient } = require('@vercel/kv');

const SITE_URL = 'https://ai-agent-radar.vercel.app';

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
})[character]);

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : SITE_URL;
  } catch {
    return SITE_URL;
  }
}

function renderPage(agent) {
  const slug = encodeURIComponent(agent.slug || agent.id);
  const canonical = `${SITE_URL}/agent/${slug}`;
  const description = String(agent.description || agent.tagline || `Discover ${agent.name} on AI Agent Radar.`).replace(/\s+/g, ' ').trim().slice(0, 160);
  const topics = (agent.topics || []).map((topic) => `<span class="topic">${escapeHtml(topic)}</span>`).join('');
  const image = agent.thumbnail
    ? `<img class="detail-logo" src="${safeUrl(agent.thumbnail)}" alt="${escapeHtml(agent.name)} logo">`
    : `<div class="detail-logo placeholder" aria-hidden="true">${escapeHtml((agent.name || 'AI').slice(0, 2).toUpperCase())}</div>`;
  const schema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: agent.name,
    description,
    url: canonical,
    applicationCategory: 'AIApplication',
    operatingSystem: 'Web',
    image: agent.thumbnail || undefined,
    sameAs: safeUrl(agent.url)
  }).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(agent.name)} · AI Agent Radar">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${safeUrl(agent.thumbnail || `${SITE_URL}/og-image.svg`)}">
  <title>${escapeHtml(agent.name)} · AI Agent Radar</title>
  <link rel="canonical" href="${canonical}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/styles.css">
  <script type="application/ld+json">${schema}</script>
</head>
<body>
  <header class="site-header compact-header"><a class="brand" href="/">AI Agent Radar</a><nav class="site-nav" aria-label="Main navigation"><a href="/">Home</a><a href="/about">About</a><a href="/contact">Contact</a></nav></header>
  <main class="page-shell detail-shell">
    <a class="back-link" href="/">← Back to radar</a>
    <article class="detail-card">
      <div class="detail-heading">${image}<div><span class="rank-label">AI AGENT DISCOVERY</span><h1>${escapeHtml(agent.name)}</h1><p class="detail-tagline">${escapeHtml(agent.tagline)}</p></div></div>
      <div class="detail-stats"><div><strong>▲ ${Number(agent.votes || 0).toLocaleString()}</strong><span>Product Hunt votes</span></div><div><strong>${escapeHtml(agent.createdAt ? new Date(agent.createdAt).toLocaleDateString('en-US') : '—')}</strong><span>Published</span></div></div>
      <div class="topics detail-topics">${topics || '<span class="topic">AI Agent</span>'}</div>
      <section class="description"><h2>What does ${escapeHtml(agent.name)} do?</h2><p>${escapeHtml(agent.description || agent.tagline)}</p></section>
      <section class="radar-context"><h2>Why it is on the Radar</h2><p>${escapeHtml(agent.name)} was identified as an AI-agent-related launch based on its product description, topics and community activity. Its listing is provided for independent discovery and informational purposes.</p></section>
      <a class="button button-primary detail-visit" href="${safeUrl(agent.url)}" target="_blank" rel="noopener noreferrer">Visit official listing ↗</a>
    </article>
  </main>
  <footer class="site-footer"><p>AI Agent Radar · Independent AI agent discovery</p><p>This site is supported by ads. We do not sell user data.</p><nav class="footer-links" aria-label="Legal"><a href="/about">About</a><span aria-hidden="true">·</span><a href="/contact">Contact</a><span aria-hidden="true">·</span><a href="/privacy-policy">Privacy Policy</a><span aria-hidden="true">·</span><a href="/terms-of-service">Terms of Service</a></nav></footer>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method not allowed');
  }
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return res.status(503).send('Agent storage is not configured');

  try {
    const kv = createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
    const payload = await kv.get('agents:latest');
    const requested = String(req.query.slug || '');
    const agent = (payload?.agents || []).find((item) => String(item.slug) === requested || String(item.id) === requested);
    if (!agent) return res.status(404).send('<!doctype html><title>Agent not found · AI Agent Radar</title><h1>Agent not found</h1><p><a href="/">Return to AI Agent Radar</a></p>');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).send(renderPage(agent));
  } catch (error) {
    console.error('Agent page render failed:', { name: error?.name, message: error?.message });
    return res.status(500).send('Unable to render agent page');
  }
};
