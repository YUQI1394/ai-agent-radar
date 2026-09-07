module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const url = String(process.env.SUPABASE_URL || '').trim();
  const publishableKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  return res.status(200).json({ configured: Boolean(url && publishableKey), url, publishableKey });
};
