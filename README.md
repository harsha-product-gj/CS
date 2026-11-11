# SleepyHug CS

Customer support workspace for SleepyHug. The requirements are in [SPEC.md](SPEC.md).

Stack: Next.js 16 · Supabase (Postgres + Auth) · Vercel.

## First-time setup

1. `npm install`
2. Fill in `.env.local`. Copy it from `.env.example`; the values are in the Supabase dashboard:
   - **Project Settings → API**: project URL, `anon` key, `service_role` key
   - **Connect → Session pooler**: `DATABASE_URL` (includes the database password)
3. In Supabase, go to **Authentication → Sign In / Providers** and turn **off** "Allow new users to sign up". Only admins create users.
4. `npm run db:migrate`: creates the tables.
5. `npm run import:orders -- "data/DataBank - Sale Orders.csv"`: loads the orders. Add `--dry-run` to see the stats without writing.
6. `npm run user:create`: creates the first admin. After that, add users from **Users** in the app.
7. `npm run dev` and open http://localhost:3000

## Deploying (Vercel)

Import the GitHub repo in Vercel and add these environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LOGIN_EMAIL_DOMAIN`

`DATABASE_URL` is only needed locally for scripts.

## Notes

- Users sign in with a **username + password**. Behind the scenes Supabase stores them as `username@LOGIN_EMAIL_DOMAIN`; no email is ever sent. Google sign-in will replace this later.
- All data access is server-side with the service-role key. Row-level security is on with no policies, so browser keys can't read anything.
- `data/` holds local exports with customer PII and is git-ignored.
- Order channel mapping and linking of replacement shipments live in `src/lib/orders/transform.ts`.
