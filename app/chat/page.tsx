/**
 * Wrath Shield v3 - Chat Page
 *
 * Main chat interface for the confidence coaching system.
 * This placeholder will be replaced with the full SpeechMiner v2 implementation.
 */

"use client";
import { useState } from 'react';
import ChatSlashInput from '@/components/ChatSlashInput';
import GlobalShortcuts from '@/components/GlobalShortcuts';

export default function ChatPage() {
  const [out, setOut] = useState<string>('');
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-green mb-4">Chat</h1>
        <div className="card">
          <p className="text-secondary">
            Chat interface coming soon. This will be the main conversational interface
            for the confidence coaching system powered by SpeechMiner v2.
          </p>
        </div>

        {process.env.NEXT_PUBLIC_SLASH_COMMANDS_ENABLED === 'true' && (
          <div className="card mt-6">
            <div className="mb-2 text-secondary">Slash commands enabled — try typing /help and press Enter</div>
            <ChatSlashInput onCommandOutput={(t) => setOut(String(t))} />
            <div className="mt-2 text-secondary" aria-live="polite">{out}</div>
          </div>
        )}

        {process.env.NEXT_PUBLIC_GLOBAL_SHORTCUTS_ENABLED === 'true' && (
          <GlobalShortcuts onReplace={() => setOut('Alt+R pressed')} onForge={() => setOut('Alt+F pressed')} />
        )}
      </div>
    </div>
  );
}
