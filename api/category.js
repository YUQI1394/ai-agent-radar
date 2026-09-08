const { createClient } = require('@vercel/kv');
const { category, scoreBreakdown } = require('../lib/radar');

const SITE_URL = 'https://getaiagentradar.com';
const DOMAINS = {
  research: { name: 'Research', description: 'Agents for deep research, retrieval, knowledge work and scientific workflows.' },
  security: { name: 'Security', description: 'Agents for security operations, threat analysis, testing and defensive workflows.' },
  finance: { name: 'Finance', description: 'Agents for quantitative finance, markets, investment research and financial operations.' },
  coding: { name: 'Coding', description: 'Agents for software development, testing, review, deployment and engineering workflows.' },
  marketing: { name: 'Marketing', description: 'Agents for growth, sales, campaigns and customer acquisition workflows.' },
  design: { name: 'Design', description: 'Agents for product design, creative production and visual workflows.' },
  productivity: { name: 'Productivity', description: 'Agents for personal work, collaboration, scheduling and task automation.' },
  infrastructure: { name: 'Agent Infrastructure', description: 'Frameworks, runtimes, memory, observability and orchestration for building agents.' }
};
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);

function card(agent, index) {
  const slug = encodeURIComponent(agent.slug || agent.id);
  const score = agent.score || scoreBreakdown(agent);
  return `<article class="weekly-item"><div class="weekly-rank">#${index + 1}</div><div><span class="analysis-label">${escapeHtml(agent.qualityLabel || 'REVIEWED')}</span><h2><a href="/agent/${slug}">${escapeHtml(agent.name)}</a></h2><p>${escapeHtml(agent.tagline || agent.description)}</p><div class="weekly-metrics"><span>Radar ${score.total}</span><span>★ ${Number(agent.stars || 0).toLocaleString()}</span><span>${Number(agent.painSignals || 0)} demand signals</span><span>${escapeHtml(agent.license || 'License not declared')}</span></div></div></article>`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');
  const slug = String(req.query.slug || '').toLowerCase();
  const domain = DOMAINS[slug];
  if (!domain) return res.status(404).send('Professional domain not found');
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return res.status(503).send('Agent storage is not configured');
  try {
    const kv = createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
    const payload = await kv.get('agents:latest');
    const agents = (payload?.agents || []).filter((agent) => category(agent) === domain.name)
      .sort((a, b) => Number(b.score?.total || scoreBreakdown(b).total) - Number(a.score?.total || scoreBreakdown(a).total));
    const canonical = `${SITE_URL}/category/${slug}`;
    const schema = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'CollectionPage', '@id': `${canonical}#page`, name: `${domain.name} AI Agents`, description: domain.description, url: canonical, dateModified: payload?.updatedAt, mainEntity: { '@id': `${canonical}#projects` } },
        { '@type': 'ItemList', '@id': `${canonical}#projects`, numberOfItems: agents.length, itemListOrder: 'https://schema.org/ItemListOrderDescending', itemListElement: agents.slice(0, 25).map((agent, index) => ({ '@type': 'ListItem', position: index + 1, name: agent.name, url: `${SITE_URL}/agent/${encodeURIComponent(agent.slug || agent.id)}` })) },
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'AI Agent Radar', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: `${domain.name} AI Agents`, item: canonical }
        ] }
      ]
    }).replace(/</g, '\\u003c');
    const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${escapeHtml(domain.description)} Ranked from transparent GitHub evidence."><meta name="robots" content="index, follow"><meta property="og:title" content="Best Open-Source ${escapeHtml(domain.name)} AI Agents"><meta property="og:description" content="${escapeHtml(domain.description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE_URL}/og-image.png"><link rel="canonical" href="${canonical}"><link rel="stylesheet" href="/styles.css"><link rel="icon" href="/favicon.svg"><title>Open-Source ${escapeHtml(domain.name)} AI Agents · AI Agent Radar</title><script type="application/ld+json">${schema}</script></head><body><header class="site-header"><a class="brand" href="/">AI Agent Radar</a><nav class="site-nav"><a href="/">Home</a><a href="/opportunities">Opportunities</a><a href="/patterns">Patterns</a><a href="/weekly">Weekly Radar</a><a href="/about">About</a></nav></header><main class="page-shell report-shell"><a class="back-link" href="/">← All agents</a><section class="report-hero"><span class="eyebrow">PROFESSIONAL DOMAIN REPORT</span><h1>${escapeHtml(domain.name)} <span>AI Agents</span></h1><p>${escapeHtml(domain.description)} Every project is open source and ranked from public GitHub adoption, maintenance, quality, relevance and demand evidence.</p></section><section class="weekly-brief"><span class="analysis-label">CURRENT COVERAGE</span><h2>${agents.length} curated project${agents.length === 1 ? '' : 's'}</h2><p>Coverage changes as the GitHub scanner discovers and re-evaluates projects. Rankings are discovery signals, not paid placement or hands-on product reviews.</p></section><section class="weekly-list">${agents.map(card).join('') || '<section class="workspace-empty"><h2>Coverage is developing</h2><p>No project currently clears the Radar threshold for this domain. The scanner will continue searching.</p></section>'}</section><section class="method-card report-method"><h2>Make this information actionable</h2><p>Open a project to inspect its evidence, or use Opportunity Radar to turn recurring GitHub requests into a guided validation sprint.</p><a class="button button-primary" href="/opportunities">Explore demand signals</a></section></main><footer class="site-footer"><p>AI Agent Radar · Free, independent open-source intelligence</p><nav class="footer-links"><a href="/methodology">Methodology</a><span>·</span><a href="/privacy-policy">Privacy Policy</a><span>·</span><a href="/contact">Contact</a></nav></footer></body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).send(html.replace('</head>', `<meta property="og:type" content="website"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="Open-Source ${escapeHtml(domain.name)} AI Agents"><meta name="twitter:description" content="${escapeHtml(domain.description)}"><meta name="twitter:image" content="${SITE_URL}/og-image.png"></head>`).replace('</nav></header>', '<a href="/login">Sign in</a></nav></header>'));
  } catch (error) {
    console.error('Category report failed:', { name: error?.name, message: error?.message });
    return res.status(500).send('Unable to render professional domain');
  }
};

module.exports.DOMAINS = DOMAINS;
