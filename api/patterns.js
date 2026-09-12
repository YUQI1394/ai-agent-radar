const { createClient } = require('@vercel/kv');
const { cleanIssueEvidence, coachingPlan, evidenceEngagement, evidenceStrength, opportunityPattern } = require('../lib/opportunity-themes');

const SITE_URL = 'https://getaiagentradar.com';
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);

function patternCard(pattern, index) {
  const repositoryCount = pattern.repositories.size;
  const status = repositoryCount >= 3 ? 'Recurring pattern' : repositoryCount === 2 ? 'Cross-project signal' : 'Emerging signal';
  const lead = pattern.issues[0];
  const plan = coachingPlan(lead.issue);
  const issues = pattern.issues.slice(0, 3).map(({ issue, agent }) => `<li><a href="/opportunity/${encodeURIComponent(issue.id)}">${escapeHtml(issue.title)}</a><span>${escapeHtml(agent.name)} · ${Number(issue.comments || 0)} comments</span></li>`).join('');
  return `<article class="pattern-card"><div class="pattern-rank">#${index + 1}</div><div><div class="pattern-heading"><span class="analysis-label">${status}</span><strong>${pattern.score} evidence points</strong></div><h2>${escapeHtml(pattern.name)}</h2><p>${repositoryCount === 1 ? 'One qualified repository currently shows this need. Treat it as an interview lead, not a trend.' : `${repositoryCount} independent repositories show related friction, increasing confidence that this is broader than one project.`}</p><div class="pattern-metrics"><span>${pattern.issues.length} Issues</span><span>${repositoryCount} repositories</span><span>${pattern.comments} comments</span><span>${pattern.reactions} positive reactions</span></div><div class="pattern-next"><span>RECOMMENDED FIRST TEST</span><p>${escapeHtml(plan.experiment)}</p><a href="/opportunity/${encodeURIComponent(lead.issue.id)}#validation-start">Start with the strongest signal →</a></div><ul class="pattern-evidence">${issues}</ul><a class="pattern-link" href="/opportunities?pattern=${encodeURIComponent(pattern.name)}">Explore all evidence →</a></div></article>`;
}

module.exports = async function handler(req, res) {
  if (!['GET', 'HEAD'].includes(req.method)) return res.status(405).send('Method not allowed');
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return res.status(503).send('Pattern storage is not configured');
  try {
    const kv = createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
    const [latest, archive] = await Promise.all([kv.get('agents:latest'), kv.get('agents:archive')]);
    const agentsById = new Map();
    [...(archive?.agents || []), ...(latest?.agents || [])].forEach((agent) => {
      if (agent.status === 'archived') return;
      agentsById.set(String(agent.id || agent.slug || agent.name), agent);
    });
    const groups = new Map();
    const seen = new Set();
    agentsById.forEach((agent) => cleanIssueEvidence(agent.evidenceIssues || []).forEach((issue) => {
      const key = String(issue.id || issue.url);
      if (!key || seen.has(key)) return;
      seen.add(key);
      const classification = opportunityPattern(issue);
      if (!groups.has(classification.name)) groups.set(classification.name, { ...classification, issues: [], repositories: new Set(), comments: 0, reactions: 0, score: 0 });
      const group = groups.get(classification.name);
      group.issues.push({ issue, agent });
      group.repositories.add(String(agent.name).toLowerCase());
      group.comments += Number(issue.comments || 0);
      group.reactions += Number(issue.reactions || 0);
    }));
    const patterns = [...groups.values()].filter((group) => group.issues.length).map((group) => {
      const engagement = group.issues.reduce((sum, item) => sum + evidenceEngagement(item.issue), 0);
      group.score = group.repositories.size * 24 + group.issues.length * 6 + Math.min(30, Math.round(engagement * 0.5));
      group.issues.sort((a, b) => evidenceStrength(b.issue) - evidenceStrength(a.issue));
      return group;
    }).sort((a, b) => b.score - a.score);
    const recurring = patterns.filter((pattern) => pattern.repositories.size >= 2).length;
    const canonical = `${SITE_URL}/patterns`;
    const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Recurring product-demand patterns synthesized from traceable GitHub Issues across open-source AI agent projects."><meta name="robots" content="index, follow"><meta property="og:title" content="Pattern Radar · AI Agent Radar"><meta property="og:description" content="See which AI agent problems repeat across independent open-source projects."><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE_URL}/og-image.png"><link rel="canonical" href="${canonical}"><link rel="stylesheet" href="/styles.css"><link rel="icon" href="/favicon.svg"><title>Pattern Radar · AI Agent Radar</title></head><body><header class="site-header"><a class="brand" href="/">AI Agent Radar</a><nav class="site-nav"><a href="/">Home</a><a href="/opportunities">Opportunities</a><a href="/patterns" aria-current="page">Patterns</a><a href="/workspace">Workspace</a><a href="/weekly">Weekly Radar</a><a href="/about">About</a></nav></header><main class="page-shell report-shell"><section class="report-hero"><span class="eyebrow">CROSS-REPOSITORY PROBLEM INTELLIGENCE</span><h1>Pattern <span>Radar</span></h1><p>We group qualified Issues into narrow workflow problems—not just broad categories. Signals found across independent repositories carry more weight than isolated feature requests.</p></section><section class="pattern-summary"><div><strong>${patterns.length}</strong><span>Specific problems</span></div><div><strong>${recurring}</strong><span>Cross-project patterns</span></div><div><strong>${seen.size}</strong><span>Traceable Issues</span></div></section><section class="pattern-disclaimer"><strong>Repetition increases confidence, not certainty.</strong><p>Even cross-project evidence still requires direct user interviews and behavioral validation before building.</p></section><section class="pattern-list">${patterns.map(patternCard).join('') || '<div class="empty-state"><h2>No patterns yet</h2><p>Patterns will emerge as the Issue scan covers more repositories.</p></div>'}</section><section class="method-card report-method"><h2>Pattern confidence</h2><p>Issues are classified into specific problems such as failure recovery, provider interoperability and human approval. “Emerging” means one repository, “Cross-project” means two, and “Recurring” means three or more. Repository repetition carries the most weight; per-thread engagement uses capped, diminishing returns.</p></section></main><footer class="site-footer"><p>AI Agent Radar · Free, independent open-source intelligence</p><nav class="footer-links"><a href="/opportunities">Opportunities</a><span>·</span><a href="/workspace">Workspace</a><span>·</span><a href="/about">About</a></nav></footer></body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).send(html.replace('</nav></header>', '<a href="/login">Sign in</a></nav></header>'));
  } catch (error) {
    console.error('Pattern radar failed:', { name: error?.name, message: error?.message });
    return res.status(500).send('Unable to render Pattern Radar');
  }
};
