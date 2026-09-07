# Supabase authentication launch checklist

AI Agent Radar uses Supabase only for free user authentication. Browser workspace content remains local for now.

1. Create a Supabase project in the region closest to the primary audience.
2. In **Authentication → URL Configuration**, set Site URL to `https://getaiagentradar.com`.
3. Add the exact redirect URL `https://getaiagentradar.com/login`.
4. Keep email authentication enabled for magic links.
5. For Google and GitHub, enable each provider and use the Supabase callback URL shown on that provider's settings page.
6. Copy the project URL and the `sb_publishable_...` key into `auth-config.json`; set `configured` to `true`.
7. Never put the `service_role` key, OAuth provider secret or database password in the repository.
8. Deploy, then test Google, GitHub and email sign-in in a private browser window. Confirm `/workspace` redirects logged-out users and opens for logged-in users.

The publishable key is designed to be present in browser code. Authorization for any future cloud data must still be enforced with Supabase Row Level Security.
