# Authentication (Clerk) - Draft

## What we ship
- Clerk wired into the Next.js app (app router).
- Middleware gates everything except `/privacy`, `/api/health`, `/api/system/status`, and static assets.
- Conditional: if `CLERK_PUBLISHABLE_KEY` or `CLERK_SECRET_KEY` is missing, gating is bypassed so local/tests still run.
- Sign-in/up pages: `/sign-in`, `/sign-up`.
- User menu in the header (`UserButton`) when Clerk is active.

## Required env
```
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

Add them to:
- local: `.env.local`
- Vercel: Project Settings → Environment Variables (Production + Preview).

## Protecting routes
- Default matcher in `middleware.ts` protects all routes except the small allowlist above.
- If you need a page/API public, add it to `isPublic` in `middleware.ts`.

## Multi-tenant / user data separation
- Next step: scope data (finance/events/memory) by authenticated user email or Clerk user ID. (Currently not per-user partitioned; gating just restricts access.)
- Recommended mapping: primary email → user profile → per-user namespace in SQLite/Qdrant/Zep.

## Local dev
- If keys are absent, middleware no-ops and UI renders without ClerkProvider (still functional for local/testing).
- To test auth locally, set keys and run `npm run dev`, then visit `/sign-in`.

## Known gaps
- Per-user data partitioning not implemented yet.
- No Clerk webhooks/configured orgs; current setup is single-tenant with gated access.
