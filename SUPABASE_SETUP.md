# Supabase authentication launch checklist

AI Agent Radar uses Supabase for free user authentication and private workspace synchronization.

1. Create a Supabase project in the region closest to the primary audience.
2. In **Authentication → URL Configuration**, set Site URL to `https://getaiagentradar.com`.
3. Add the exact redirect URL `https://getaiagentradar.com/login`.
4. Keep email authentication enabled for magic links.
5. For Google and GitHub, enable each provider and use the Supabase callback URL shown on that provider's settings page.
6. Copy the project URL and the `sb_publishable_...` key into `auth-config.json`; set `configured` to `true`.
7. Never put the `service_role` key, OAuth provider secret or database password in the repository.
8. Open **SQL Editor → New query**, paste `supabase/workspace.sql`, and run it once. This creates the private workspace table and Row Level Security policies.
9. Deploy, then test email sign-in in a private browser window. Confirm `/workspace` redirects logged-out users, opens for logged-in users, and shows `Cloud synced`.
10. Enable Google or GitHub only after configuring the matching OAuth application, then add the provider name to `auth-config.json`.

The publishable key is designed to be present in browser code. Never disable Row Level Security on `user_workspace`.
