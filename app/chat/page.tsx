"use client";

import dynamic from 'next/dynamic';

const AnimatedAIChat = dynamic(() => import('@/components/ui/animated-ai-chat').then(m => ({ default: m.AnimatedAIChat })), { ssr: false });

export default function ChatPage() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <AnimatedAIChat />
    </div>
  );
}
