const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const stored = await kv.get('agents:latest');
    const payload = stored && typeof stored === 'object'
      ? stored
      : { updatedAt: null, count: 0, agents: [] };
    const agents = Array.isArray(payload.agents) ? payload.agents : [];

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      updatedAt: payload.updatedAt || null,
      count: agents.length,
      agents
    });
  } catch (error) {
    console.error('KV read failed:', error);
    return res.status(500).json({ error: 'Unable to read the agent feed' });
  }
};
