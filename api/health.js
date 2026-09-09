const { createClient } = require('@vercel/kv');
const { category } = require('../lib/radar');

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
    const contextSignals = agents.reduce((sum, agent) => sum + (Array.isArray(agent.evidenceIssues) ? agent.evidenceIssues.filter((issue) => issue.excerpt).length : 0), 0);
    const contextRatio = evidenceSignals ? contextSignals / evidenceSignals : 0;
    const issueCoverageRatio = agents.length ? scannedRepositories / agents.length : 0;
    const domainCoverage = agents.reduce((counts, agent) => {
      const name = category(agent);
      counts[name] = (counts[name] || 0) + 1;
      return counts;
    }, {});
    const representedDomains = Object.values(domainCoverage).filter((count) => count > 0).length;
    const largestDomainShare = agents.length ? Math.max(...Object.values(domainCoverage)) / agents.length : 1;
    const deploymentCommit = process.env.VERCEL_GIT_COMMIT_SHA || null;
    const checks = { storage: true, feedPresent: agents.length > 0, feedFresh: ageHours !== null && ageHours <= 12, curatedDepth: agents.length >= 20, issueCoverage: issueCoverageRatio >= 0.5, demandEvidence: evidenceSignals >= 30, evidenceContext: contextRatio >= 0.75, professionalBreadth: representedDomains >= 7 && largestDomainShare <= 0.6, refreshComplete: payload?.ingestion ? !payload.ingestion.degraded : true, refreshDeployment: !payload?.ingestion?.deploymentCommit || payload.ingestion.deploymentCommit === deploymentCommit };
    const healthy = Object.values(checks).every(Boolean);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(healthy ? 200 : 503).json({ status: healthy ? 'healthy' : 'degraded', checkedAt, deploymentCommit, updatedAt: payload?.updatedAt || null, ageHours, projects: agents.length, issueCoverage: { scanned: scannedRepositories, total: agents.length, percent: Math.round(issueCoverageRatio * 100) }, evidenceSignals, evidenceContext: { available: contextSignals, total: evidenceSignals, percent: Math.round(contextRatio * 100) }, ingestion: payload?.ingestion || null, professionalCoverage: { representedDomains, largestDomainShare: Math.round(largestDomainShare * 100), domains: domainCoverage }, checks });
  } catch (error) {
    console.error('Health check failed:', { name: error?.name, message: error?.message });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ status: 'unhealthy', checkedAt, checks: { storage: false } });
  }
};
