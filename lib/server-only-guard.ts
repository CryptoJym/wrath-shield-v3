/**
 * Wrath Shield v3 - Server-Only Module Guard
 *
 * This utility ensures server-only modules are never accidentally
 * imported in client components by throwing runtime errors.
 */

/**
 * Verify this code is running on the server
 * @throws {Error} if running in browser environment
 */
export function ensureServerOnly(moduleName: string): void {
  if (typeof window !== 'undefined') {
    throw new Error(
      `SECURITY ERROR: The module "${moduleName}" can only be imported in server-side code.\n\n` +
      `This module contains secrets and must never be bundled for the client.\n\n` +
      `If you see this error:\n` +
      `1. Check that you're not importing ${moduleName} in a Client Component\n` +
      `2. Ensure you're using Server Actions or API Routes to access this functionality\n` +
      `3. Add 'use server' directive to server-only files\n\n` +
      `For more info: https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns#keeping-server-only-code-out-of-the-client-environment`
    );
  }
}
