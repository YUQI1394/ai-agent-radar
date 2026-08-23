const CATEGORIES = [
  { name: 'Coding', pattern: /coding|code|developer|programming|software|github|api|devops/ },
  { name: 'Marketing', pattern: /marketing|advertis|growth|sales|social.?media|campaign/ },
  { name: 'Design', pattern: /design|creative|graphics|ui|ux|image|video/ },
  { name: 'Productivity', pattern: /productivity|workflow|automation|task|calendar|meeting|collaboration/ }
];

function terms(agent) {
  return [...(agent.topics || []), ...(agent.topicSlugs || [])].map((value) => String(value).toLowerCase());
}

function category(agent) {
  const text = `${agent.name || ''} ${agent.tagline || ''} ${agent.description || ''} ${terms(agent).join(' ')}`.toLowerCase();
  return CATEGORIES.find((item) => item.pattern.test(text))?.name || 'General AI';
}

function scoreBreakdown(agent, now = Date.now()) {
  const votes = Math.max(0, Number(agent.votes || 0));
  const created = new Date(agent.createdAt).getTime();
  const hours = Number.isFinite(created) ? Math.max(0, (now - created) / 3600000) : Infinity;
  const community = Math.min(45, Math.round(Math.log10(votes + 1) * 15));
  const freshness = hours <= 24 ? 25 : hours <= 72 ? 22 : hours <= 168 ? 18 : hours <= 720 ? 11 : 5;
  const relevanceText = `${agent.name || ''} ${agent.tagline || ''} ${agent.description || ''} ${terms(agent).join(' ')}`;
  const relevance = /agent|autonomous|multi.?agent/i.test(relevanceText) ? 20 : /copilot|assistant|workflow|automation|mcp/i.test(relevanceText) ? 16 : 10;
  const momentum = Math.min(10, Math.max(0, Math.round(Number(agent.voteDelta || 0) / 2) + Math.max(0, Number(agent.rankChange || 0))));
  return { community, freshness, relevance, momentum, total: Math.min(100, community + freshness + relevance + momentum) };
}

function similarity(a, b) {
  const aTerms = new Set(terms(a));
  const shared = terms(b).filter((term) => aTerms.has(term)).length;
  return shared * 4 + (category(a) === category(b) ? 3 : 0);
}

function peers(agent, agents, limit = 3) {
  const key = String(agent.id || agent.slug);
  return agents.filter((item) => String(item.id || item.slug) !== key)
    .map((item) => ({ ...item, similarity: similarity(agent, item) }))
    .filter((item) => item.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity || scoreBreakdown(b).total - scoreBreakdown(a).total)
    .slice(0, limit);
}

function enrichAgents(agents, previousAgents = [], now = Date.now()) {
  const previousById = new Map(previousAgents.map((agent, index) => [String(agent.id || agent.slug), { agent, rank: index + 1 }]));
  return agents.map((agent, index) => {
    const previous = previousById.get(String(agent.id || agent.slug));
    const enriched = {
      ...agent,
      voteDelta: previous ? Math.max(0, Number(agent.votes || 0) - Number(previous.agent.votes || 0)) : 0,
      rankChange: previous ? previous.rank - (index + 1) : 0,
      firstSeenAt: previous?.agent.firstSeenAt || new Date(now).toISOString()
    };
    enriched.category = category(enriched);
    enriched.score = scoreBreakdown(enriched, now);
    return enriched;
  });
}

function weekKey(value = Date.now()) {
  const date = new Date(value);
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysToSunday = (7 - utc.getUTCDay()) % 7;
  utc.setUTCDate(utc.getUTCDate() + daysToSunday);
  return utc.toISOString().slice(0, 10);
}

function mergeArchive(existingAgents = [], currentAgents = [], updatedAt = new Date().toISOString()) {
  const currentKeys = new Set(currentAgents.map((agent) => String(agent.id || agent.slug)));
  const archive = new Map(existingAgents.map((agent) => [String(agent.id || agent.slug), { ...agent, status: 'archived' }]));
  currentAgents.forEach((agent) => {
    const key = String(agent.id || agent.slug);
    const existing = archive.get(key);
    archive.set(key, {
      ...existing,
      ...agent,
      firstSeenAt: existing?.firstSeenAt || agent.firstSeenAt || updatedAt,
      lastSeenAt: updatedAt,
      status: 'current'
    });
  });
  return [...archive.values()].map((agent) => currentKeys.has(String(agent.id || agent.slug)) ? agent : { ...agent, status: 'archived' });
}

function weeklyReport(agents = [], updatedAt = new Date().toISOString()) {
  const scored = agents.map((agent) => ({ ...agent, category: agent.category || category(agent), score: agent.score || scoreBreakdown(agent) }));
  const weekAgo = new Date(updatedAt).getTime() - 7 * 86400000;
  const fresh = scored.filter((agent) => new Date(agent.createdAt || agent.firstSeenAt).getTime() >= weekAgo);
  const ranked = (fresh.length >= 5 ? fresh : scored)
    .sort((a, b) => b.score.total - a.score.total || Number(b.voteDelta || 0) - Number(a.voteDelta || 0))
    .slice(0, 10);
  const categories = [...new Set(ranked.map((agent) => agent.category))];
  return {
    week: weekKey(updatedAt),
    generatedAt: updatedAt,
    categories,
    summary: ranked[0] ? `${ranked[0].name} leads this week's Radar signals, while ${categories.slice(0, 3).join(', ')} are the most visible categories in the current discovery set.` : 'The next Radar scan is preparing this week’s signals.',
    agents: ranked
  };
}

module.exports = { category, enrichAgents, mergeArchive, peers, scoreBreakdown, terms, weekKey, weeklyReport };
