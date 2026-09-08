const { createClient } = require('@vercel/kv');
const { category, scoreBreakdown } = require('../lib/radar');
const { cleanIssueEvidence, opportunityTheme } = require('../lib/opportunity-themes');

const SITE_URL = 'https://getaiagentradar.com';
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);
const safeUrl = (value = '') => /^https:\/\/github\.com\//i.test(String(value)) ? escapeHtml(value) : '#';
function openDays(createdAt) {
  const time = Date.parse(createdAt || '');
  return Number.isFinite(time) ? Math.max(1, Math.floor((Date.now() - time) / 86400000)) : 0;
}

function evidenceScore(issue, agent) {
  const engagement = Math.log2(Number(issue.comments || 0) * 2 + Number(issue.reactions || 0) * 3 + 1) * 14;
  const persistence = Math.min(24, Math.log2(openDays(issue.createdAt) + 1) * 3);
  const project = Number(agent.score?.total || scoreBreakdown(agent).total) * 0.22;
  return Math.min(100, Math.round(engagement + persistence + project));
}

function opportunityCard(item, index) {
  const issue = item.issue;
  const agent = item.agent;
  const slug = encodeURIComponent(agent.slug || agent.id);
  const labels = `${item.isNew ? '<span class="new-signal">NEW SIGNAL</span>' : ''}${(issue.labels || []).slice(0, 4).map((label) => `<span>${escapeHtml(label)}</span>`).join('')}`;
  const age = openDays(issue.createdAt);
  return `<article class="opportunity-card"><div class="opportunity-rank">#${index + 1}</div><div class="opportunity-content"><div class="opportunity-kicker"><span class="analysis-label">${escapeHtml(item.theme)} · ${escapeHtml(agent.category || category(agent))}</span><strong>Evidence ${item.score}/100</strong></div><h2><a href="/opportunity/${encodeURIComponent(issue.id)}">${escapeHtml(issue.title)}</a></h2><p class="opportunity-project">Observed in <a href="/agent/${slug}">${escapeHtml(agent.name)}</a> · ${escapeHtml(agent.language || 'Unknown')} · ${escapeHtml(agent.license || 'License not declared')}</p><div class="opportunity-metrics"><span>${Number(issue.comments || 0)} comments</span><span>${Number(issue.reactions || 0)} positive reactions</span><span>${age ? `${age} days open` : 'Open duration unknown'}</span><span>Project Radar ${Number(agent.score?.total || scoreBreakdown(agent).total)}</span></div>${labels ? `<div class="opportunity-labels">${labels}</div>` : ''}<div class="opportunity-actions"><a href="/opportunity/${encodeURIComponent(issue.id)}#validation-start">Start guided sprint →</a><a href="${safeUrl(issue.url)}" target="_blank" rel="noopener noreferrer">Original GitHub Issue ↗</a><a href="/agent/${slug}">Project analysis →</a></div></div></article>`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return res.status(503).send('Opportunity storage is not configured');
  try {
    const kv = createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
    const [latest, archive] = await Promise.all([kv.get('agents:latest'), kv.get('agents:archive')]);
    const agentsById = new Map();
    [...(archive?.agents || []), ...(latest?.agents || [])].forEach((agent) => agentsById.set(String(agent.id || agent.slug || agent.name), agent));
    const seen = new Set();
    const opportunities = [];
    agentsById.forEach((agent) => cleanIssueEvidence(agent.evidenceIssues || []).forEach((issue) => {
      const key = String(issue.id || issue.url);
      if (!key || seen.has(key)) return;
      seen.add(key);
      const firstSeen = Date.parse(issue.firstSeenAt || '');
      const isNew = Number.isFinite(firstSeen) && Date.now() - firstSeen <= 48 * 60 * 60 * 1000;
      opportunities.push({ issue, agent, theme: opportunityTheme(issue).name, score: evidenceScore(issue, agent), isNew });
    }));
    opportunities.sort((a, b) => b.score - a.score || Number(b.issue.comments || 0) - Number(a.issue.comments || 0));
    const themeCounts = opportunities.reduce((counts, item) => counts.set(item.theme, (counts.get(item.theme) || 0) + 1), new Map());
    const requestedTheme = String(req.query.theme || 'All');
    const activeTheme = requestedTheme === 'All' || themeCounts.has(requestedTheme) ? requestedTheme : 'All';
    const newOnly = String(req.query.view || '') === 'new';
    const newCount = opportunities.filter((item) => item.isNew).length;
    const filtered = opportunities.filter((item) => (!newOnly || item.isNew) && (activeTheme === 'All' || item.theme === activeTheme));
    const themeLinks = [`<a href="/opportunities"${activeTheme === 'All' && !newOnly ? ' aria-current="page"' : ''}>All <span>${opportunities.length}</span></a>`, `<a href="/opportunities?view=new"${newOnly ? ' aria-current="page"' : ''}>New in 48h <span>${newCount}</span></a>`, ...[...themeCounts.entries()].sort((a, b) => b[1] - a[1]).map(([theme, count]) => `<a href="/opportunities?theme=${encodeURIComponent(theme)}"${!newOnly && activeTheme === theme ? ' aria-current="page"' : ''}>${escapeHtml(theme)} <span>${count}</span></a>`)].join('');
    const updatedAt = latest?.updatedAt || new Date().toISOString();
    const canonical = `${SITE_URL}/opportunities`;
    const schema = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'CollectionPage', '@id': `${canonical}#page`, name: 'Open-Source AI Agent Opportunity Radar', description: 'Traceable unmet needs discovered in public GitHub Issues.', url: canonical, dateModified: updatedAt, mainEntity: { '@id': `${canonical}#signals` } },
        { '@type': 'ItemList', '@id': `${canonical}#signals`, numberOfItems: opportunities.length, itemListOrder: 'https://schema.org/ItemListOrderDescending', itemListElement: opportunities.slice(0, 25).map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.issue.title, url: `${SITE_URL}/opportunity/${encodeURIComponent(item.issue.id)}` })) }
      ]
    }).replace(/</g, '\\u003c');
    const cards = filtered.map(opportunityCard).join('');
    const coverageAgents = Array.isArray(latest?.agents) ? latest.agents : [];
    const coveredRepositories = coverageAgents.filter((agent) => agent.issueScannedAt).length;
    const coverageMarkup = `<section class="coverage-status"><div><span class="analysis-label">ISSUE SCAN COVERAGE</span><strong>${coveredRepositories} / ${coverageAgents.length || 0} repositories · ${newCount} new</strong></div><p>“New” means first detected by the Radar within 48 hours. Issue evidence is collected on a rotating six-hour schedule, and a repository can be fully scanned even when no qualifying signal is found.</p></section>`;
    const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Traceable product opportunities discovered in high-engagement GitHub Issues across open-source AI agent projects."><meta name="robots" content="index, follow"><meta property="og:title" content="Opportunity Radar · AI Agent Radar"><meta property="og:description" content="Explore unresolved needs and feature requests found in open-source AI agent projects."><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE_URL}/og-image.png"><link rel="canonical" href="${canonical}"><link rel="stylesheet" href="/styles.css"><link rel="icon" href="/favicon.svg"><title>Opportunity Radar · AI Agent Radar</title></head><body><header class="site-header"><a class="brand" href="/">AI Agent Radar</a><nav class="site-nav"><a href="/">Home</a><a href="/opportunities" aria-current="page">Opportunities</a><a href="/weekly">Weekly Radar</a><a href="/about">About</a><a href="/contact">Contact</a></nav></header><main class="page-shell report-shell"><section class="report-hero"><span class="eyebrow">TRACEABLE OPEN-SOURCE DEMAND SIGNALS</span><h1>Opportunity <span>Radar</span></h1><p>We scan public GitHub Issues for recurring requests, workflow friction and missing capabilities—then rank the strongest signals without hiding the original evidence.</p><p class="opportunity-updated">${opportunities.length} signals · Last data refresh ${escapeHtml(new Date(updatedAt).toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' }))} UTC</p></section><section class="opportunity-disclaimer"><strong>Evidence signal, not proof of market demand.</strong><p>A popular Issue can reveal real friction, but it does not prove willingness to pay. Use these leads for interviews, validation and product discovery.</p></section><nav class="opportunity-themes" aria-label="Filter opportunities by problem theme">${themeLinks}</nav><section class="validation-playbook"><div><span class="analysis-label">FROM SIGNAL TO ACTION</span><h2>A 3-step validation sprint</h2><p>Use the evidence as a starting point, then verify the problem before building.</p></div><ol><li><strong>1. Read the thread</strong><span>Identify who has the problem and the workaround they use today.</span></li><li><strong>2. Contact five users</strong><span>Ask about frequency, cost and what they already tried.</span></li><li><strong>3. Test one narrow fix</strong><span>Offer a manual or lightweight solution before writing a full product.</span></li></ol></section><div class="opportunity-result"><strong>${filtered.length}</strong> ${activeTheme === 'All' ? 'qualified signals' : `${escapeHtml(activeTheme)} signals`}</div><section class="opportunity-list">${cards || '<div class="empty-state"><h2>No qualified opportunities yet</h2><p>The Radar will add signals as repository Issue rotations complete.</p></div>'}</section><section class="method-card report-method"><h2>How opportunities are ranked</h2><p>The evidence score combines Issue comments, positive reactions, unresolved duration and the underlying project’s Radar Score. Maintenance-only tickets, dependency dashboards, CI failures and release checklists are filtered out. Rankings are independent and never paid placements.</p></section></main><footer class="site-footer"><p>AI Agent Radar · Independent open-source intelligence</p><p>Every listing and opportunity remains free to explore.</p><nav class="footer-links"><a href="/about">About</a><span>·</span><a href="/contact">Contact</a><span>·</span><a href="/privacy-policy">Privacy Policy</a><span>·</span><a href="/terms-of-service">Terms of Service</a><span>·</span><a href="/feed.xml">RSS Feed</a></nav></footer></body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).send(html.replace('</head>', `<meta property="og:type" content="website"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="Opportunity Radar · AI Agent Radar"><meta name="twitter:description" content="Trace open-source demand signals back to GitHub, then run a focused validation sprint."><meta name="twitter:image" content="${SITE_URL}/og-image.png"><script type="application/ld+json">${schema}</script></head>`).replace('</section><section class="opportunity-disclaimer">', `</section>${coverageMarkup}<section class="opportunity-disclaimer">`).replace('<a href="/weekly">Weekly Radar</a>', '<a href="/patterns">Patterns</a><a href="/workspace">Workspace</a><a href="/weekly">Weekly Radar</a>').replace('</nav></header>', '<a href="/login">Sign in</a></nav></header>'));
  } catch (error) {
    console.error('Opportunity radar failed:', { name: error?.name, message: error?.message });
    return res.status(500).send('Unable to render Opportunity Radar');
  }
};
