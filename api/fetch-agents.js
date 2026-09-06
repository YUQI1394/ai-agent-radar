const { kv } = require('@vercel/kv');
const crypto = require('crypto');
const { enrichAgents, mergeArchive, qualifiesAsAgent, weeklyReport } = require('../lib/radar');

const GITHUB_API = 'https://api.github.com';
const SEARCHES = [
  'topic:ai-agents stars:>50 archived:false',
  'topic:llm-agents stars:>50 archived:false',
  '"agent framework" in:name,description,readme stars:>100 archived:false',
  'topic:mcp-server stars:>20 archived:false',
  'topic:multi-agent-systems stars:>20 archived:false'
];
const RESULTS_PER_SEARCH = 30;
const CURATED_LIMIT = 36;
const OIDC_ISSUER = 'https://token.actions.githubusercontent.com';
const OIDC_AUDIENCE = 'ai-agent-radar-refresh';
const TRUSTED_REPOSITORY = 'YUQI1394/ai-agent-radar';
const TRUSTED_WORKFLOW = `${TRUSTED_REPOSITORY}/.github/workflows/refresh-agents.yml@refs/heads/main`;
const SITE_URL = 'https://getaiagentradar.com';
const INDEXNOW_KEY = '7a4f931bc0e8421ab5d681f29c7e304d';
let cachedJwks = null;
let jwksExpiresAt = 0;

function githubHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'getaiagentradar.com',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

async function searchRepositories(query) {
  const params = new URLSearchParams({ q: query, sort: 'stars', order: 'desc', per_page: String(RESULTS_PER_SEARCH) });
  const response = await fetch(`${GITHUB_API}/search/repositories?${params}`, { headers: githubHeaders() });
  if (!response.ok) throw new Error(`GitHub repository search returned ${response.status}`);
  const body = await response.json();
  return Array.isArray(body.items) ? body.items : [];
}

function normalize(repo) {
  const topics = Array.isArray(repo.topics) ? repo.topics : [];
  return {
    id: repo.id,
    slug: String(repo.full_name || repo.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    name: repo.full_name || repo.name || '',
    tagline: repo.description || 'Open-source AI agent project on GitHub.',
    description: repo.description || 'Open-source AI agent project on GitHub.',
    url: repo.html_url,
    githubUrl: repo.html_url,
    homepage: repo.homepage || '',
    thumbnail: repo.owner?.avatar_url || '',
    topics,
    topicSlugs: topics,
    language: repo.language || 'Unknown',
    license: repo.license?.spdx_id || 'Not declared',
    stars: Number(repo.stargazers_count || 0),
    forks: Number(repo.forks_count || 0),
    openIssues: Number(repo.open_issues_count || 0),
    votes: Number(repo.stargazers_count || 0),
    createdAt: repo.created_at || null,
    updatedAt: repo.updated_at || null,
    pushedAt: repo.pushed_at || null,
    archived: Boolean(repo.archived),
    source: 'github'
  };
}

function decodeBase64Url(value) { return Buffer.from(value, 'base64url'); }

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
  const urlList = [`${SITE_URL}/`, `${SITE_URL}/about`, `${SITE_URL}/feed.xml`, `${SITE_URL}/weekly/${report.week}`,
    ...agents.map((agent) => `${SITE_URL}/agent/${encodeURIComponent(agent.slug || agent.id)}`)];
  try {
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: 'getaiagentradar.com', key: INDEXNOW_KEY, keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`, urlList })
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
  if (!(await isAuthorized(req))) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const batches = await Promise.all(SEARCHES.map(searchRepositories));
    const unique = new Map();
    batches.flat().forEach((repo) => unique.set(repo.id, normalize(repo)));
    const previous = await kv.get('agents:latest');
    const storedArchive = await kv.get('agents:archive');
    const candidates = [...unique.values()].filter(qualifiesAsAgent);
    const agents = enrichAgents(candidates, Array.isArray(previous?.agents) ? previous.agents : [], Date.now())
      .sort((a, b) => b.score.total - a.score.total || b.stars - a.stars).slice(0, CURATED_LIMIT);
    const updatedAt = new Date().toISOString();
    const payload = { updatedAt, count: agents.length, source: 'github', agents };
    const archivedAgents = mergeArchive(Array.isArray(storedArchive?.agents) ? storedArchive.agents : [], agents, updatedAt);
    const report = weeklyReport(agents, updatedAt);
    const storedReports = await kv.get('weekly:reports');
    const reports = storedReports && typeof storedReports === 'object' && !Array.isArray(storedReports) ? storedReports : {};
    reports[report.week] = report;
    await kv.set('agents:latest', payload);
    await kv.set('agents:archive', { updatedAt, count: archivedAgents.length, source: 'github', agents: archivedAgents });
    await kv.set('weekly:reports', reports);
    await kv.set(`agents:snapshot:${updatedAt.slice(0, 10)}`, payload, { ex: 60 * 60 * 24 * 35 });
    await kv.lpush('agents:history', payload);
    await kv.ltrim('agents:history', 0, 27);
    await notifyIndexNow(agents, report);
    return res.status(200).json({ ok: true, source: 'github', updatedAt, count: agents.length, archiveCount: archivedAgents.length, weeklyReport: report.week });
  } catch (error) {
    console.error('GitHub refresh failed:', error);
    return res.status(502).json({ error: 'Unable to refresh GitHub projects', detail: error.message });
  }
};
