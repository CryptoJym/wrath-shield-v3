// Minimal auth stub for local dev. Returns a dummy user id unless a real user id is provided.

export function currentUserOrThrow() {
  const userId = process.env.USER_ID || 'demo-user';
  return { userId };
}

export function currentUserOptional() {
  const userId = process.env.USER_ID || 'demo-user';
  return { userId };
}
