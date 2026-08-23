const { createClient } = require('@vercel/kv');
const { scoreBreakdown } = require('../lib/radar');

const SITE_URL = 'https://getaiagentradar.com';

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

const normalizeTerms = (agent) => [...(agent.topics || []), ...(agent.topicSlugs || [])].map((value) => String(value).toLowerCase());

function profileFor(agent) {
  const text = `${agent.name || ''} ${agent.tagline || ''} ${agent.description || ''} ${normalizeTerms(agent).join(' ')}`.toLowerCase();
  const profiles = [
    { test: /developer|coding|code|software|api|github|devops/, audience: 'Developers, engineering teams and technical founders', use: 'speeding up software delivery, testing, debugging or infrastructure workflows', lens: 'developer tooling' },
    { test: /marketing|advertis|social media|growth|sales/, audience: 'Growth teams, marketers, creators and startup operators', use: 'planning campaigns, producing creative assets and improving marketing execution', lens: 'marketing automation' },
    { test: /design|creative|image|video|ui|ux/, audience: 'Designers, creative teams and content producers', use: 'turning briefs into visual concepts and accelerating creative production', lens: 'creative automation' },
    { test: /meeting|calendar|notes|productivity|workflow|task/, audience: 'Founders, knowledge workers and operations teams', use: 'reducing repetitive coordination, documentation and daily administrative work', lens: 'productivity automation' },
    { test: /voice|audio|call|speech/, audience: 'Teams building voice experiences, support automation or conversational products', use: 'building, monitoring or improving voice-driven agent experiences', lens: 'voice agents' }
  ];
  return profiles.find((profile) => profile.test.test(text)) || {
    audience: 'AI early adopters, builders and teams evaluating new agent workflows',
    use: 'exploring agent-assisted workflows and automating repeatable knowledge work',
    lens: 'general AI agents'
  };
}

function featureList(agent) {
  const source = String(agent.description || agent.tagline || '').replace(/\s+/g, ' ').trim();
  const sentences = source.match(/[^.!?]+[.!?]?/g) || [];
  const features = sentences.map((sentence) => sentence.trim()).filter((sentence) => sentence.length >= 25).slice(0, 3);
  if (features.length < 2 && agent.tagline) features.unshift(String(agent.tagline).trim());
  return [...new Set(features)].slice(0, 3);
}

function similarAgents(agent, agents) {
  const topics = new Set(normalizeTerms(agent));
  return agents.filter((candidate) => String(candidate.id || candidate.slug) !== String(agent.id || agent.slug)).map((candidate) => {
    const shared = normalizeTerms(candidate).filter((topic) => topics.has(topic)).length;
    const keywordBonus = profileFor(candidate).lens === profileFor(agent).lens ? 2 : 0;
    return { ...candidate, similarity: shared * 3 + keywordBonus };
  }).filter((candidate) => candidate.similarity > 0).sort((a, b) => b.similarity - a.similarity || Number(b.votes || 0) - Number(a.votes || 0)).slice(0, 3);
}

function automaticAnalysis(agent, agents) {
  const profile = profileFor(agent);
  const features = featureList(agent);
  const peers = similarAgents(agent, agents);
  const ordered = [...agents].sort((a, b) => Number(b.votes || 0) - Number(a.votes || 0));
  const rank = Math.max(1, ordered.findIndex((item) => String(item.id || item.slug) === String(agent.id || agent.slug)) + 1);
  const published = new Date(agent.createdAt).getTime();
  const ageDays = Number.isFinite(published) ? Math.max(0, Math.floor((Date.now() - published) / 86400000)) : null;
  const momentum = rank <= Math.max(3, Math.ceil(agents.length * 0.2)) ? 'one of the stronger community signals in the current Radar feed' : 'an emerging signal worth tracking as the category develops';
  return { profile, features, peers, rank, ageDays, momentum };
}

function renderPage(agent, agents) {
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
  const analysis = automaticAnalysis(agent, agents);
  const score = agent.score || scoreBreakdown(agent);
  const primaryPeer = analysis.peers[0];
  const featureItems = analysis.features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join('');
  const comparisonItems = analysis.peers.map((peer) => `<li><a href="/agent/${encodeURIComponent(peer.slug || peer.id)}">${escapeHtml(peer.name)}</a><span>${escapeHtml(profileFor(peer).lens)} · ▲ ${Number(peer.votes || 0).toLocaleString()}</span></li>`).join('');
  const limitations = [
    'The listing is based on public launch information rather than a hands-on product review.',
    'Features, pricing and availability may change; verify important details with the provider.',
    analysis.peers.length ? `Compare it with ${analysis.peers.length} related Radar listings before choosing a workflow.` : 'The current feed has limited directly comparable listings.'
  ];

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
  <meta property="og:image" content="${safeUrl(agent.thumbnail || `${SITE_URL}/og-image.png`)}">
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
      <div class="detail-stats"><div><strong>${score.total}/100</strong><span>Transparent Radar Score</span></div><div><strong>▲ ${Number(agent.votes || 0).toLocaleString()}</strong><span>Product Hunt votes${Number(agent.voteDelta || 0) > 0 ? ` · +${Number(agent.voteDelta)} last scan` : ''}</span></div><div><strong>${escapeHtml(agent.createdAt ? new Date(agent.createdAt).toLocaleDateString('en-US') : '—')}</strong><span>Published</span></div></div>
      <div class="topics detail-topics">${topics || '<span class="topic">AI Agent</span>'}</div>
      <section class="description"><h2>What does ${escapeHtml(agent.name)} do?</h2><p>${escapeHtml(agent.description || agent.tagline)}</p></section>
      <section class="score-breakdown"><div><span>Community</span><strong>${score.community}/45</strong></div><div><span>Freshness</span><strong>${score.freshness}/25</strong></div><div><span>Agent relevance</span><strong>${score.relevance}/20</strong></div><div><span>Momentum</span><strong>${score.momentum}/10</strong></div><p>Community uses a logarithmic public-vote signal; freshness uses launch age; relevance uses listing metadata; momentum uses vote and rank movement between six-hour scans.</p></section>
      <section class="analysis-grid" aria-label="Automated Radar analysis">
        <div class="analysis-panel"><span class="analysis-label">EDITOR'S RADAR TAKE</span><h2>Editorial take</h2><p>${escapeHtml(agent.name)} stands out in ${escapeHtml(analysis.profile.lens)} because its launch connects a focused product promise with measurable community attention. It is most useful to evaluate as a workflow tool—not as a replacement for human judgment.</p></div>
        <div class="analysis-panel"><span class="analysis-label">WHO IT IS FOR</span><h2>Best suited for</h2><p>${escapeHtml(analysis.profile.audience)}.</p></div>
      </section>
      <section class="radar-context"><h2>Main capabilities</h2><ul>${featureItems || `<li>${escapeHtml(agent.tagline || 'AI-assisted workflow automation.')}</li>`}</ul></section>
      <section class="radar-context"><h2>Practical use cases</h2><p>${escapeHtml(agent.name)} may be useful for ${escapeHtml(analysis.profile.use)}. The strongest fit depends on how well it integrates with a team’s existing tools, data and review process.</p></section>
      <section class="pros-limits"><div><h2>Potential advantages</h2><ul><li>Focused on ${escapeHtml(analysis.profile.lens)}.</li><li>Shows ▲ ${Number(agent.votes || 0).toLocaleString()} votes of public launch interest.</li><li>Offers a concrete workflow to evaluate instead of a general-purpose AI claim.</li></ul></div><div><h2>Limits to consider</h2><ul>${limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div></section>
      <section class="radar-context"><h2>Similar agents to compare</h2>${comparisonItems ? `<ul class="comparison-list">${comparisonItems}</ul>` : '<p>No close comparison is currently available in this Radar update.</p>'}</section>
      <section class="trend-observation"><span class="analysis-label">INDEPENDENT TREND OBSERVATION</span><h2>What the signal suggests</h2><p>${escapeHtml(agent.name)} ranks #${analysis.rank} by Product Hunt votes among ${agents.length} agents in this update and is ${escapeHtml(analysis.momentum)}.${analysis.ageDays === null ? '' : ` It launched about ${analysis.ageDays} day${analysis.ageDays === 1 ? '' : 's'} ago, so its signal should be read alongside launch freshness.`}</p><small>Automatically generated from public listing metadata, feed position and community activity. It is not a paid placement, endorsement or hands-on review.</small></section>
      <div class="detail-actions"><a class="button button-primary detail-visit" href="${safeUrl(agent.url)}" target="_blank" rel="noopener noreferrer">Visit official listing ↗</a>${primaryPeer ? `<a class="button button-secondary detail-visit" href="/compare?agents=${slug},${encodeURIComponent(primaryPeer.slug || primaryPeer.id)}">Compare with ${escapeHtml(primaryPeer.name)}</a>` : ''}</div>
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
    return res.status(200).send(renderPage(agent, payload?.agents || []));
  } catch (error) {
    console.error('Agent page render failed:', { name: error?.name, message: error?.message });
    return res.status(500).send('Unable to render agent page');
  }
};
