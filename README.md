# AI Agent Radar

AI Agent Radar is a pure-front-end discovery site backed by Vercel Serverless Functions and Vercel KV. It fetches the top Product Hunt products from the `artificial-intelligence` and `developer-tools` topics, keeps agent-like products, ranks them by votes, and refreshes the feed every six hours.

## Features

- Responsive dark neon UI with a three-column desktop and single-column mobile layout
- Product cards ordered by Product Hunt votes
- Every agent is available for free
- Instant client-side search and combinable topic filtering
- Share-on-X links for every agent
- Skeleton loading states and ad-ready legal pages
- Dedicated agent detail page
- Scheduled Product Hunt GraphQL ingestion into Vercel KV
- Cache-friendly public feed API

## Project structure

```text
.
├── api/
│   ├── fetch-agents.js   # Product Hunt ingestion cron endpoint
│   └── get-agents.js     # Public KV read endpoint
├── app.js                # Feed rendering, search, filters, and sharing
├── detail.html           # Agent details
├── index.html            # Main page
├── privacy-policy.html   # Privacy policy
├── terms-of-service.html # Terms of service
├── og-image.svg          # Social sharing image
├── styles.css            # Responsive site styles
├── package.json
└── vercel.json           # Rewrites and six-hour cron
```

## Deploy to Vercel

1. Create a Product Hunt developer token at [Product Hunt API documentation](https://api.producthunt.com/v2/docs) and keep it private.
2. Push this directory to a Git repository and import the repository in Vercel, or run:

   ```bash
   npm install
   npx vercel
   ```

3. Connect storage:
   - If the project already has a legacy/migrated Vercel KV store, connect that store to the project. Its `KV_REST_API_URL` and `KV_REST_API_TOKEN` variables work directly with `@vercel/kv`.
   - For a new project, Vercel no longer provisions first-party KV stores. Install **Upstash Redis** from the Vercel Marketplace, then map its REST URL and REST token to environment variables named `KV_REST_API_URL` and `KV_REST_API_TOKEN`. This preserves the requested `@vercel/kv` API used by this project.
4. In **Settings → Environment Variables**, add:

   - `PH_TOKEN`: your Product Hunt API access token.
   - `CRON_SECRET`: a long random secret used to protect `/api/fetch-agents`. Vercel cron requests automatically send `Authorization: Bearer <CRON_SECRET>` when this variable is configured.
   - `KV_REST_API_URL` and `KV_REST_API_TOKEN`: only add these manually when your storage integration did not inject variables with these exact names.

5. Redeploy after adding the environment variables.
6. Seed the first feed by sending an authorized request:

   ```bash
   curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://YOUR_DOMAIN/api/fetch-agents
   ```

7. Open the production URL. Future refreshes run automatically at `00:00`, `06:00`, `12:00`, and `18:00` UTC.

For local development, link the folder to the Vercel project so its development environment is available, then run `npm run dev`. You can also create a `.env.local` containing `PH_TOKEN`, `CRON_SECRET`, and the KV variables; never commit that file.

## API responses

`GET /api/get-agents` returns:

```json
{
  "updatedAt": "2026-08-20T12:00:00.000Z",
  "count": 42,
  "agents": []
}
```

`GET` or `POST /api/fetch-agents` refreshes KV and returns the update timestamp and number of saved agents. When `CRON_SECRET` is configured, the endpoint requires its bearer token.

## License

Use and adapt this starter for your own project. Product Hunt names, product data, and trademarks belong to their respective owners.
