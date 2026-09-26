const { category } = require('./radar');
const { cleanIssueEvidence, opportunityPattern } = require('./opportunity-themes');

const TARGET_DOMAINS = ['Security', 'Finance', 'Research', 'Coding', 'Marketing', 'Design', 'Productivity', 'Agent Infrastructure'];

function assessFeed(payload = {}, now = Date.now()) {
  const agents = Array.isArray(payload?.agents) ? payload.agents : [];
  const updatedTime = Date.parse(payload?.updatedAt || '');
  const ageHours = Number.isFinite(updatedTime) ? Math.round((now - updatedTime) / 36000) / 100 : null;
  const scannedRepositories = agents.filter((agent) => agent.issueScannedAt).length;
  const evidenceFor = (agent) => cleanIssueEvidence(Array.isArray(agent.evidenceIssues) ? agent.evidenceIssues : []);
  const evidenceRows = agents.map((agent) => ({ agent, issues: evidenceFor(agent) }));
  const evidenceSignals = evidenceRows.reduce((sum, row) => sum + row.issues.length, 0);
  const contextSignals = evidenceRows.reduce((sum, row) => sum + row.issues.filter((issue) => issue.excerpt).length, 0);
  const contextRatio = evidenceSignals ? contextSignals / evidenceSignals : 0;
  const issueCoverageRatio = agents.length ? scannedRepositories / agents.length : 0;
  const domainCoverage = agents.reduce((counts, agent) => {
    const name = category(agent);
    counts[name] = (counts[name] || 0) + 1;
    return counts;
  }, {});
  const domainEvidenceCoverage = evidenceRows.reduce((counts, { agent, issues }) => {
    const name = category(agent);
    counts[name] = (counts[name] || 0) + issues.length;
    return counts;
  }, {});
  const domainEvidenceSources = evidenceRows.reduce((counts, { agent, issues }) => {
    const name = category(agent);
    if (issues.length) counts[name] = (counts[name] || 0) + 1;
    return counts;
  }, {});
  const patternRepositories = new Map();
  evidenceRows.forEach(({ agent, issues }) => issues.forEach((issue) => {
    const pattern = opportunityPattern(issue);
    if (!patternRepositories.has(pattern)) patternRepositories.set(pattern, new Set());
    patternRepositories.get(pattern).add(String(agent.slug || agent.id || agent.name || 'unknown'));
  }));
  const repeatedPatternNames = new Set([...patternRepositories].filter(([, repositories]) => repositories.size >= 2).map(([pattern]) => pattern));
  const repeatedEvidenceSignals = evidenceRows.reduce((sum, { issues }) => sum + issues.filter((issue) => repeatedPatternNames.has(opportunityPattern(issue))).length, 0);
  const repeatedPatterns = repeatedPatternNames.size;
  const representedDomains = TARGET_DOMAINS.filter((name) => Number(domainCoverage[name] || 0) > 0).length;
  const minimumDomainCount = Math.min(...TARGET_DOMAINS.map((name) => Number(domainCoverage[name] || 0)));
  const representedDemandDomains = TARGET_DOMAINS.filter((name) => Number(domainEvidenceCoverage[name] || 0) > 0).length;
  const minimumDomainEvidence = Math.min(...TARGET_DOMAINS.map((name) => Number(domainEvidenceCoverage[name] || 0)));
  const minimumDomainEvidenceSources = Math.min(...TARGET_DOMAINS.map((name) => Number(domainEvidenceSources[name] || 0)));
  const multiSourceDemandDomains = TARGET_DOMAINS.filter((name) => Number(domainEvidenceSources[name] || 0) >= 2).length;
  const largestDomainShare = agents.length ? Math.max(...Object.values(domainCoverage)) / agents.length : 1;
  const checks = {
    feedPresent: agents.length > 0,
    feedFresh: ageHours !== null && ageHours <= 12,
    curatedDepth: agents.length >= 20,
    issueCoverage: issueCoverageRatio >= 0.5,
    demandEvidence: evidenceSignals >= 30,
    demandConfidence: repeatedPatterns >= 3 && repeatedEvidenceSignals >= 6,
    evidenceContext: contextRatio >= 0.75,
    professionalBreadth: representedDomains === TARGET_DOMAINS.length && minimumDomainCount >= 2 && largestDomainShare <= 0.6,
    professionalDemandBreadth: representedDemandDomains === TARGET_DOMAINS.length && minimumDomainEvidence >= 2,
    refreshComplete: payload?.ingestion ? !payload.ingestion.degraded : true
  };
  return {
    healthy: Object.values(checks).every(Boolean), checks, ageHours, projects: agents.length,
    issueCoverage: { scanned: scannedRepositories, total: agents.length, percent: Math.round(issueCoverageRatio * 100) },
    evidenceSignals, demandConfidence: { repeatedPatterns, repeatedEvidenceSignals },
    evidenceContext: { available: contextSignals, total: evidenceSignals, percent: Math.round(contextRatio * 100) },
    professionalCoverage: { representedDomains, minimumDomainCount, largestDomainShare: Math.round(largestDomainShare * 100), domains: domainCoverage },
    professionalDemandCoverage: { representedDomains: representedDemandDomains, minimumDomainEvidence, minimumDomainEvidenceSources, multiSourceDemandDomains, domains: domainEvidenceCoverage, sourceProjects: domainEvidenceSources }
  };
}

module.exports = { assessFeed };
