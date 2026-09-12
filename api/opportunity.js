const { createClient } = require('@vercel/kv');
const { category, scoreBreakdown } = require('../lib/radar');
const { coachingPlan } = require('../lib/opportunity-themes');
const { sendNotFound } = require('../lib/http-pages');

const SITE_URL = 'https://getaiagentradar.com';
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);
const safeUrl = (value = '') => /^https:\/\/github\.com\//i.test(String(value)) ? escapeHtml(value) : '#';

function findOpportunity(agents, id) {
  for (const agent of agents) {
    const issue = (agent.evidenceIssues || []).find((item) => String(item.id) === id);
    if (issue) return { agent, issue };
  }
  return null;
}

function openDays(createdAt) {
  const time = Date.parse(createdAt || '');
  return Number.isFinite(time) ? Math.max(1, Math.floor((Date.now() - time) / 86400000)) : 0;
}

module.exports = async function handler(req, res) {
  if (!['GET', 'HEAD'].includes(req.method)) return res.status(405).send('Method not allowed');
  const id = String(req.query.id || '');
  if (!/^\d+$/.test(id)) return sendNotFound(res, { headline: 'Opportunity signal not found.' });
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return res.status(503).send('Opportunity storage is not configured');
  try {
    const kv = createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
    const [latest, archive] = await Promise.all([kv.get('agents:latest'), kv.get('agents:archive')]);
    const agentsById = new Map();
    [...(archive?.agents || []), ...(latest?.agents || [])].forEach((agent) => agentsById.set(String(agent.id || agent.slug || agent.name), agent));
    const match = findOpportunity([...agentsById.values()], id);
    if (!match) return sendNotFound(res, { headline: 'This opportunity signal has gone quiet.', message: 'The source Issue may have closed or left the current curated feed. Explore current evidence before starting a new validation.' });
    const { agent, issue } = match;
    const projectSlug = encodeURIComponent(agent.slug || agent.id);
    const canonical = `${SITE_URL}/opportunity/${id}`;
    const radar = Number(agent.score?.total || scoreBreakdown(agent).total);
    const age = openDays(issue.createdAt);
    const labels = (issue.labels || []).map((label) => `<span>${escapeHtml(label)}</span>`).join('');
    const coach = coachingPlan(issue);
    const questions = coach.questions.map((question) => `<li>${escapeHtml(question)}</li>`).join('');
    const nextActions = [
      'Write a one-sentence problem hypothesis for one user and one measurable consequence.',
      'Schedule five interviews and record one recent example from each affected user.',
      coach.experiment,
      'Review the evidence and choose Build, Narrow or Stop.'
    ].map((action) => escapeHtml(String(action).slice(0, 180)));
    const coachMarkup = `<section class="coach-grid" data-coaching-theme="${escapeHtml(coach.theme.slug)}"><article data-next-action="${nextActions[0]}"><span class="coach-step">01 · ${escapeHtml(coach.pattern.name)}</span><h2>Write the problem hypothesis</h2><p>${escapeHtml(coach.hypothesis)}</p><label>Done when</label><span>You can name one user, one situation and one measurable consequence without proposing a feature.</span></article><article data-next-action="${nextActions[1]}"><span class="coach-step">02 · EVIDENCE INTERVIEW</span><h2>Interview five affected users</h2><ul>${questions}</ul><label>Done when</label><span>At least three people independently describe the same painful workflow with recent examples.</span></article><article data-next-action="${nextActions[2]}"><span class="coach-step">03 · MINIMUM TEST</span><h2>Run the smallest experiment</h2><p>${escapeHtml(coach.experiment)}</p><label>Behavioral proof</label><span>${escapeHtml(coach.proof)}</span></article><article data-next-action="${nextActions[3]}"><span class="coach-step">04 · DECISION GATE</span><h2>Make a build decision</h2><ul><li><strong>Build:</strong> repeated pain and active commitment</li><li><strong>Narrow:</strong> pain is real but the audience or job differs</li><li><strong>Stop:</strong> weak frequency or no behavioral proof</li></ul><label>Rule</label><span>Do not let GitHub engagement replace direct validation.</span></article></section>`;
    const schema = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'TechArticle', '@id': `${canonical}#article`, headline: issue.title, url: canonical, mainEntityOfPage: canonical, inLanguage: 'en', datePublished: issue.createdAt || undefined, dateModified: issue.updatedAt || latest?.updatedAt, author: { '@type': 'Organization', name: 'AI Agent Radar', url: SITE_URL }, isPartOf: { '@id': `${SITE_URL}/opportunities#page` }, about: { '@type': 'SoftwareSourceCode', name: agent.name, codeRepository: agent.url } },
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'AI Agent Radar', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Opportunities', item: `${SITE_URL}/opportunities` },
          { '@type': 'ListItem', position: 3, name: issue.title, item: canonical }
        ] }
      ]
    }).replace(/</g, '\\u003c');
    const reporterEvidence = issue.excerpt ? escapeHtml(issue.excerpt) : 'This signal predates excerpt collection. Read the complete discussion for the reporter’s exact context.';
    const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="A guided validation brief for ${escapeHtml(issue.title)}—with traceable GitHub evidence, interview questions and a minimum experiment."><meta name="robots" content="index, follow"><meta property="og:title" content="${escapeHtml(issue.title)} · Opportunity Radar"><meta property="og:description" content="Turn this open-source demand signal into a focused validation sprint."><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE_URL}/og-image.png"><link rel="canonical" href="${canonical}"><link rel="stylesheet" href="/styles.css"><link rel="icon" href="/favicon.svg"><title>${escapeHtml(issue.title)} · Opportunity Radar</title><script type="application/ld+json">${schema}</script></head><body><header class="site-header"><a class="brand" href="/">AI Agent Radar</a><nav class="site-nav"><a href="/">Home</a><a href="/opportunities" aria-current="page">Opportunities</a><a href="/weekly">Weekly Radar</a><a href="/about">About</a></nav></header><main class="page-shell opportunity-detail-shell"><a class="back-link" href="/opportunities">← Back to Opportunity Radar</a><section class="opportunity-detail-hero"><span class="eyebrow">GUIDED VALIDATION BRIEF</span><h1>${escapeHtml(issue.title)}</h1><p>Evidence observed in <a href="/agent/${projectSlug}">${escapeHtml(agent.name)}</a>, a ${escapeHtml(agent.category || category(agent))} project.</p><div class="opportunity-metrics"><span>${Number(issue.comments || 0)} comments</span><span>${Number(issue.reactions || 0)} positive reactions</span><span>${age ? `${age} days open` : 'Open duration unknown'}</span><span>Project Radar ${radar}</span></div>${labels ? `<div class="opportunity-labels">${labels}</div>` : ''}<div class="opportunity-hero-actions"><a class="button button-primary" href="#validation-start">Start free validation sprint</a><span>4 guided steps · private notes · cloud sync</span></div></section><section class="evidence-source"><div><span class="analysis-label">SOURCE EVIDENCE</span><h2>Start with what users actually said</h2><p>Read the complete discussion before interpreting the problem. Note repeated use cases, workarounds, constraints and the people asking for the change.</p></div><a class="button button-secondary" href="${safeUrl(issue.url)}" target="_blank" rel="noopener noreferrer">Read original GitHub Issue ↗</a></section><section class="coach-grid"><article><span class="coach-step">01</span><h2>Write the problem hypothesis</h2><p>For <strong>[type of user]</strong>, completing <strong>[job]</strong> is difficult because <strong>[specific friction]</strong>, causing <strong>[measurable cost]</strong>.</p><label>Done when</label><span>You can describe one user, one job and one consequence without proposing a feature.</span></article><article><span class="coach-step">02</span><h2>Interview five affected users</h2><ul><li>When did this last happen?</li><li>What did you do instead?</li><li>How often does it happen?</li><li>What does the workaround cost?</li><li>What have you already tried?</li></ul><label>Done when</label><span>At least three people independently describe the same painful workflow.</span></article><article><span class="coach-step">03</span><h2>Run the smallest experiment</h2><p>Deliver the outcome manually, with a script, template or narrow integration. Measure whether users return, share data or invest meaningful time.</p><label>Done when</label><span>A user completes the real workflow—not merely says the idea sounds useful.</span></article><article><span class="coach-step">04</span><h2>Make a build decision</h2><ul><li><strong>Build:</strong> repeated pain and active commitment</li><li><strong>Narrow:</strong> pain is real but the audience differs</li><li><strong>Stop:</strong> weak frequency or no behavioral proof</li></ul><label>Rule</label><span>Do not let GitHub engagement replace direct validation.</span></article></section><section class="method-card report-method"><h2>Why this brief exists</h2><p>Information has value only when it changes action. This page turns one public signal into a bounded validation exercise. It is a research aid, not proof of demand, investment advice or a product recommendation.</p></section></main><footer class="site-footer"><p>AI Agent Radar · Free, independent open-source intelligence</p><nav class="footer-links"><a href="/opportunities">Opportunity Radar</a><span>·</span><a href="/about">About</a><span>·</span><a href="/contact">Contact</a></nav></footer></body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).send(html.replace('</head>', `<meta property="og:type" content="article"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(issue.title)} · Opportunity Radar"><meta name="twitter:description" content="Trace the GitHub evidence and run a focused four-step validation sprint."><meta name="twitter:image" content="${SITE_URL}/og-image.png"></head>`).replace('Read the complete discussion before interpreting the problem. Note repeated use cases, workarounds, constraints and the people asking for the change.', `<strong>Reporter context:</strong> ${reporterEvidence}<small>Excerpted from the public Issue. Read the complete thread before interpreting it.</small>`).replace('Read original GitHub Issue ↗</a></section>', `Read original GitHub Issue ↗</a><button class="button button-secondary" type="button" data-share-url="${canonical}" data-share-title="${escapeHtml(issue.title)} · Opportunity Radar">Share this brief</button></section>`).replace(/<section class="coach-grid">[\s\S]*?<\/section><section class="method-card/, `${coachMarkup}<section class="method-card`).replace('</nav></header>', '<a href="/login">Sign in</a></nav></header>').replace('</body>', '<script src="/share.js"></script><script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.min.js" integrity="sha384-AkNSQdptcXlJ0/NBZc4qGk86cDVXcCevwoWgEKIpHOEfbvlXGLlIkimQtONt8KNf" crossorigin="anonymous"></script><script src="/auth.js"></script><script src="/cloud-storage.js"></script><script src="/validation.js"></script></body>'));
  } catch (error) {
    console.error('Opportunity brief failed:', { name: error?.name, message: error?.message });
    return res.status(500).send('Unable to render opportunity brief');
  }
};
