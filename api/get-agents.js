const { createClient } = require('@vercel/kv');
const { cleanIssueEvidence, evidenceConfidence, opportunityPattern } = require('../lib/opportunity-themes');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    const missing = [];
    if (!url) missing.push('KV_REST_API_URL');
    if (!token) missing.push('KV_REST_API_TOKEN');
    console.error(`KV configuration missing: ${missing.join(', ')}`);
    return res.status(503).json({ error: 'Agent storage is not configured', missing });
  }

  try {
    const kv = createClient({ url, token });
    const stored = await kv.get('agents:latest');
    const payload = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
    const cleanedAgents = (Array.isArray(payload.agents) ? payload.agents : []).map((agent) => {
      const evidenceIssues = cleanIssueEvidence(agent.evidenceIssues || []);
      return { ...agent, evidenceIssues, painSignals: evidenceIssues.length };
    });
    const patternRepositories = cleanedAgents.reduce((groups, agent) => {
      const repositoryId = String(agent.id || agent.slug || agent.name);
      agent.evidenceIssues.forEach((issue) => {
        const pattern = opportunityPattern(issue).name;
        if (!groups.has(pattern)) groups.set(pattern, new Set());
        groups.get(pattern).add(repositoryId);
      });
      return groups;
    }, new Map());
    const agents = cleanedAgents.map((agent) => ({
      ...agent,
      evidenceIssues: agent.evidenceIssues.map((issue) => {
        const pattern = opportunityPattern(issue).name;
        return { ...issue, pattern, confidence: evidenceConfidence(issue, patternRepositories.get(pattern)?.size || 1) };
      })
    }));

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : null,
      count: agents.length,
      agents
    });
  } catch (error) {
    console.error('KV read failed:', { name: error?.name, message: error?.message });
    return res.status(500).json({
      error: 'Unable to read the agent feed',
      detail: process.env.VERCEL_ENV === 'development' ? error?.message : undefined
    });
  }
};
