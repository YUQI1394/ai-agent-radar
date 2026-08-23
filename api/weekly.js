const { createClient } = require('@vercel/kv');
const { category, scoreBreakdown } = require('../lib/radar');

const SITE_URL = 'https://getaiagentradar.com';
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);
const footer = '<footer class="site-footer"><p>AI Agent Radar · Independent AI agent discovery</p><p>This site is supported by ads. We do not sell user data.</p><nav class="footer-links"><a href="/about">About</a><span>·</span><a href="/contact">Contact</a><span>·</span><a href="/privacy-policy">Privacy Policy</a><span>·</span><a href="/terms-of-service">Terms of Service</a><span>·</span><a href="/feed.xml">RSS Feed</a></nav></footer>';

function card(agent, index) {
  const slug = encodeURIComponent(agent.slug || agent.id);
  const score = agent.score || scoreBreakdown(agent);
  return `<article class="weekly-item"><div class="weekly-rank">#${index + 1}</div><div><span class="analysis-label">${escapeHtml(agent.category || category(agent))}</span><h2><a href="/agent/${slug}">${escapeHtml(agent.name)}</a></h2><p>${escapeHtml(agent.tagline || agent.description)}</p><div class="weekly-metrics"><span>Radar ${score.total}</span><span>▲ ${Number(agent.votes || 0).toLocaleString()} votes</span><span>${Number(agent.voteDelta || 0) > 0 ? `+${Number(agent.voteDelta)} since last scan` : 'Newly tracked signal'}</span></div></div></article>`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');
  try {
    const kv = createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
    const payload = await kv.get('agents:latest');
    const agents = (payload?.agents || []).map((agent) => ({ ...agent, score: agent.score || scoreBreakdown(agent) }));
    const weekAgo = Date.now() - 7 * 86400000;
    const fresh = agents.filter((agent) => new Date(agent.createdAt || agent.firstSeenAt).getTime() >= weekAgo);
    const ranked = (fresh.length >= 5 ? fresh : agents).sort((a, b) => b.score.total - a.score.total || Number(b.voteDelta || 0) - Number(a.voteDelta || 0)).slice(0, 10);
    const categories = [...new Set(ranked.map((agent) => agent.category || category(agent)))];
    const date = new Date(payload?.updatedAt || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const summary = ranked[0] ? `${ranked[0].name} leads this week's Radar signals, while ${categories.slice(0, 3).join(', ')} are the most visible categories in the current discovery set.` : 'The next Radar scan is preparing this week’s signals.';
    const canonical = `${SITE_URL}/weekly`;
    const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="An independent weekly briefing on new and trending AI agents, generated from transparent Radar signals."><meta name="robots" content="index, follow"><meta property="og:title" content="AI Agent Radar Weekly"><meta property="og:description" content="New and trending AI agents this week, ranked with transparent signals."><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE_URL}/og-image.png"><link rel="canonical" href="${canonical}"><link rel="stylesheet" href="/styles.css"><link rel="icon" href="/favicon.svg"><title>AI Agent Radar Weekly · ${escapeHtml(date)}</title></head><body><header class="site-header"><a class="brand" href="/">AI Agent Radar</a><nav class="site-nav"><a href="/">Home</a><a href="/weekly" aria-current="page">Weekly Radar</a><a href="/about">About</a><a href="/contact">Contact</a></nav></header><main class="page-shell report-shell"><section class="report-hero"><span class="eyebrow">AUTOMATED WEEKLY INTELLIGENCE</span><h1>AI Agent Radar Weekly</h1><p>Original signal analysis for ${escapeHtml(date)}. Refreshed automatically from public launch activity.</p></section><section class="weekly-brief"><span class="analysis-label">EDITORIAL SIGNAL SUMMARY</span><h2>What changed this week</h2><p>${escapeHtml(summary)}</p><small>This briefing is automatically written from freshness, relevance, community interest and observed momentum. It is independent and contains no paid rankings.</small></section><section class="weekly-list">${ranked.map(card).join('') || '<p>No weekly signals are available yet.</p>'}</section><section class="method-card report-method"><h2>How this report is produced</h2><p>The Radar refreshes every six hours, records vote and rank movement, identifies recently launched products, and publishes a repeatable weekly snapshot. Scores are discovery signals—not product quality guarantees or hands-on reviews.</p></section></main>${footer}</body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).send(html);
  } catch (error) {
    console.error('Weekly report failed:', { name: error?.name, message: error?.message });
    return res.status(500).send('Unable to render the weekly report');
  }
};
