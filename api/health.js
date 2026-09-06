const { createClient } = require('@vercel/kv');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  const checkedAt = new Date().toISOString();
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return res.status(503).json({ status: 'unhealthy', checkedAt, checks: { storage: false } });
  try {
    const kv = createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
    const payload = await kv.get('agents:latest');
    const agents = Array.isArray(payload?.agents) ? payload.agents : [];
    const updatedTime = Date.parse(payload?.updatedAt || '');
    const ageHours = Number.isFinite(updatedTime) ? Math.round((Date.now() - updatedTime) / 36000) / 100 : null;
    const scannedRepositories = agents.filter((agent) => agent.issueScannedAt).length;
    const evidenceSignals = agents.reduce((sum, agent) => sum + (Array.isArray(agent.evidenceIssues) ? agent.evidenceIssues.length : 0), 0);
    const checks = { storage: true, feedPresent: agents.length > 0, feedFresh: ageHours !== null && ageHours <= 12, curatedDepth: agents.length >= 20 };
    const healthy = Object.values(checks).every(Boolean);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(healthy ? 200 : 503).json({ status: healthy ? 'healthy' : 'degraded', checkedAt, updatedAt: payload?.updatedAt || null, ageHours, projects: agents.length, issueCoverage: { scanned: scannedRepositories, total: agents.length }, evidenceSignals, checks });
  } catch (error) {
    console.error('Health check failed:', { name: error?.name, message: error?.message });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ status: 'unhealthy', checkedAt, checks: { storage: false } });
  }
};
