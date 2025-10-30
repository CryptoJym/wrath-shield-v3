/**
 * Wrath Shield v3 - Digest Page
 *
 * Daily summary and insights from Mem0 semantic memory.
 * Includes interactive SpeechMiner demo for confidence flag analysis.
 */

import SpeechMinerDemo from '@/components/SpeechMinerDemo';
import dynamic from 'next/dynamic';
const DigestConsole = dynamic(() => import('@/components/DigestConsole'), { ssr: false });

export default function DigestPage() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-green mb-2">Digest</h1>
          <p className="text-secondary text-sm">
            Analyze your communication patterns in real-time
          </p>
        </div>

        {/* SpeechMiner Demo */}
        <SpeechMinerDemo />

        {/* Digest Console */}
        <DigestConsole />

        {/* Future Features */}
        <div className="card">
          <h2 className="text-lg font-semibold text-green mb-3">Coming Soon</h2>
          <ul className="list-disc list-inside text-secondary space-y-2 text-sm">
            <li>AI-generated daily summaries combining WHOOP metrics and manipulation detection</li>
            <li>Confidence trends and patterns over time</li>
            <li>Insights from your "unbending score" - wrath deployment metrics</li>
            <li>Semantic memory anchors and key moments</li>
            <li>Personalized recommendations for growth</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
