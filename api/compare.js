const { createClient } = require('@vercel/kv');
const { category, peers, scoreBreakdown } = require('../lib/radar');

const SITE_URL = 'https://getaiagentradar.com';
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);
const metric = (label, a, b) => `<tr><th>${label}</th><td>${escapeHtml(a)}</td><td>${escapeHtml(b)}</td></tr>`;

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');
  try {
    const kv = createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
    const payload = await kv.get('agents:latest');
    const agents = payload?.agents || [];
    const requested = String(req.query.agents || '').split(',').map(decodeURIComponent).filter(Boolean);
    let first = agents.find((agent) => requested.includes(String(agent.slug || agent.id))) || agents[0];
    let second = agents.find((agent) => String(agent.slug || agent.id) === requested[1]);
    if (!second && first) second = peers(first, agents, 1)[0] || agents.find((agent) => agent !== first);
    if (!first || !second) return res.status(404).send('Not enough agents to compare');
    const a = first.score || scoreBreakdown(first);
    const b = second.score || scoreBreakdown(second);
    const winner = a.total === b.total ? 'The two products are tied on the current Radar signal.' : `${a.total > b.total ? first.name : second.name} has the stronger current discovery signal, driven by the score components shown below.`;
    const slugA = encodeURIComponent(first.slug || first.id); const slugB = encodeURIComponent(second.slug || second.id);
    const canonical = `${SITE_URL}/compare?agents=${slugA},${slugB}`;
    const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${escapeHtml(first.name)} vs ${escapeHtml(second.name)}: transparent AI agent comparison."><meta name="robots" content="index, follow"><meta property="og:title" content="${escapeHtml(first.name)} vs ${escapeHtml(second.name)}"><meta property="og:description" content="Transparent AI agent comparison based on freshness, relevance, community interest and momentum."><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE_URL}/og-image.png"><link rel="canonical" href="${canonical}"><link rel="stylesheet" href="/styles.css"><title>${escapeHtml(first.name)} vs ${escapeHtml(second.name)} · AI Agent Radar</title></head><body><header class="site-header"><a class="brand" href="/">AI Agent Radar</a><nav class="site-nav"><a href="/">Home</a><a href="/weekly">Weekly Radar</a><a href="/about">About</a></nav></header><main class="page-shell report-shell"><a class="back-link" href="/">← Back to radar</a><section class="report-hero"><span class="eyebrow">INDEPENDENT SIDE-BY-SIDE</span><h1>${escapeHtml(first.name)} <span>vs</span> ${escapeHtml(second.name)}</h1><p>Based on the latest public launch data. No paid placement influences this comparison.</p></section><section class="comparison-verdict"><span class="analysis-label">RADAR VERDICT</span><h2>${escapeHtml(winner)}</h2><p>${escapeHtml(first.name)} is categorized as ${escapeHtml(first.category || category(first))}; ${escapeHtml(second.name)} is categorized as ${escapeHtml(second.category || category(second))}. Compare their product descriptions and official listings before choosing.</p></section><div class="compare-table-wrap"><table class="compare-table"><thead><tr><th>Signal</th><th><a href="/agent/${slugA}">${escapeHtml(first.name)}</a></th><th><a href="/agent/${slugB}">${escapeHtml(second.name)}</a></th></tr></thead><tbody>${metric('Radar Score', `${a.total}/100`, `${b.total}/100`)}${metric('Community', `${a.community}/45`, `${b.community}/45`)}${metric('Freshness', `${a.freshness}/25`, `${b.freshness}/25`)}${metric('Agent relevance', `${a.relevance}/20`, `${b.relevance}/20`)}${metric('Observed momentum', `${a.momentum}/10`, `${b.momentum}/10`)}${metric('Product Hunt votes', Number(first.votes || 0).toLocaleString(), Number(second.votes || 0).toLocaleString())}${metric('Category', first.category || category(first), second.category || category(second))}</tbody></table></div><section class="pros-limits"><div><h2>${escapeHtml(first.name)}</h2><p>${escapeHtml(first.description || first.tagline)}</p><a class="button button-secondary" href="/agent/${slugA}">Full analysis</a></div><div><h2>${escapeHtml(second.name)}</h2><p>${escapeHtml(second.description || second.tagline)}</p><a class="button button-secondary" href="/agent/${slugB}">Full analysis</a></div></section><section class="method-card report-method"><h2>Transparent scoring</h2><p>Community (45 points) uses a logarithmic vote signal, freshness (25) uses launch age, relevance (20) checks agent-oriented metadata, and momentum (10) uses vote and rank movement between six-hour scans.</p></section></main><footer class="site-footer"><p>This site is supported by ads. We do not sell user data.</p><nav class="footer-links"><a href="/contact">Contact</a><span>·</span><a href="/privacy-policy">Privacy Policy</a><span>·</span><a href="/terms-of-service">Terms of Service</a></nav></footer></body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).send(html);
  } catch (error) {
    console.error('Comparison failed:', { name: error?.name, message: error?.message });
    return res.status(500).send('Unable to render comparison');
  }
};
