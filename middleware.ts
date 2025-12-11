import { NextResponse } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const hasClerk = !!process.env.CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY;
const bypass = process.env.DISABLE_AUTH === '1';

// Routes that should stay public (health/privacy)
const isPublic = createRouteMatcher([
  '/privacy(.*)',
  '/api/health(.*)',
  '/api/system/status(.*)',
  '/api/hyro(.*)',      // HYRO Forge APIs (uses fallback auth internally)
  '/hyro(.*)',          // HYRO Forge pages
  '/sign-in(.*)',
  '/sign-up(.*)',
]);

// Protect everything else when Clerk keys are present.
const handler = clerkMiddleware(async (auth, req) => {
  if (bypass || !hasClerk) return NextResponse.next();
  if (isPublic(req)) return NextResponse.next();

  // Use the new Clerk API - auth is already the auth object
  const { userId } = await auth();
  if (!userId) {
    // Redirect to sign-in if not authenticated
    const signInUrl = new URL('/sign-in', req.url);
    signInUrl.searchParams.set('redirect_url', req.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export default handler;

export const config = {
  matcher: [
    // Protect all pages/APIs except _next/static, _next/image, etc.
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
