const ISSUE_TARGETS_PER_SCAN = 10;
const CURRENT_ISSUE_TARGETS_PER_SCAN = 7;

function selectIssueTargets(candidates, currentAgents = [], archivedAgents = [], limit = ISSUE_TARGETS_PER_SCAN) {
  const historyByName = new Map([...archivedAgents, ...currentAgents].map((agent) => [String(agent.name).toLowerCase(), agent]));
  const currentNames = new Set(currentAgents.map((agent) => String(agent.name).toLowerCase()));
  const byOldestScan = (a, b) => {
    const aTime = Date.parse(historyByName.get(String(a.name).toLowerCase())?.issueScannedAt || '') || 0;
    const bTime = Date.parse(historyByName.get(String(b.name).toLowerCase())?.issueScannedAt || '') || 0;
    return aTime - bTime || String(a.name).localeCompare(String(b.name));
  };
  const current = candidates.filter((agent) => currentNames.has(String(agent.name).toLowerCase())).sort(byOldestScan);
  const discovery = candidates.filter((agent) => !currentNames.has(String(agent.name).toLowerCase())).sort(byOldestScan);
  const currentLimit = discovery.length ? Math.min(CURRENT_ISSUE_TARGETS_PER_SCAN, limit) : limit;
  const selectedCurrent = current.slice(0, currentLimit);
  return [...selectedCurrent, ...discovery.slice(0, limit - selectedCurrent.length)];
}

module.exports = { selectIssueTargets };
