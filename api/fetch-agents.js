const { kv } = require('@vercel/kv');

const PH_ENDPOINT = 'https://api.producthunt.com/v2/api/graphql';
const KEYWORDS = /\b(agent|agents|autonomous|workflow|workflows|mcp|copilot|assistant|assistants)\b/i;
const TOPIC_SLUGS = ['artificial-intelligence', 'developer-tools'];

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
    body: JSON.stringify({ query: QUERY, variables: { topic, first: 25 } })
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

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
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

    const agents = [...unique.values()].sort((a, b) => b.votes - a.votes);
    const payload = { updatedAt: new Date().toISOString(), count: agents.length, agents };
    await kv.set('agents:latest', payload);

    return res.status(200).json({ ok: true, updatedAt: payload.updatedAt, count: agents.length });
  } catch (error) {
    console.error('Product Hunt refresh failed:', error);
    return res.status(502).json({ error: 'Unable to refresh agents', detail: error.message });
  }
};
