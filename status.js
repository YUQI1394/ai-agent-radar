(async () => {
  const panel = document.querySelector('#status-panel');
  const set = (id, value) => { document.querySelector(id).textContent = value; };
  const grid = panel.querySelector('.status-grid');
  if (grid && !document.querySelector('#status-domains')) grid.insertAdjacentHTML('beforeend', '<div><strong id="status-domains">—</strong><span>Professional domains</span></div>');
  if (grid && !document.querySelector('#status-refresh')) grid.insertAdjacentHTML('beforeend', '<div><strong id="status-refresh">—</strong><span>Latest GitHub scan</span></div>');
  if (grid && !document.querySelector('#status-context')) grid.insertAdjacentHTML('beforeend', '<div><strong id="status-context">—</strong><span>Reporter context</span></div>');
  if (grid && !document.querySelector('#status-repeated')) grid.insertAdjacentHTML('beforeend', '<div><strong id="status-repeated">—</strong><span>Repeated need patterns</span></div>');
  if (grid && !document.querySelector('#status-sources')) grid.insertAdjacentHTML('beforeend', '<div><strong id="status-sources">—</strong><span>Domains with 2+ evidence sources</span></div>');
  try {
    const response = await fetch('/health', { cache: 'no-store' });
    const health = await response.json();
    panel.classList.add(health.status === 'healthy' ? 'status-healthy' : 'status-degraded');
    set('#status-name', health.status === 'healthy' ? 'All data systems operational' : 'Data pipeline degraded');
    set('#status-time', `Checked ${new Date(health.checkedAt).toLocaleString()}`);
    set('#status-projects', health.projects ?? '—');
    set('#status-freshness', Number.isFinite(health.ageHours) ? `${health.ageHours}h` : 'Unknown');
    set('#status-coverage', health.issueCoverage ? `${health.issueCoverage.scanned}/${health.issueCoverage.total} (${health.issueCoverage.percent ?? '—'}%)` : '—');
    set('#status-evidence', health.evidenceSignals ?? '—');
    set('#status-context', health.evidenceContext ? `${health.evidenceContext.available}/${health.evidenceContext.total} (${health.evidenceContext.percent}%)` : '—');
    set('#status-repeated', health.demandConfidence?.repeatedPatterns ?? '—');
    set('#status-domains', health.professionalCoverage?.representedDomains ?? '—');
    const demandCoverage = health.professionalDemandCoverage;
    set('#status-sources', demandCoverage ? `${demandCoverage.multiSourceDemandDomains ?? 0}/${demandCoverage.representedDomains ?? 0}` : '—');
    const ingestion = health.ingestion;
    set('#status-refresh', ingestion ? (ingestion.degraded ? 'Partial' : `${ingestion.searchesSucceeded}/${ingestion.searchesSucceeded + ingestion.searchesFailed}`) : 'Legacy');
  } catch (_) {
    panel.classList.add('status-degraded');
    set('#status-name', 'Health endpoint unavailable');
    set('#status-time', 'The status request could not be completed.');
  }
})();
