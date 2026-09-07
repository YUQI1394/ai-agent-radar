(async () => {
  const panel = document.querySelector('#status-panel');
  const set = (id, value) => { document.querySelector(id).textContent = value; };
  const grid = panel.querySelector('.status-grid');
  if (grid && !document.querySelector('#status-domains')) grid.insertAdjacentHTML('beforeend', '<div><strong id="status-domains">—</strong><span>Professional domains</span></div>');
  try {
    const response = await fetch('/health', { cache: 'no-store' });
    const health = await response.json();
    panel.classList.add(health.status === 'healthy' ? 'status-healthy' : 'status-degraded');
    set('#status-name', health.status === 'healthy' ? 'All data systems operational' : 'Data pipeline degraded');
    set('#status-time', `Checked ${new Date(health.checkedAt).toLocaleString()}`);
    set('#status-projects', health.projects ?? '—');
    set('#status-freshness', Number.isFinite(health.ageHours) ? `${health.ageHours}h` : 'Unknown');
    set('#status-coverage', health.issueCoverage ? `${health.issueCoverage.scanned}/${health.issueCoverage.total}` : '—');
    set('#status-evidence', health.evidenceSignals ?? '—');
    set('#status-domains', health.professionalCoverage?.representedDomains ?? '—');
  } catch (_) {
    panel.classList.add('status-degraded');
    set('#status-name', 'Health endpoint unavailable');
    set('#status-time', 'The status request could not be completed.');
  }
})();
