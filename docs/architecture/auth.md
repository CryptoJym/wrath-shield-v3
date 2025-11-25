# Authentication & MFA (ReWrite LLC) - Plan

## Goals
- Phishing-resistant MFA (passkeys/WebAuthn) for admins and sensitive flows.
- Orgs/tenants, RBAC, and session management via hosted auth (Clerk recommended).
- Minimal friction for consumers; strong guarantees for admin and finance/legal areas.

## Provider choice
- Clerk (recommended for speed): built-in passkeys, orgs/roles, SSO, SOC2.
- Keep an `authClient` abstraction so we can swap to Okta/WorkOS later if needed.

## Planned setup
- Enable passkeys/WebAuthn in Clerk; require MFA for admin roles; MFA opt-in+nudge for end users.
- Roles: owner, admin, member, viewer. Prod access limited to owner/admin.
- Tenant isolation: every request scoped by org/tenant ID; tokens per org (Plaid, Motion, etc.).

## App wiring (Next.js)
- Add `@clerk/nextjs`, wrap `app/layout` with `ClerkProvider`.
- Protect routes via middleware; admin-only for finance/legal.
- Hosted sign-in/sign-up URLs remain available for quick screenshots/compliance.

## Compliance artifacts
- MFA proof: hosted page showing “Use a passkey / security key”.
- Policies: InfoSec, Access Control, Privacy, Data Retention (in docs/policies).

## Next steps
- Add Clerk keys to env (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`).
- Add `/auth` route with `<SignIn />`; enforce MFA=passkey for admins.
