import { NextResponse } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const hasClerk = !!process.env.CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY;
const bypass = process.env.DISABLE_AUTH === '1' || process.env.NODE_ENV === 'development';

// Routes that should stay public (health/privacy)
const isPublic = createRouteMatcher([
  '/privacy(.*)',
  '/api/health(.*)',
  '/api/system/status(.*)',
]);

// Protect everything else when Clerk keys are present.
const handler = clerkMiddleware((auth, req) => {
  if (bypass || !hasClerk) return NextResponse.next();
  if (isPublic(req)) return NextResponse.next();
  return auth().protect();
});

export default handler;

export const config = {
  matcher: [
    // Protect all pages/APIs except _next/static, _next/image, etc.
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
