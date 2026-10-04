# AI Agent Radar

AI Agent Radar is a free, GitHub-first research tool for builders deciding what to build around AI agents. It searches open-source projects and public GitHub discussions, then turns recurring friction into traceable opportunity evidence and a practical validation next step.

**Live site:** [getaiagentradar.com](https://getaiagentradar.com)  
**Original research:** [AI Agent Demand Report · October 2026](https://getaiagentradar.com/ai-agent-demand-report)

The core product is free. The Radar has no paid rankings, and it treats GitHub discussion as a starting point for interviews—not proof of market size or willingness to pay.

## Features

- Curated open-source AI agent discovery with transparent repository signals
- Opportunity Radar: qualified public GitHub Issues, with original source links
- Pattern Radar: cross-repository workflow friction, separated from isolated requests
- Coach-style validation briefs and a seven-day experiment workflow
- A private, free workspace for saved signals, notes, decisions and progress
- RSS, metadata, structured data, sitemap and canonical URLs for transparent discovery
- An original evidence-led demand report that summarizes recurring public friction
- OIDC-authenticated GitHub ingestion and production health checks every six hours

## Authentication setup

Copy the project's public Supabase URL and publishable key into `auth-config.json`, then set `configured` to `true`. These values are intentionally public browser credentials; never place a Supabase service-role key in this file. In Supabase Auth, use `https://getaiagentradar.com` as the Site URL and allow `https://getaiagentradar.com/login` as a redirect URL. Enable Google and GitHub providers if those buttons should be available; email magic-link registration works when Supabase email auth is enabled.
- Cross-repository Pattern Radar for separating recurring needs from isolated requests
- Public methodology covering inclusion, scoring, evidence filters and limitations
- Public freshness and data-health endpoint for production monitoring
- Cache-friendly public feed API

## Editorial guardrails

- Source material is public GitHub metadata and public Issue discussions.
- A qualified Issue is evidence of a problem worth investigating, not a buying signal.
- The site does not accept paid placement or alter rankings for commercial relationships.
- Each opportunity should be validated with direct user conversations and an observable commitment before product work begins.

## Project structure

```text
.
├── .github/workflows/
│   └── refresh-agents.yml # Six-hour refresh schedule
├── api/
│   ├── fetch-agents.js   # GitHub ingestion cron endpoint
│   ├── get-agents.js     # Public KV read endpoint
│   ├── agent.js          # Server-rendered agent pages
│   ├── opportunities.js  # Ranked GitHub Issue opportunity evidence
│   ├── opportunity.js    # Guided opportunity validation briefs
│   ├── patterns.js       # Cross-repository demand pattern synthesis
│   └── sitemap.js        # Dynamic XML sitemap
├── app.js                # Feed rendering, search, filters, and sharing
├── about.html            # Editorial project information
├── contact.html          # Contact information
├── detail.html           # Legacy noindex agent route
├── index.html            # Main page
├── privacy-policy.html   # Privacy policy
├── terms-of-service.html # Terms of service
├── og-image.svg          # Social sharing image
├── styles.css            # Responsive site styles
├── package.json
└── vercel.json           # Production route rewrites
```

## Deploy to Vercel

1. The included GitHub Actions workflow supplies its short-lived, read-only token to each authenticated refresh. No persistent GitHub token is required for scheduled production updates.
2. Push this directory to a Git repository and import the repository in Vercel, or run:

   ```bash
   npm install
   npx vercel
   ```

   Vercel CLI is intentionally not stored as a project dependency because it is not needed at runtime. `npm run dev` downloads the current CLI only for that local session.

3. Connect storage:
   - If the project already has a legacy/migrated Vercel KV store, connect that store to the project. Its `KV_REST_API_URL` and `KV_REST_API_TOKEN` variables work directly with `@vercel/kv`.
   - For a new project, Vercel no longer provisions first-party KV stores. Install **Upstash Redis** from the Vercel Marketplace, then map its REST URL and REST token to environment variables named `KV_REST_API_URL` and `KV_REST_API_TOKEN`. This preserves the requested `@vercel/kv` API used by this project.
4. In **Settings → Environment Variables**, add:

   - `GITHUB_TOKEN`: optional read-only GitHub API token for local or manually triggered refreshes.
   - `KV_REST_API_URL` and `KV_REST_API_TOKEN`: only add these manually when your storage integration did not inject variables with these exact names.

5. Redeploy after adding the environment variables.
6. The GitHub Actions workflow authenticates with a short-lived OIDC token and refreshes the feed automatically. To permit manual authenticated refreshes too, optionally set `CRON_SECRET` in Vercel and send:

   ```bash
   curl --fail -H "Authorization: Bearer YOUR_CRON_SECRET" https://getaiagentradar.com/api/fetch-agents
   ```

7. Open the production URL. GitHub Actions refreshes the feed automatically at `00:00`, `06:00`, `12:00`, and `18:00` UTC.

For local development, link the folder to the Vercel project so its development environment is available, then run `npm run dev`. You can also create a `.env.local` containing the optional `GITHUB_TOKEN` and the KV variables; never commit that file.

## API responses

`GET /api/get-agents` returns:

```json
{
  "updatedAt": "2026-08-20T12:00:00.000Z",
  "count": 42,
  "agents": []
}
```

`GET` or `POST /api/fetch-agents` refreshes KV and returns the update timestamp and number of saved agents. The endpoint requires either a valid short-lived GitHub Actions OIDC token from this repository's refresh workflow or the optional `CRON_SECRET` bearer token.

## License

Use and adapt this starter for your own project. Repository names, metadata and trademarks belong to their respective owners. AI Agent Radar is not affiliated with GitHub.
