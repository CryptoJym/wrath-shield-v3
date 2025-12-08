'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Communications Page - DEPRECATED
 *
 * This page has been merged into the PM dashboard.
 * Redirects to /pm?tab=pipeline
 */
export default function CommsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/pm?tab=pipeline');
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 p-6 flex items-center justify-center">
      <div className="text-center">
        <div className="text-slate-400 mb-2">Redirecting to PM Dashboard...</div>
        <div className="text-sm text-slate-600">
          The Communications page has been merged into the Pipeline tab.
        </div>
      </div>
    </div>
  );
}
