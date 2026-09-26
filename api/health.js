const { createClient } = require('@vercel/kv');
const { assessFeed } = require('../lib/feed-health');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  const checkedAt = new Date().toISOString();
  const deploymentCommit = process.env.VERCEL_GIT_COMMIT_SHA || null;
  if (String(req.query?.deployment || '') === '1') {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ status: 'deployment-ready', checkedAt, deploymentCommit });
  }
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return res.status(503).json({ status: 'unhealthy', checkedAt, checks: { storage: false } });
  try {
    const kv = createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
    const payload = await kv.get('agents:latest');
    const assessment = assessFeed(payload);
    const checks = { storage: true, ...assessment.checks, refreshDeployment: payload?.ingestion?.deploymentCommit === deploymentCommit };
    const healthy = Object.values(checks).every(Boolean);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(healthy ? 200 : 503).json({ status: healthy ? 'healthy' : 'degraded', checkedAt, deploymentCommit, updatedAt: payload?.updatedAt || null, ...assessment, ingestion: payload?.ingestion || null, checks });
  } catch (error) {
    console.error('Health check failed:', { name: error?.name, message: error?.message });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ status: 'unhealthy', checkedAt, checks: { storage: false } });
  }
};
