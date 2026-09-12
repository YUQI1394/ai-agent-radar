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
  const categoryBalanced = (items, selectionLimit) => {
    const groups = new Map();
    items.forEach((item) => {
      const key = String(item.category || 'General AI');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    groups.forEach((group) => group.sort(byOldestScan));
    const selected = [...groups.values()].map((group) => group[0]).sort(byOldestScan).slice(0, selectionLimit);
    const selectedNames = new Set(selected.map((item) => String(item.name).toLowerCase()));
    const remaining = items.filter((item) => !selectedNames.has(String(item.name).toLowerCase())).sort(byOldestScan);
    return [...selected, ...remaining].slice(0, selectionLimit);
  };
  const current = candidates.filter((agent) => currentNames.has(String(agent.name).toLowerCase())).sort(byOldestScan);
  const discovery = candidates.filter((agent) => !currentNames.has(String(agent.name).toLowerCase())).sort(byOldestScan);
  const currentLimit = discovery.length ? Math.min(CURRENT_ISSUE_TARGETS_PER_SCAN, limit) : limit;
  const selectedCurrent = categoryBalanced(current, currentLimit);
  return [...selectedCurrent, ...categoryBalanced(discovery, limit - selectedCurrent.length)];
}

module.exports = { selectIssueTargets };
