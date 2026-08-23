const { kv } = require('@vercel/kv');
const crypto = require('crypto');
const { enrichAgents, mergeArchive, weeklyReport } = require('../lib/radar');

const PH_ENDPOINT = 'https://api.producthunt.com/v2/api/graphql';
const KEYWORDS = /\b(agent|agents|autonomous|workflow|workflows|mcp|copilot|assistant|assistants)\b/i;
const TOPIC_SLUGS = ['artificial-intelligence', 'developer-tools'];
const CANDIDATES_PER_TOPIC = 40;
const CURATED_LIMIT = 24;
const OIDC_ISSUER = 'https://token.actions.githubusercontent.com';
const OIDC_AUDIENCE = 'ai-agent-radar-refresh';
const TRUSTED_REPOSITORY = 'YUQI1394/ai-agent-radar';
const TRUSTED_WORKFLOW = `${TRUSTED_REPOSITORY}/.github/workflows/refresh-agents.yml@refs/heads/main`;
const SITE_URL = 'https://getaiagentradar.com';
const INDEXNOW_KEY = '7a4f931bc0e8421ab5d681f29c7e304d';
let cachedJwks = null;
let jwksExpiresAt = 0;

const QUERY = `
  query RadarPosts($topic: String!, $first: Int!) {
    posts(topic: $topic, first: $first, order: VOTES) {
      edges {
        node {
          id
          name
          slug
          tagline
          description
          url
          votesCount
          createdAt
          thumbnail { url }
          topics(first: 10) { edges { node { name slug } } }
        }
      }
    }
  }
`;

async function fetchTopic(topic) {
  const response = await fetch(PH_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PH_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ query: QUERY, variables: { topic, first: CANDIDATES_PER_TOPIC } })
  });

  if (!response.ok) throw new Error(`Product Hunt returned ${response.status}`);
  const body = await response.json();
  if (body.errors?.length) throw new Error(body.errors.map((item) => item.message).join('; '));
  return body.data?.posts?.edges?.map((edge) => edge.node) || [];
}

function normalize(post) {
  return {
    id: post.id,
    slug: post.slug,
    name: post.name || '',
    tagline: post.tagline || '',
    description: post.description || '',
    votes: Number(post.votesCount || 0),
    url: post.url || `https://www.producthunt.com/posts/${post.slug}`,
    thumbnail: post.thumbnail?.url || '',
    topics: (post.topics?.edges || []).map((edge) => edge.node.name),
    topicSlugs: (post.topics?.edges || []).map((edge) => edge.node.slug),
    createdAt: post.createdAt || null
  };
}

function decodeBase64Url(value) {
  return Buffer.from(value, 'base64url');
}

async function getGithubJwks() {
  if (cachedJwks && Date.now() < jwksExpiresAt) return cachedJwks;
  const configurationResponse = await fetch(`${OIDC_ISSUER}/.well-known/openid-configuration`);
  if (!configurationResponse.ok) throw new Error('Unable to load GitHub OIDC configuration');
  const configuration = await configurationResponse.json();
  const jwksResponse = await fetch(configuration.jwks_uri);
  if (!jwksResponse.ok) throw new Error('Unable to load GitHub OIDC keys');
  cachedJwks = await jwksResponse.json();
  jwksExpiresAt = Date.now() + 6 * 60 * 60 * 1000;
  return cachedJwks;
}

async function verifyGithubOidc(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const header = JSON.parse(decodeBase64Url(parts[0]).toString('utf8'));
    const payload = JSON.parse(decodeBase64Url(parts[1]).toString('utf8'));
    if (header.alg !== 'RS256' || !header.kid) return false;
    const now = Math.floor(Date.now() / 1000);
    if (payload.iss !== OIDC_ISSUER || payload.aud !== OIDC_AUDIENCE || payload.exp < now || payload.nbf > now) return false;
    if (payload.repository !== TRUSTED_REPOSITORY || payload.workflow_ref !== TRUSTED_WORKFLOW || payload.ref !== 'refs/heads/main') return false;
    const jwks = await getGithubJwks();
    const jwk = jwks.keys?.find((key) => key.kid === header.kid && key.use === 'sig');
    if (!jwk) return false;
    const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    return crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, decodeBase64Url(parts[2]));
  } catch (error) {
    console.error('GitHub OIDC verification failed:', { name: error?.name, message: error?.message });
    return false;
  }
}

async function isAuthorized(req) {
  const authorization = String(req.headers.authorization || '');
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return false;
  if (process.env.CRON_SECRET) {
    const provided = Buffer.from(token);
    const expected = Buffer.from(process.env.CRON_SECRET);
    if (provided.length === expected.length && crypto.timingSafeEqual(provided, expected)) return true;
  }
  return verifyGithubOidc(token);
}

async function notifyIndexNow(agents, report) {
  const urlList = [
    `${SITE_URL}/`,
    `${SITE_URL}/about`,
    `${SITE_URL}/feed.xml`,
    `${SITE_URL}/weekly/${report.week}`,
    ...agents.map((agent) => `${SITE_URL}/agent/${encodeURIComponent(agent.slug || agent.id)}`)
  ];
  try {
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: 'getaiagentradar.com',
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList
      })
    });
    if (!response.ok && response.status !== 202) console.warn(`IndexNow returned ${response.status}`);
  } catch (error) {
    console.warn('IndexNow notification failed:', { name: error?.name, message: error?.message });
  }
}

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await isAuthorized(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!process.env.PH_TOKEN) return res.status(500).json({ error: 'PH_TOKEN is not configured' });

  try {
    const batches = await Promise.all(TOPIC_SLUGS.map(fetchTopic));
    const unique = new Map();
    batches.flat().forEach((post) => {
      const searchable = `${post.name || ''} ${post.tagline || ''} ${post.description || ''}`;
      if (KEYWORDS.test(searchable)) unique.set(post.id || post.slug, normalize(post));
    });

    const rawAgents = [...unique.values()].sort((a, b) => b.votes - a.votes).slice(0, CURATED_LIMIT);
    const previous = await kv.get('agents:latest');
    const updatedAt = new Date().toISOString();
    const agents = enrichAgents(rawAgents, Array.isArray(previous?.agents) ? previous.agents : [], Date.now());
    const payload = { updatedAt, count: agents.length, agents };
    const storedArchive = await kv.get('agents:archive');
    const archivedAgents = mergeArchive(Array.isArray(storedArchive?.agents) ? storedArchive.agents : [], agents, updatedAt);
    const archivePayload = { updatedAt, count: archivedAgents.length, agents: archivedAgents };
    const report = weeklyReport(agents, updatedAt);
    const storedReports = await kv.get('weekly:reports');
    const reports = storedReports && typeof storedReports === 'object' && !Array.isArray(storedReports) ? storedReports : {};
    reports[report.week] = report;
    await kv.set('agents:latest', payload);
    await kv.set('agents:archive', archivePayload);
    await kv.set('weekly:reports', reports);
    await kv.set(`agents:snapshot:${updatedAt.slice(0, 10)}`, payload, { ex: 60 * 60 * 24 * 35 });
    await kv.lpush('agents:history', payload);
    await kv.ltrim('agents:history', 0, 27);
    await notifyIndexNow(agents, report);

    return res.status(200).json({ ok: true, updatedAt: payload.updatedAt, count: agents.length, archiveCount: archivedAgents.length, weeklyReport: report.week });
  } catch (error) {
    console.error('Product Hunt refresh failed:', error);
    return res.status(502).json({ error: 'Unable to refresh agents', detail: error.message });
  }
};
