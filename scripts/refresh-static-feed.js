process.env.RADAR_STATIC_WRITE = '1';
process.env.CRON_SECRET = process.env.CRON_SECRET || 'local-static-refresh';
process.env.VERCEL_GIT_COMMIT_SHA = process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA || 'local-refresh';

const handler = require('../api/fetch-agents');

function run() {
  return new Promise((resolve, reject) => {
    const req = {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.CRON_SECRET}`,
        'x-github-token': process.env.GITHUB_TOKEN || ''
      }
    };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) {
        if (this.statusCode >= 400) reject(new Error(body?.detail || body?.error || `Refresh failed with ${this.statusCode}`));
        else resolve(body);
        return this;
      }
    };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}

run().then((result) => {
  console.log(`Static feed refreshed: ${result.count} projects, ${result.archiveCount} archived, report ${result.weeklyReport}`);
}).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
