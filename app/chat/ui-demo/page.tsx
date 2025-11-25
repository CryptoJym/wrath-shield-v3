"use client";

import dynamic from 'next/dynamic';

const AnimatedAIChat = dynamic(() => import('@/components/ui/animated-ai-chat').then(m => ({ default: m.AnimatedAIChat })), { ssr: false });

export default function ChatUIDemoPage() {
  return (
    <div className="min-h-screen">
      <AnimatedAIChat />
    </div>
  );
}

