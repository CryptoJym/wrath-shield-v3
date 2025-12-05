'use client';

import React from 'react';
import { motion } from 'framer-motion';

/**
 * DomainStateCard: Compact visualization of a domain's state vector
 *
 * Shows a mini-orb with C/E/G values and ZPD recommendation
 */

interface StateVector {
  coherence: number;
  entropy: number;
  generativity: number;
  n_items_used: number;
  ci_low?: number;
  ci_high?: number;
}

interface DomainStateCardProps {
  domain: string;
  stateVector: StateVector;
  zpdRecommendation?: {
    content_type: string;
    scaffolding_level: string;
    rationale: string;
  };
  onClick?: () => void;
  isSelected?: boolean;
  className?: string;
}

const DOMAIN_CONFIG: Record<string, { icon: string; hue: number }> = {
  math: { icon: '∑', hue: 210 },
  reading: { icon: '📖', hue: 45 },
  science: { icon: '🔬', hue: 140 },
  coding: { icon: '<>', hue: 280 },
  study_skills: { icon: '📚', hue: 30 },
  critical_thinking: { icon: '💭', hue: 300 },
  technology: { icon: '💻', hue: 185 },
  problem_solving: { icon: '🧩', hue: 350 },
};

const ZPD_LABELS: Record<string, { label: string; color: string }> = {
  novel_ambiguous: { label: 'Ready for Challenge', color: 'text-cyan-400' },
  structured_practice: { label: 'Needs Structure', color: 'text-amber-400' },
  transfer_task: { label: 'Ready for Transfer', color: 'text-emerald-400' },
  foundational: { label: 'Build Foundations', color: 'text-rose-400' },
  balanced: { label: 'Balanced Growth', color: 'text-violet-400' },
};

export function DomainStateCard({
  domain,
  stateVector,
  zpdRecommendation,
  onClick,
  isSelected = false,
  className = '',
}: DomainStateCardProps) {
  const { coherence, entropy, generativity, n_items_used } = stateVector;
  const config = DOMAIN_CONFIG[domain] || { icon: '◈', hue: 220 };

  // Calculate composite color from C/E/G
  const avgValue = (coherence + entropy + generativity) / 3;
  const glowIntensity = avgValue / 100;

  // Dominant dimension determines primary hue shift
  const maxDim = Math.max(coherence, entropy, generativity);
  const dominantHue =
    maxDim === coherence ? 210 :
      maxDim === entropy ? 280 : 45;

  const zpdInfo = zpdRecommendation
    ? ZPD_LABELS[zpdRecommendation.content_type] || { label: 'Unknown', color: 'text-zinc-400' }
    : null;

  return (
    <motion.div
      className={`
        relative group cursor-pointer overflow-hidden rounded-xl border border-white/5
        ${isSelected ? 'ring-2 ring-cyan-400/50' : ''}
        ${className}
      `}
      style={{
        background: `linear-gradient(135deg,
          hsla(${config.hue}, 20%, 10%, 0.95) 0%,
          hsla(${config.hue}, 15%, 5%, 0.98) 100%
        )`,
        boxShadow: isSelected
          ? `0 0 30px hsla(${config.hue}, 70%, 50%, 0.3)`
          : `0 4px 20px hsla(0, 0%, 0%, 0.3)`,
      }}
      onClick={onClick}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Background glow based on state */}
      <motion.div
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background: `radial-gradient(circle at 30% 30%,
            hsla(${dominantHue}, 60%, 50%, ${glowIntensity * 0.15}) 0%,
            transparent 60%
          )`,
        }}
      />

      <div className="relative p-5">
        {/* Header: Domain icon and name */}
        <div className="flex items-center gap-4 mb-5">
          <motion.div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-lg"
            style={{
              background: `linear-gradient(135deg,
                hsla(${config.hue}, 50%, 35%, 0.8),
                hsla(${config.hue}, 40%, 20%, 0.9)
              )`,
              border: `1px solid hsla(${config.hue}, 50%, 50%, 0.3)`,
            }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            {config.icon}
          </motion.div>
          <div>
            <h3 className="text-lg font-bold text-white capitalize tracking-wide">
              {domain.replace(/_/g, ' ')}
            </h3>
            <span className="text-xs font-medium text-zinc-400">
              {n_items_used} observations
            </span>
          </div>
        </div>

        {/* Mini state vector bars */}
        <div className="space-y-3 mb-5">
          <StateBar label="Coherence" value={coherence} hue={210} />
          <StateBar label="Entropy" value={entropy} hue={280} />
          <StateBar label="Generativity" value={generativity} hue={45} />
        </div>

        {/* ZPD Recommendation */}
        {zpdInfo && (
          <div className="pt-4 border-t border-white/10">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider bg-white/5 ${zpdInfo.color}`}>
                  {zpdInfo.label}
                </span>
              </div>
              {zpdRecommendation?.scaffolding_level && (
                <p className="text-xs text-zinc-400 leading-relaxed pl-1">
                  <span className="text-zinc-500">Scaffolding:</span> {zpdRecommendation.scaffolding_level}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Confidence indicator overlay */}
      {stateVector.ci_low !== undefined && stateVector.ci_high !== undefined && (
        <div className="absolute top-3 right-3">
          <ConfidenceIndicator
            ciLow={stateVector.ci_low}
            ciHigh={stateVector.ci_high}
            avg={avgValue}
          />
        </div>
      )}
    </motion.div>
  );
}

function StateBar({ label, value, hue }: { label: string; value: number; hue: number }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="text-[10px] font-bold w-16 uppercase tracking-wider"
        style={{ color: `hsla(${hue}, 70%, 75%, 0.9)` }}
      >
        {label}
      </span>
      <div
        className="flex-1 h-2 rounded-full overflow-hidden bg-black/40"
      >
        <motion.div
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(90deg,
              hsla(${hue}, 70%, 50%, 0.9),
              hsla(${hue}, 60%, 60%, 0.8)
            )`,
            boxShadow: `0 0 8px hsla(${hue}, 80%, 50%, 0.4)`,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <span
        className="text-xs font-bold tabular-nums w-8 text-right"
        style={{ color: `hsla(${hue}, 50%, 80%, 0.9)` }}
      >
        {Math.round(value)}
      </span>
    </div>
  );
}

function ConfidenceIndicator({ ciLow, ciHigh, avg }: { ciLow: number; ciHigh: number; avg: number }) {
  const spread = ciHigh - ciLow;
  // Narrow spread = high confidence, wide spread = low confidence
  const confidence = spread < 20 ? 'high' : spread < 40 ? 'medium' : 'low';

  const colors = {
    high: 'bg-emerald-400 shadow-emerald-400/50',
    medium: 'bg-amber-400 shadow-amber-400/50',
    low: 'bg-rose-400 shadow-rose-400/50',
  };

  return (
    <div className="flex items-center gap-1.5" title={`Confidence: ${ciLow.toFixed(0)}-${ciHigh.toFixed(0)}`}>
      <div className={`w-2 h-2 rounded-full shadow-lg ${colors[confidence]}`} />
    </div>
  );
}

/**
 * Grid of domain cards
 */
export function DomainStateGrid({
  domains,
  selectedDomain,
  onSelectDomain,
  className = '',
}: {
  domains: Array<{
    domain: string;
    stateVector: StateVector;
    zpdRecommendation?: {
      content_type: string;
      scaffolding_level: string;
      rationale: string;
    };
  }>;
  selectedDomain?: string;
  onSelectDomain?: (domain: string) => void;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4 ${className}`}>
      {domains.map((item, index) => (
        <motion.div
          key={item.domain}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <DomainStateCard
            domain={item.domain}
            stateVector={item.stateVector}
            zpdRecommendation={item.zpdRecommendation}
            isSelected={selectedDomain === item.domain}
            onClick={() => onSelectDomain?.(item.domain)}
          />
        </motion.div>
      ))}
    </div>
  );
}

export default DomainStateCard;
