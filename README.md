# AI Agent Radar

AI Agent Radar is a free discovery site backed by Vercel Serverless Functions and Vercel KV. It searches relevant GitHub topics, filters open-source AI agent projects, ranks them using transparent repository signals, and refreshes the feed every six hours.

## Features

- Responsive dark neon UI with a three-column desktop and single-column mobile layout
- Independent Radar Score plus newest and vote-based sorting
- Every agent is available for free
- Instant client-side search and combinable topic filtering
- Share-on-X links for every agent
- Skeleton loading states and ad-ready legal pages
- Server-rendered, indexable agent detail pages
- Dynamic XML sitemap, robots.txt, structured data, About and Contact pages
- OIDC-authenticated GitHub ingestion every six hours
- Rotating repository-specific Issue analysis for traceable demand signals
- A server-rendered Opportunity Radar that ranks unresolved GitHub Issue evidence
- Problem-theme filters and a three-step opportunity validation playbook
- Indexable guided validation briefs for every qualified opportunity
- Private browser-saved validation progress and research notes with no account required
- A local-only workspace for resuming multiple validation sprints
- Cross-repository Pattern Radar for separating recurring needs from isolated requests
- Cache-friendly public feed API

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
