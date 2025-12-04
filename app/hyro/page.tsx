'use client';

/**
 * HYRO Education Hub - Redirect to Forge Dashboard
 *
 * The main Hyro Forge dashboard lives at /hyro/forge
 * This page redirects there automatically.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function HyroRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/hyro/forge');
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
        <p className="text-slate-400">Loading HYRO FORGE...</p>
      </div>
    </div>
  );
}
