const { createClient } = require('@vercel/kv');
const { category, scoreBreakdown, weeklyReport } = require('../lib/radar');

const SITE_URL = 'https://getaiagentradar.com';
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);
const footer = '<footer class="site-footer"><p>AI Agent Radar · Independent AI agent discovery</p><p>This site is supported by ads. We do not sell user data.</p><nav class="footer-links"><a href="/about">About</a><span>·</span><a href="/contact">Contact</a><span>·</span><a href="/privacy-policy">Privacy Policy</a><span>·</span><a href="/terms-of-service">Terms of Service</a><span>·</span><a href="/feed.xml">RSS Feed</a></nav></footer>';

function card(agent, index) {
  const slug = encodeURIComponent(agent.slug || agent.id);
  const score = agent.score || scoreBreakdown(agent);
  return `<article class="weekly-item"><div class="weekly-rank">#${index + 1}</div><div><span class="analysis-label">${escapeHtml(agent.category || category(agent))}</span><h2><a href="/agent/${slug}">${escapeHtml(agent.name)}</a></h2><p>${escapeHtml(agent.tagline || agent.description)}</p><div class="weekly-metrics"><span>Radar ${score.total}</span><span>▲ ${Number(agent.votes || 0).toLocaleString()} votes</span><span>${Number(agent.voteDelta || 0) > 0 ? `+${Number(agent.voteDelta)} since last scan` : 'Newly tracked signal'}</span></div></div></article>`;
}

function archiveNavigation(keys, current) {
  const links = keys.sort().reverse().slice(0, 12).map((key) => `<a href="/weekly/${key}"${key === current ? ' aria-current="page"' : ''}>${escapeHtml(key)}</a>`).join('');
  return links ? `<nav class="report-archive" aria-label="Weekly report archive"><span>Report archive</span>${links}</nav>` : '';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return res.status(503).send('Report storage is not configured');
  try {
    const kv = createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
    const [payload, storedReports] = await Promise.all([kv.get('agents:latest'), kv.get('weekly:reports')]);
    const reports = storedReports && typeof storedReports === 'object' && !Array.isArray(storedReports) ? storedReports : {};
    const liveReport = weeklyReport(payload?.agents || [], payload?.updatedAt || new Date().toISOString());
    if (!reports[liveReport.week]) reports[liveReport.week] = liveReport;
    const requested = String(req.query.date || '');
    if (!requested) {
      res.setHeader('Location', `/weekly/${liveReport.week}`);
      return res.status(308).send('Permanent Redirect');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(requested)) return res.status(404).send('Weekly report not found');
    const report = reports[requested];
    if (!report) return res.status(404).send('Weekly report not found');
    const ranked = report.agents || [];
    const date = new Date(`${requested}T00:00:00.000Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
    const canonical = `${SITE_URL}/weekly/${requested}`;
    const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="An independent weekly briefing on new and trending AI agents for ${escapeHtml(date)}."><meta name="robots" content="index, follow"><meta property="og:title" content="AI Agent Radar Weekly · ${escapeHtml(date)}"><meta property="og:description" content="New and trending AI agents this week, ranked with transparent signals."><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE_URL}/og-image.png"><link rel="canonical" href="${canonical}"><link rel="stylesheet" href="/styles.css"><link rel="icon" href="/favicon.svg"><title>AI Agent Radar Weekly · ${escapeHtml(date)}</title></head><body><header class="site-header"><a class="brand" href="/">AI Agent Radar</a><nav class="site-nav"><a href="/">Home</a><a href="/weekly" aria-current="page">Weekly Radar</a><a href="/about">About</a><a href="/contact">Contact</a></nav></header><main class="page-shell report-shell"><section class="report-hero"><span class="eyebrow">PERMANENT WEEKLY INTELLIGENCE ARCHIVE</span><h1>AI Agent Radar Weekly</h1><p>Original signal analysis for the week ending ${escapeHtml(date)}. This dated report remains available as the Radar evolves.</p></section>${archiveNavigation(Object.keys(reports), requested)}<section class="weekly-brief"><span class="analysis-label">EDITORIAL SIGNAL SUMMARY</span><h2>What changed this week</h2><p>${escapeHtml(report.summary)}</p><small>This briefing is automatically written from freshness, relevance, community interest and observed momentum. It is independent and contains no paid rankings.</small></section><section class="weekly-list">${ranked.map(card).join('') || '<p>No weekly signals are available yet.</p>'}</section><section class="method-card report-method"><h2>How this report is produced</h2><p>The Radar refreshes every six hours, records vote and rank movement, identifies recently launched products, and preserves one independently addressable report per week. Scores are discovery signals—not product quality guarantees or hands-on reviews.</p></section></main>${footer}</body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', requested === liveReport.week ? 'public, s-maxage=1800, stale-while-revalidate=3600' : 'public, s-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).send(html);
  } catch (error) {
    console.error('Weekly report failed:', { name: error?.name, message: error?.message });
    return res.status(500).send('Unable to render the weekly report');
  }
};
