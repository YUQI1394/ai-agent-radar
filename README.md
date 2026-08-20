# AI Agent Radar

AI Agent Radar is a pure-front-end discovery site backed by Vercel Serverless Functions and Vercel KV. It fetches the top Product Hunt products from the `artificial-intelligence` and `developer-tools` topics, keeps agent-like products, ranks them by votes, and refreshes the feed every six hours.

## Features

- Responsive dark neon UI with a three-column desktop and single-column mobile layout
- Product cards ordered by Product Hunt votes
- Free preview of the first 10 agents
- Full-feed search and topic filtering after local access is unlocked
- Dedicated agent detail page
- Scheduled Product Hunt GraphQL ingestion into Vercel KV
- Cache-friendly public feed API

## Project structure

```text
.
├── api/
│   ├── fetch-agents.js   # Product Hunt ingestion cron endpoint
│   └── get-agents.js     # Public KV read endpoint
├── app.js                # Feed rendering, search, filters, access state
├── detail.html           # Agent details
├── index.html            # Main page
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

## Access and Gumroad setup

The two pricing buttons in `index.html` intentionally use `href="#"`. To connect Gumroad:

1. Create two Gumroad membership products:
   - **Full Access** at `$1/month`
   - **Pro Weekly Digest** at `$5/month`
2. Copy each Gumroad product checkout URL and replace the matching `href="#"` in `index.html`.
3. After a successful Full Access purchase, unlock the browser by setting:

   ```js
   localStorage.setItem('radar_unlocked', 'true');
   location.reload();
   ```

   For a quick prototype, put this snippet on a Gumroad redirect/thank-you page or expose it through a small “Activate purchase” flow.

> `localStorage` is client-side access control and can be changed by visitors. It is suitable for validating the product idea, but it is not secure payment enforcement. For production-grade access, verify Gumroad license/subscription data in a serverless endpoint, issue a signed session cookie, and protect the complete dataset server-side. Otherwise, `/api/get-agents` still exposes all records publicly.

4. Configure Gumroad Ping or webhooks if you want to maintain subscriber status, cancellations, and the weekly digest mailing list in an external email provider.

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
