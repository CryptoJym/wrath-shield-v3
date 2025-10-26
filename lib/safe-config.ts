/**
 * Wrath Shield v3 - Client-Safe Configuration
 *
 * This module provides safe, non-sensitive configuration flags
 * that can be accessed from client components.
 *
 * NEVER expose secrets or API keys here.
 */

export type ClientSafeConfig = {
  features: {
    whoopEnabled: boolean;
    limitlessEnabled: boolean;
    coachingEnabled: boolean;
  };
  ui: {
    appName: string;
    version: string;
  };
};

/**
 * Get client-safe configuration flags
 *
 * This function can be called from both server and client.
 * It only returns non-sensitive feature flags.
 */
export function getClientSafeConfig(): ClientSafeConfig {
  return {
    features: {
      whoopEnabled: true,
      limitlessEnabled: !!process.env.NEXT_PUBLIC_LIMITLESS_ENABLED,
      coachingEnabled: true,
    },
    ui: {
      appName: 'Wrath Shield v3',
      version: '3.0.0',
    },
  };
}
