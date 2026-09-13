const { createClient } = require('@vercel/kv');
const { category, peers, scoreBreakdown } = require('../lib/radar');
const { cleanIssueEvidence, evidenceStrength, opportunityPattern } = require('../lib/opportunity-themes');
const { sendNotFound } = require('../lib/http-pages');

const SITE_URL = 'https://getaiagentradar.com';
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);
const metric = (label, a, b) => `<tr><th>${label}</th><td>${escapeHtml(a)}</td><td>${escapeHtml(b)}</td></tr>`;

function demandProfile(agent) {
  const issues = cleanIssueEvidence(agent.evidenceIssues || []).sort((a, b) => evidenceStrength(b) - evidenceStrength(a));
  const counts = new Map();
  issues.forEach((issue) => {
    const name = opportunityPattern(issue).name;
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  const patterns = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return { issues, patterns, summary: patterns.slice(0, 3).map(([name, count]) => `${name} (${count})`).join(', ') || 'No qualified pattern yet' };
}

function demandPanel(agent, profile) {
  const slug = encodeURIComponent(agent.slug || agent.id);
  const list = profile.issues.filter((issue) => /^\d+$/.test(String(issue.id || ''))).slice(0, 3).map((issue) => `<li><a href="/opportunity/${encodeURIComponent(issue.id)}">${escapeHtml(issue.title)}</a><span>${Number(issue.comments || 0)} comments · ${Number(issue.reactions || 0)} reactions</span></li>`).join('');
  return `<article><span class="analysis-label">TRACEABLE GITHUB DEMAND</span><h2>${escapeHtml(agent.name)}</h2><strong>${profile.issues.length} qualified need${profile.issues.length === 1 ? '' : 's'}</strong><p>${escapeHtml(profile.summary)}</p>${list ? `<ol>${list}</ol>` : '<p>No current Issue clears the demand threshold.</p>'}<a class="button button-secondary" href="/agent/${slug}">Full project evidence</a></article>`;
}

module.exports = async function handler(req, res) {
  if (!['GET', 'HEAD'].includes(req.method)) return res.status(405).send('Method not allowed');
  try {
    const kv = createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
    const payload = await kv.get('agents:latest');
    const agents = Array.isArray(payload?.agents) ? payload.agents : [];
    const requested = String(req.query.agents || '').split(',').map((value) => String(value).trim()).filter(Boolean).slice(0, 2);
    const findCurrent = (value) => agents.find((agent) => String(agent.slug || agent.id) === String(value || ''));
    const first = requested.length ? findCurrent(requested[0]) : agents[0];
    const second = requested[1] ? findCurrent(requested[1]) : first ? peers(first, agents, 1)[0] || agents.find((agent) => agent !== first) : null;
    if (!first || !second || String(first.slug || first.id) === String(second.slug || second.id)) return sendNotFound(res, { headline: 'This comparison is no longer available.', message: 'One of these projects may have left the current curated feed. Choose two current projects from the Radar.', primaryHref: '/', primaryLabel: 'Choose current projects' });
    const a = first.score || scoreBreakdown(first);
    const b = second.score || scoreBreakdown(second);
    const demandA = demandProfile(first); const demandB = demandProfile(second);
    const winner = a.total === b.total ? 'The two products are tied on the current Radar signal.' : `${a.total > b.total ? first.name : second.name} has the stronger current discovery signal, driven by the score components shown below.`;
    const slugA = encodeURIComponent(first.slug || first.id); const slugB = encodeURIComponent(second.slug || second.id);
    const canonical = `${SITE_URL}/compare?agents=${[slugA, slugB].sort().join(',')}`;
    const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${escapeHtml(first.name)} vs ${escapeHtml(second.name)}: compare qualified GitHub needs, recurring problem patterns and transparent project signals."><meta name="robots" content="index, follow"><meta property="og:title" content="${escapeHtml(first.name)} vs ${escapeHtml(second.name)}"><meta property="og:description" content="Compare traceable GitHub demand, recurring problem patterns and transparent project signals."><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE_URL}/og-image.png"><link rel="canonical" href="${canonical}"><link rel="stylesheet" href="/styles.css"><title>${escapeHtml(first.name)} vs ${escapeHtml(second.name)} · AI Agent Radar</title></head><body><header class="site-header"><a class="brand" href="/">AI Agent Radar</a><nav class="site-nav"><a href="/">Home</a><a href="/weekly">Weekly Radar</a><a href="/about">About</a></nav></header><main class="page-shell report-shell"><a class="back-link" href="/">← Back to radar</a><section class="report-hero"><span class="eyebrow">INDEPENDENT SIDE-BY-SIDE</span><h1>${escapeHtml(first.name)} <span>vs</span> ${escapeHtml(second.name)}</h1><p>Compare current project strength and the unmet needs people are actually discussing on GitHub. No paid placement influences this comparison.</p></section><section class="comparison-verdict"><span class="analysis-label">RADAR VERDICT</span><h2>${escapeHtml(winner)}</h2><p>${escapeHtml(first.name)} is categorized as ${escapeHtml(first.category || category(first))}; ${escapeHtml(second.name)} is categorized as ${escapeHtml(second.category || category(second))}. Compare their product descriptions and source repositories before choosing.</p></section><div class="compare-table-wrap"><table class="compare-table"><thead><tr><th>Signal</th><th><a href="/agent/${slugA}">${escapeHtml(first.name)}</a></th><th><a href="/agent/${slugB}">${escapeHtml(second.name)}</a></th></tr></thead><tbody>${metric('Radar Score', `${a.total}/100`, `${b.total}/100`)}${metric('Adoption', `${a.adoption ?? a.community}/25`, `${b.adoption ?? b.community}/25`)}${metric('Maintenance', `${a.maintenance ?? a.freshness}/20`, `${b.maintenance ?? b.freshness}/20`)}${metric('Project quality', `${a.quality || 0}/20`, `${b.quality || 0}/20`)}${metric('Agent relevance', `${a.relevance}/20`, `${b.relevance}/20`)}${metric('Demand evidence', `${a.demand || 0}/10`, `${b.demand || 0}/10`)}${metric('Observed momentum', `${a.momentum}/5`, `${b.momentum}/5`)}${metric('GitHub stars', Number(first.stars ?? first.votes ?? 0).toLocaleString(), Number(second.stars ?? second.votes ?? 0).toLocaleString())}${metric('Category', first.category || category(first), second.category || category(second))}</tbody></table></div><section class="pros-limits"><div><h2>${escapeHtml(first.name)}</h2><p>${escapeHtml(first.description || first.tagline)}</p><a class="button button-secondary" href="/agent/${slugA}">Full analysis</a></div><div><h2>${escapeHtml(second.name)}</h2><p>${escapeHtml(second.description || second.tagline)}</p><a class="button button-secondary" href="/agent/${slugB}">Full analysis</a></div></section><section class="method-card report-method"><h2>Transparent scoring</h2><p>Adoption (25 points) uses stars and forks, maintenance (20) uses code activity, quality (20) checks license and metadata, relevance (20) checks agent focus, demand (10) uses open Issues, and momentum (5) uses star growth.</p></section></main><footer class="site-footer"><p>This site is supported by ads. We do not sell user data.</p><nav class="footer-links"><a href="/contact">Contact</a><span>·</span><a href="/privacy-policy">Privacy Policy</a><span>·</span><a href="/terms-of-service">Terms of Service</a></nav></footer></body></html>`;
    const enrichedHtml = html
      .replace('</tbody>', `${metric('Qualified unmet needs', demandA.issues.length, demandB.issues.length)}${metric('Leading problem patterns', demandA.summary, demandB.summary)}</tbody>`)
      .replace('<section class="pros-limits">', `<section class="comparison-demand-grid">${demandPanel(first, demandA)}${demandPanel(second, demandB)}</section><section class="pros-limits">`);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).send(enrichedHtml.replace('</nav></header>', '<a href="/login">Sign in</a></nav></header>').replace('This site is supported by ads. We do not sell user data.', 'AI Agent Radar · Free, independent open-source intelligence').replace('</body>', '<script src="/analytics.js"></script></body>'));
  } catch (error) {
    console.error('Comparison failed:', { name: error?.name, message: error?.message });
    return res.status(500).send('Unable to render comparison');
  }
};
