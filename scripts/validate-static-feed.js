const { createClient } = require('../lib/static-store');
const { assessFeed } = require('../lib/feed-health');

async function validate() {
  const payload = await createClient().get('agents:latest');
  const assessment = assessFeed(payload);
  if (!assessment.healthy) {
    const failed = Object.entries(assessment.checks).filter(([, passed]) => !passed).map(([name]) => name);
    throw new Error(`Static feed failed production quality checks: ${failed.join(', ')}`);
  }
  console.log(`Static feed verified: ${assessment.projects} projects, ${assessment.evidenceSignals} demand signals, ${assessment.professionalCoverage.representedDomains} professional domains.`);
}

validate().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
