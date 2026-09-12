const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
})[character]);

function sendNotFound(res, {
  eyebrow = '404 · SIGNAL LOST',
  headline = 'This signal is no longer available.',
  message = 'The page may have moved or the underlying public data may have changed.',
  primaryHref = '/opportunities',
  primaryLabel = 'Discover current opportunities'
} = {}) {
  const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, follow"><title>${escapeHtml(headline)} · AI Agent Radar</title><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/styles.css"></head><body><header class="site-header"><a class="brand" href="/">AI Agent Radar</a><nav class="site-nav"><a href="/">Home</a><a href="/opportunities">Opportunities</a><a href="/patterns">Patterns</a><a href="/workspace">Workspace</a></nav></header><main class="page-shell report-shell"><section class="report-hero"><span class="eyebrow">${escapeHtml(eyebrow)}</span><h1>${escapeHtml(headline)}</h1><p>${escapeHtml(message)}</p><div class="hero-actions"><a class="button button-primary" href="${escapeHtml(primaryHref)}">${escapeHtml(primaryLabel)}</a><a class="button button-secondary" href="/workspace">Continue in workspace</a><a class="button button-secondary" href="/">Browse projects</a></div></section></main><footer class="site-footer"><p>AI Agent Radar · Free, independent open-source intelligence</p></footer></body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Robots-Tag', 'noindex, follow');
  return res.status(404).send(html.replace('</body>', '<script src="/analytics.js"></script></body>'));
}

module.exports = { sendNotFound };
