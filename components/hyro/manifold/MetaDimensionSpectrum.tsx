'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

/**
 * MetaDimensionSpectrum: The 7 Meta-Generative Capacities
 *
 * Each dimension is visualized with an animation that EMBODIES its meaning:
 * - manifold_fluidity: Flowing, morphing forms
 * - multi_model_coherence: Overlapping lenses
 * - identity_elasticity: Breathing expansion
 * - gradient_awareness: Velocity vectors
 * - entropy_intuition: Structure/chaos balance
 * - non_dual_resolution: Paradox holding (yin-yang)
 * - cooperative_generativity: Interconnecting threads
 */

export interface MetaDimensions {
  manifold_fluidity: number;
  multi_model_coherence: number;
  identity_elasticity: number;
  gradient_awareness: number;
  entropy_intuition: number;
  non_dual_resolution: number;
  cooperative_generativity: number;
}

interface MetaDimensionSpectrumProps {
  dimensions: MetaDimensions;
  showConfidence?: boolean;
  confidenceLevels?: Partial<Record<keyof MetaDimensions, 'low' | 'medium' | 'high'>>;
  compact?: boolean;
  className?: string;
}

// Each dimension has a color, icon concept, and somatic meaning
const DIMENSION_CONFIG: Record<keyof MetaDimensions, {
  label: string;
  shortLabel: string;
  hue: number;
  description: string;
  somaticVerb: string;
}> = {
  manifold_fluidity: {
    label: 'Manifold Fluidity',
    shortLabel: 'Fluidity',
    hue: 185,    // Cyan - flow, water
    description: 'Navigation across conceptual spaces',
    somaticVerb: 'flowing',
  },
  multi_model_coherence: {
    label: 'Multi-Model Coherence',
    shortLabel: 'Synthesis',
    hue: 270,    // Violet - integration, unity
    description: 'Holding multiple valid interpretations',
    somaticVerb: 'synthesizing',
  },
  identity_elasticity: {
    label: 'Identity Elasticity',
    shortLabel: 'Elasticity',
    hue: 140,    // Green - growth, adaptation
    description: 'Comfort with epistemic humility',
    somaticVerb: 'breathing',
  },
  gradient_awareness: {
    label: 'Gradient Awareness',
    shortLabel: 'Awareness',
    hue: 30,     // Orange - perception, velocity
    description: 'Sensing learning velocity',
    somaticVerb: 'sensing',
  },
  entropy_intuition: {
    label: 'Entropy Intuition',
    shortLabel: 'Intuition',
    hue: 300,    // Magenta - balance, intuition
    description: 'When structure helps vs. hinders',
    somaticVerb: 'balancing',
  },
  non_dual_resolution: {
    label: 'Non-Dual Resolution',
    shortLabel: 'Paradox',
    hue: 0,      // Red-to-Blue gradient - paradox
    description: 'Holding both/and without collapse',
    somaticVerb: 'holding',
  },
  cooperative_generativity: {
    label: 'Cooperative Generativity',
    shortLabel: 'Co-creation',
    hue: 50,     // Gold - co-creation, emergence
    description: 'Building on others generatively',
    somaticVerb: 'weaving',
  },
};

const DIMENSION_ORDER: (keyof MetaDimensions)[] = [
  'manifold_fluidity',
  'multi_model_coherence',
  'identity_elasticity',
  'gradient_awareness',
  'entropy_intuition',
  'non_dual_resolution',
  'cooperative_generativity',
];

export function MetaDimensionSpectrum({
  dimensions,
  showConfidence = false,
  confidenceLevels,
  compact = false,
  className = '',
}: MetaDimensionSpectrumProps) {
  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-1 h-6 rounded-full bg-gradient-to-b from-cyan-400 via-purple-500 to-amber-400" />
        <h3 className="text-sm font-medium tracking-wide text-zinc-300 uppercase">
          Meta-Generative Capacities
        </h3>
      </div>

      {/* Dimension bars */}
      <div className="flex flex-col gap-3">
        {DIMENSION_ORDER.map((key, index) => {
          const config = DIMENSION_CONFIG[key];
          const value = dimensions[key] * 100; // Convert 0-1 to 0-100
          const confidence = confidenceLevels?.[key] || 'medium';

          return (
            <DimensionBar
              key={key}
              dimension={key}
              value={value}
              config={config}
              confidence={showConfidence ? confidence : undefined}
              delay={index * 0.1}
              compact={compact}
            />
          );
        })}
      </div>
    </div>
  );
}

interface DimensionBarProps {
  dimension: keyof MetaDimensions;
  value: number;
  config: typeof DIMENSION_CONFIG[keyof MetaDimensions];
  confidence?: 'low' | 'medium' | 'high';
  delay: number;
  compact: boolean;
}

function DimensionBar({ dimension, value, config, confidence, delay, compact }: DimensionBarProps) {
  // Generate the unique somatic animation for this dimension
  const somaticAnimation = useMemo(() => {
    switch (dimension) {
      case 'manifold_fluidity':
        // Flowing wave animation
        return {
          background: `linear-gradient(90deg,
            hsla(${config.hue}, 70%, 50%, 0.9) 0%,
            hsla(${config.hue + 20}, 80%, 60%, 0.8) 50%,
            hsla(${config.hue}, 70%, 50%, 0.9) 100%
          )`,
          animate: { backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] },
          backgroundSize: '200% 100%',
        };

      case 'multi_model_coherence':
        // Layered overlapping effect
        return {
          background: `
            linear-gradient(90deg, hsla(${config.hue}, 60%, 55%, 0.7), hsla(${config.hue + 30}, 70%, 45%, 0.7)),
            linear-gradient(90deg, hsla(${config.hue - 30}, 50%, 50%, 0.5), hsla(${config.hue}, 60%, 55%, 0.5))
          `,
          animate: { opacity: [0.7, 1, 0.7] },
        };

      case 'identity_elasticity':
        // Breathing expansion
        return {
          background: `linear-gradient(90deg,
            hsla(${config.hue}, 60%, 45%, 0.9),
            hsla(${config.hue + 20}, 70%, 55%, 0.9)
          )`,
          animate: { scaleY: [1, 1.15, 1] },
        };

      case 'gradient_awareness':
        // Velocity arrows / moving gradient
        return {
          background: `linear-gradient(135deg,
            hsla(${config.hue}, 80%, 55%, 0.9) 0%,
            hsla(${config.hue}, 60%, 40%, 0.7) 100%
          )`,
          animate: { x: ['-5%', '5%', '-5%'] },
        };

      case 'entropy_intuition':
        // Structure/chaos shimmer
        return {
          background: `linear-gradient(90deg,
            hsla(${config.hue}, 70%, 50%, 0.9),
            hsla(${config.hue + 60}, 60%, 55%, 0.7),
            hsla(${config.hue}, 70%, 50%, 0.9)
          )`,
          animate: { filter: ['blur(0px)', 'blur(2px)', 'blur(0px)'] },
          backgroundSize: '200% 100%',
        };

      case 'non_dual_resolution':
        // Yin-yang gradient oscillation
        return {
          background: `linear-gradient(90deg,
            hsla(220, 70%, 50%, 0.9) 0%,
            hsla(0, 70%, 50%, 0.9) 50%,
            hsla(220, 70%, 50%, 0.9) 100%
          )`,
          animate: { backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] },
          backgroundSize: '200% 100%',
        };

      case 'cooperative_generativity':
        // Weaving, interconnecting pulse
        return {
          background: `linear-gradient(90deg,
            hsla(${config.hue}, 80%, 55%, 0.9),
            hsla(${config.hue + 40}, 70%, 50%, 0.8),
            hsla(${config.hue}, 80%, 55%, 0.9)
          )`,
          animate: { scale: [1, 1.02, 1], opacity: [0.85, 1, 0.85] },
          backgroundSize: '150% 100%',
        };

      default:
        return {
          background: `hsla(${config.hue}, 60%, 50%, 0.9)`,
          animate: {},
        };
    }
  }, [dimension, config.hue]);

  const confidenceOpacity = confidence === 'low' ? 0.5 : confidence === 'medium' ? 0.75 : 1;
  const barHeight = compact ? 'h-2' : 'h-3';

  return (
    <motion.div
      className="group relative"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      {/* Label row */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          {/* Dimension indicator dot */}
          <motion.div
            className="w-2 h-2 rounded-full"
            style={{ background: `hsla(${config.hue}, 70%, 55%, 1)` }}
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity, delay: delay * 2 }}
          />
          <span
            className="text-xs font-medium tracking-wide"
            style={{ color: `hsla(${config.hue}, 50%, 75%, 0.9)` }}
          >
            {compact ? config.shortLabel : config.label}
          </span>
        </div>
        <span
          className="text-xs font-semibold tabular-nums"
          style={{ color: `hsla(${config.hue}, 60%, 70%, ${confidenceOpacity})` }}
        >
          {Math.round(value)}
        </span>
      </div>

      {/* Bar container */}
      <div
        className={`relative ${barHeight} rounded-full overflow-hidden`}
        style={{
          background: `hsla(${config.hue}, 20%, 15%, 0.6)`,
          boxShadow: `inset 0 1px 3px hsla(0, 0%, 0%, 0.4)`,
        }}
      >
        {/* Filled bar with somatic animation */}
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full ${barHeight}`}
          style={{
            width: `${value}%`,
            background: somaticAnimation.background,
            backgroundSize: somaticAnimation.backgroundSize || '100% 100%',
            opacity: confidenceOpacity,
            boxShadow: `
              0 0 10px hsla(${config.hue}, 80%, 50%, 0.3),
              inset 0 1px 0 hsla(255, 100%, 100%, 0.2)
            `,
          }}
          initial={{ width: 0 }}
          animate={{
            width: `${value}%`,
            ...somaticAnimation.animate,
          }}
          transition={{
            width: { delay: delay + 0.2, duration: 0.8, ease: 'easeOut' },
            ...(Object.keys(somaticAnimation.animate || {}).length > 0
              ? { duration: 3, repeat: Infinity, ease: 'easeInOut' }
              : {}),
          }}
        />

        {/* Confidence indicator underlay */}
        {confidence && (
          <div
            className="absolute inset-y-0 right-0 flex items-center justify-end pr-2"
            style={{ width: `${100 - value}%` }}
          >
            {confidence === 'low' && (
              <span className="text-[8px] text-zinc-500 uppercase tracking-wider">
                Low Evidence
              </span>
            )}
          </div>
        )}
      </div>

      {/* Hover tooltip */}
      {!compact && (
        <motion.div
          className="absolute left-0 -bottom-6 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{ color: `hsla(${config.hue}, 40%, 70%, 0.8)` }}
        >
          <span className="text-[10px] italic">
            {config.somaticVerb}: {config.description}
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * Compact radial visualization for meta dimensions
 */
export function MetaDimensionRadar({
  dimensions,
  size = 300, // Increased default size
  className = '',
}: {
  dimensions: MetaDimensions;
  size?: number;
  className?: string;
}) {
  const center = size / 2;
  const maxRadius = (size / 2) * 0.75; // Reduced radius slightly to give more room for labels

  const points = useMemo(() => {
    return DIMENSION_ORDER.map((key, index) => {
      const angle = (index / DIMENSION_ORDER.length) * Math.PI * 2 - Math.PI / 2;
      const value = dimensions[key];
      const radius = value * maxRadius;

      // Push labels further out
      const labelRadius = maxRadius + 25;

      return {
        key,
        x: center + Math.cos(angle) * radius,
        y: center + Math.sin(angle) * radius,
        labelX: center + Math.cos(angle) * labelRadius,
        labelY: center + Math.sin(angle) * labelRadius,
        config: DIMENSION_CONFIG[key],
        value,
      };
    });
  }, [dimensions, center, maxRadius]);

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ') + ' Z';

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="overflow-visible">
        {/* Background rings */}
        {[0.25, 0.5, 0.75, 1].map((ring) => (
          <circle
            key={ring}
            cx={center}
            cy={center}
            r={maxRadius * ring}
            fill="none"
            stroke="hsla(220, 30%, 30%, 0.3)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        ))}

        {/* Axis lines */}
        {points.map((p) => (
          <line
            key={p.key}
            x1={center}
            y1={center}
            x2={center + Math.cos((DIMENSION_ORDER.indexOf(p.key) / DIMENSION_ORDER.length) * Math.PI * 2 - Math.PI / 2) * maxRadius}
            y2={center + Math.sin((DIMENSION_ORDER.indexOf(p.key) / DIMENSION_ORDER.length) * Math.PI * 2 - Math.PI / 2) * maxRadius}
            stroke={`hsla(${p.config.hue}, 40%, 40%, 0.3)`}
            strokeWidth="1"
          />
        ))}

        {/* Filled area */}
        <motion.path
          d={pathD}
          fill="url(#radarGradient)"
          stroke="hsla(220, 60%, 60%, 0.8)"
          strokeWidth="2"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 0.7, scale: 1 }}
          transition={{ duration: 0.8 }}
          style={{ transformOrigin: 'center' }}
        />

        {/* Gradient definition */}
        <defs>
          <radialGradient id="radarGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsla(220, 70%, 50%, 0.6)" />
            <stop offset="100%" stopColor="hsla(280, 60%, 40%, 0.3)" />
          </radialGradient>
        </defs>

        {/* Dimension points */}
        {points.map((p, i) => (
          <motion.circle
            key={p.key}
            cx={p.x}
            cy={p.y}
            r={5}
            fill={`hsla(${p.config.hue}, 70%, 55%, 1)`}
            stroke="white"
            strokeWidth="1.5"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.1 + 0.5 }}
          />
        ))}
      </svg>

      {/* Labels with background pills for readability */}
      {points.map((p) => (
        <div
          key={`label-${p.key}`}
          className="absolute px-2 py-1 rounded-md backdrop-blur-md border border-white/10 shadow-sm"
          style={{
            left: p.labelX,
            top: p.labelY,
            transform: 'translate(-50%, -50%)',
            background: `hsla(220, 30%, 10%, 0.7)`,
            zIndex: 10,
          }}
        >
          <div
            className="text-[10px] font-semibold whitespace-nowrap"
            style={{ color: `hsla(${p.config.hue}, 70%, 75%, 1)` }}
          >
            {p.config.shortLabel}
          </div>
          <div className="text-[9px] text-zinc-400 text-center">
            {Math.round(p.value * 100)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default MetaDimensionSpectrum;
