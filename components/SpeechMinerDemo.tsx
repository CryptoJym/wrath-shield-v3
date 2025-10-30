'use client';

/**
 * SpeechMiner Demo Component
 *
 * Interactive demo for testing SpeechMiner v2 confidence flag detection
 * Users can paste text and see real-time analysis results
 */

import { useState } from 'react';
import { analyzeText, AnalysisResult } from '@/lib/speechMiner';

export default function SpeechMinerDemo() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = () => {
    if (!input.trim()) return;

    setIsAnalyzing(true);
    try {
      const analysis = analyzeText(input);
      setResult(analysis);
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClear = () => {
    setInput('');
    setResult(null);
  };

  const getSeverityColor = (severity: number): string => {
    if (severity >= 4) return 'text-red-400';
    if (severity >= 3) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      'hedges': 'bg-yellow-500/20 text-yellow-300',
      'apologies': 'bg-red-500/20 text-red-300',
      'self-undervalue': 'bg-purple-500/20 text-purple-300',
      'permission-seek': 'bg-blue-500/20 text-blue-300',
      'assured-markers': 'bg-green-500/20 text-green-300',
      'personalization': 'bg-pink-500/20 text-pink-300',
    };
    return colors[category] || 'bg-gray-500/20 text-gray-300';
  };

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div>
        <label className="block text-sm font-medium text-green mb-2">
          Analyze Text for Confidence Flags
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste a transcript or message here to analyze confidence flags..."
          className="w-full h-32 px-4 py-2 bg-dark border border-secondary/30 rounded-lg text-white placeholder-secondary/50 focus:outline-none focus:border-green/50 resize-none"
        />
        <div className="flex gap-2 mt-2">
          <button
            onClick={handleAnalyze}
            disabled={!input.trim() || isAnalyzing}
            className="px-4 py-2 bg-green text-dark font-medium rounded-lg hover:bg-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isAnalyzing ? 'Analyzing...' : 'Analyze'}
          </button>
          <button
            onClick={handleClear}
            className="px-4 py-2 bg-secondary/20 text-secondary font-medium rounded-lg hover:bg-secondary/30 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Results Section */}
      {result && (
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card">
              <div className="text-xs text-secondary mb-1">Flags Detected</div>
              <div className="text-2xl font-bold text-white">{result.flagCount}</div>
            </div>
            <div className="card">
              <div className="text-xs text-secondary mb-1">Avg Severity</div>
              <div className="text-2xl font-bold text-white">
                {result.averageSeverity.toFixed(2)}
              </div>
            </div>
            <div className="card">
              <div className="text-xs text-secondary mb-1">Processing Time</div>
              <div className="text-2xl font-bold text-white">
                {result.processingTime.toFixed(1)}ms
              </div>
            </div>
            <div className="card">
              <div className="text-xs text-secondary mb-1">High Severity</div>
              <div className={`text-2xl font-bold ${result.hasHighSeverityFlags ? 'text-red-400' : 'text-green-400'}`}>
                {result.hasHighSeverityFlags ? 'Yes' : 'No'}
              </div>
            </div>
          </div>

          {/* Flags List */}
          {result.flags.length > 0 ? (
            <div className="card">
              <h3 className="text-lg font-semibold text-green mb-4">
                Detected Flags ({result.flags.length})
              </h3>
              <div className="space-y-3">
                {result.flags.map((flag, index) => (
                  <div
                    key={flag.suggestion_id}
                    className="p-3 bg-dark/50 border border-secondary/20 rounded-lg"
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${getCategoryColor(flag.category)}`}>
                            {flag.category}
                          </span>
                          <span className={`text-sm font-semibold ${getSeverityColor(flag.severity)}`}>
                            Severity {flag.severity}
                          </span>
                        </div>
                        <div className="text-sm text-white font-mono">
                          "{flag.phrase}"
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-secondary/70 italic">
                      {flag.snippet}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="text-center py-8">
                <div className="text-green text-lg font-semibold mb-2">
                  ✓ No Confidence Flags Detected
                </div>
                <p className="text-secondary text-sm">
                  This text shows confident, assertive communication
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
