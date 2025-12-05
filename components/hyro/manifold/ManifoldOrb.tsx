'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

/**
 * ManifoldOrb: The Somatic Mirror of the 3D State Vector
 *
 * This orb IS what it measures:
 * - Coherence (C): Crystal clarity, geometric precision, convergent form
 * - Entropy (E): Particle dispersion, breathing space, adaptive edges
 * - Generativity (G): Bloom, radiance, emergent glow
 *
 * The orb breathes. It pulses. It responds to where you ARE in the manifold.
 */

interface StateVector {
  coherence: number;    // 0-100
  entropy: number;      // 0-100
  generativity: number; // 0-100
}

interface ManifoldOrbProps {
  stateVector: StateVector;
  domain?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showLabels?: boolean;
  interactive?: boolean;
  variant?: 'default' | 'ghost';
  className?: string;
}

// Somatic color mapping: each dimension has a spiritual hue
const DIMENSION_COLORS = {
  coherence: { h: 210, name: 'Sapphire' },     // Deep blue - unity, integration
  entropy: { h: 280, name: 'Amethyst' },       // Purple - possibility, openness
  generativity: { h: 45, name: 'Amber' },      // Gold - creation, emergence
};

const SIZE_MAP = {
  sm: { orb: 120, glow: 160, particles: 8 },
  md: { orb: 180, glow: 240, particles: 12 },
  lg: { orb: 300, glow: 400, particles: 20 }, // Increased from 260/340
  xl: { orb: 420, glow: 560, particles: 32 }, // Increased from 340/440
};

export function ManifoldOrb({
  stateVector,
  domain,
  size = 'lg',
  showLabels = true,
  interactive = true,
  variant = 'default',
  className = '',
}: ManifoldOrbProps) {
  const { coherence, entropy, generativity } = stateVector;
  const dimensions = SIZE_MAP[size];

  // Calculate somatic properties from state vector
  const somaticState = useMemo(() => {
    // Coherence affects: form sharpness, inner structure visibility
    const formClarity = coherence / 100;

    // Entropy affects: particle dispersion, edge softness, breathing amplitude
    const breathingAmplitude = 0.02 + (entropy / 100) * 0.08; // 2-10% scale
    const edgeSoftness = 20 + (entropy / 100) * 40; // blur 20-60px
    const particleSpread = 0.3 + (entropy / 100) * 0.7; // 30-100% of orb radius

    // Generativity affects: glow intensity, bloom, radiance
    const glowIntensity = 0.3 + (generativity / 100) * 0.7;
    const bloomRadius = 1 + (generativity / 100) * 0.5; // 1-1.5x

    // Combined color - blend based on relative strengths
    const total = coherence + entropy + generativity;
    const cWeight = coherence / total;
    const eWeight = entropy / total;
    const gWeight = generativity / total;

    // Weighted hue blend
    const dominantHue =
      DIMENSION_COLORS.coherence.h * cWeight +
      DIMENSION_COLORS.entropy.h * eWeight +
      DIMENSION_COLORS.generativity.h * gWeight;

    // Breathing speed inversely related to coherence (more coherent = calmer)
    const breathingDuration = 3 + (coherence / 100) * 3; // 3-6 seconds

    return {
      formClarity,
      breathingAmplitude,
      breathingDuration,
      edgeSoftness,
      particleSpread,
      glowIntensity,
      bloomRadius,
      dominantHue,
      cWeight,
      eWeight,
      gWeight,
    };
  }, [coherence, entropy, generativity]);

  // Generate entropy particles
  const particles = useMemo(() => {
    return Array.from({ length: dimensions.particles }, (_, i) => {
      const angle = (i / dimensions.particles) * Math.PI * 2;
      const baseRadius = dimensions.orb * 0.5 * somaticState.particleSpread;
      const variance = 0.7 + Math.random() * 0.6;
      const radius = baseRadius * variance;
      const size = 2 + Math.random() * 4;
      const delay = Math.random() * 2;
      const duration = 3 + Math.random() * 4;

      return {
        id: i,
        angle,
        radius,
        size,
        delay,
        duration,
        opacity: 0.3 + Math.random() * 0.5,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      };
    });
  }, [dimensions, somaticState.particleSpread]);

  const containerSize = dimensions.glow;
  const orbSize = dimensions.orb;
  const isGhost = variant === 'ghost';

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: containerSize, height: containerSize }}
    >
      {/* Background void - the space of potential (Hidden for ghost) */}
      {!isGhost && (
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle,
              hsla(${somaticState.dominantHue}, 30%, 8%, 0.9) 0%,
              hsla(${somaticState.dominantHue}, 20%, 3%, 0.95) 50%,
              transparent 70%
            )`,
          }}
        />
      )}

      {/* Entropy particles - the field of possibility (Hidden for ghost) */}
      {!isGhost && (
        <div className="absolute inset-0 flex items-center justify-center">
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute rounded-full"
              style={{
                width: particle.size,
                height: particle.size,
                background: `hsla(${somaticState.dominantHue + (particle.id % 3) * 30}, 70%, 60%, ${particle.opacity})`,
                boxShadow: `0 0 ${particle.size * 2}px hsla(${somaticState.dominantHue}, 80%, 50%, 0.5)`,
                left: '50%',
                top: '50%',
                marginLeft: -particle.size / 2,
                marginTop: -particle.size / 2,
              }}
              animate={{
                x: [
                  Math.cos(particle.angle) * (orbSize * 0.6),
                  Math.cos(particle.angle + Math.PI) * (orbSize * 0.8),
                  Math.cos(particle.angle + Math.PI * 2) * (orbSize * 0.6),
                ],
                y: [
                  Math.sin(particle.angle) * (orbSize * 0.6),
                  Math.sin(particle.angle + Math.PI) * (orbSize * 0.8),
                  Math.sin(particle.angle + Math.PI * 2) * (orbSize * 0.6),
                ],
                opacity: [particle.opacity * 0.3, particle.opacity, particle.opacity * 0.3],
                scale: [0.8, 1.5, 0.8],
              }}
              transition={{
                duration: particle.duration * 2, // Slower, more majestic orbits
                delay: particle.delay,
                repeat: Infinity,
                ease: 'linear', // Continuous orbit
              }}
            />
          ))}
        </div>
      )}

      {/* Generativity bloom - the outer radiance (Reduced for ghost) */}
      {!isGhost && (
        <motion.div
          className="absolute rounded-full"
          style={{
            width: orbSize * somaticState.bloomRadius * 1.3,
            height: orbSize * somaticState.bloomRadius * 1.3,
            background: `radial-gradient(circle,
              hsla(${DIMENSION_COLORS.generativity.h}, 80%, 50%, ${somaticState.glowIntensity * 0.3}) 0%,
              hsla(${somaticState.dominantHue}, 60%, 40%, ${somaticState.glowIntensity * 0.15}) 40%,
              transparent 70%
            )`,
            filter: `blur(${somaticState.edgeSoftness * 0.5}px)`,
          }}
          animate={{
            scale: [1, 1 + somaticState.breathingAmplitude * 0.5, 1],
            opacity: [0.6, 0.9, 0.6],
          }}
          transition={{
            duration: somaticState.breathingDuration * 1.2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      {/* Primary orb - the breathing form */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: orbSize,
          height: orbSize,
          background: isGhost
            ? `
              radial-gradient(circle,
                transparent 40%,
                hsla(${somaticState.dominantHue}, 50%, 60%, 0.1) 80%,
                hsla(${somaticState.dominantHue}, 60%, 70%, 0.3) 100%
              )
            `
            : `
              radial-gradient(ellipse 70% 50% at 30% 30%,
                hsla(${somaticState.dominantHue}, 60%, 70%, 0.8) 0%,
                transparent 50%
              ),
              radial-gradient(circle,
                hsla(${DIMENSION_COLORS.coherence.h}, 50%, 45%, ${somaticState.formClarity}) 0%,
                hsla(${somaticState.dominantHue}, 40%, 30%, 0.9) 50%,
                hsla(${somaticState.dominantHue}, 30%, 15%, 0.95) 100%
              )
            `,
          boxShadow: isGhost
            ? `0 0 0 1px hsla(${somaticState.dominantHue}, 50%, 60%, 0.3)`
            : `
              inset 0 0 ${orbSize * 0.2}px hsla(${somaticState.dominantHue}, 50%, 50%, 0.3),
              0 0 ${orbSize * 0.4}px hsla(${somaticState.dominantHue}, 70%, 40%, ${somaticState.glowIntensity}),
              0 0 ${orbSize * 0.8}px hsla(${somaticState.dominantHue}, 80%, 30%, ${somaticState.glowIntensity * 0.5})
            `,
          filter: isGhost ? 'none' : `blur(${somaticState.edgeSoftness * 0.1}px)`,
          border: isGhost ? `1px dashed hsla(${somaticState.dominantHue}, 50%, 60%, 0.4)` : 'none',
        }}
        animate={{
          scale: [1, 1 + somaticState.breathingAmplitude, 1],
        }}
        transition={{
          duration: somaticState.breathingDuration,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        whileHover={interactive ? { scale: 1.05 } : undefined}
      >
        {/* Inner coherence structure - sacred geometry */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 100"
          style={{ opacity: somaticState.formClarity * 0.6 }}
        >
          <defs>
            <linearGradient id="coherenceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={`hsla(${DIMENSION_COLORS.coherence.h}, 70%, 70%, 0.8)`} />
              <stop offset="100%" stopColor={`hsla(${DIMENSION_COLORS.coherence.h}, 50%, 40%, 0.4)`} />
            </linearGradient>
          </defs>
          {/* Metatron's cube simplified - coherent knowledge structure */}
          <motion.circle
            cx="50" cy="50" r="30"
            fill="none"
            stroke="url(#coherenceGrad)"
            strokeWidth="0.5"
            animate={{ rotate: 360 }}
            transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: 'center' }}
          />
          <motion.polygon
            points="50,20 80,65 20,65"
            fill="none"
            stroke="url(#coherenceGrad)"
            strokeWidth="0.3"
            animate={{ rotate: -360 }}
            transition={{ duration: 90, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: 'center' }}
          />
          <motion.polygon
            points="50,80 80,35 20,35"
            fill="none"
            stroke="url(#coherenceGrad)"
            strokeWidth="0.3"
            animate={{ rotate: 360 }}
            transition={{ duration: 120, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: 'center' }}
          />
        </svg>
      </motion.div>

      {/* Central generativity spark */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: orbSize * 0.15,
          height: orbSize * 0.15,
          background: `radial-gradient(circle,
            hsla(${DIMENSION_COLORS.generativity.h}, 90%, 70%, ${somaticState.glowIntensity}) 0%,
            hsla(${DIMENSION_COLORS.generativity.h}, 80%, 50%, ${somaticState.glowIntensity * 0.5}) 50%,
            transparent 100%
          )`,
          boxShadow: `0 0 ${orbSize * 0.1}px hsla(${DIMENSION_COLORS.generativity.h}, 100%, 60%, ${somaticState.glowIntensity})`,
        }}
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.7, 1, 0.7],
        }}
        transition={{
          duration: somaticState.breathingDuration * 0.7,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Dimension labels */}
      {showLabels && (
        <>
          {/* Coherence indicator - top */}
          <div
            className="absolute flex flex-col items-center"
            style={{ top: '5%', left: '50%', transform: 'translateX(-50%)' }}
          >
            <span
              className="text-xs font-light tracking-widest uppercase"
              style={{ color: `hsla(${DIMENSION_COLORS.coherence.h}, 60%, 70%, 0.9)` }}
            >
              Coherence
            </span>
            <span
              className="text-lg font-semibold tabular-nums"
              style={{
                color: `hsla(${DIMENSION_COLORS.coherence.h}, 70%, 75%, 1)`,
                textShadow: `0 0 10px hsla(${DIMENSION_COLORS.coherence.h}, 80%, 50%, 0.5)`,
              }}
            >
              {Math.round(coherence)}
            </span>
          </div>

          {/* Entropy indicator - bottom left */}
          <div
            className="absolute flex flex-col items-center"
            style={{ bottom: '8%', left: '15%' }}
          >
            <span
              className="text-xs font-light tracking-widest uppercase"
              style={{ color: `hsla(${DIMENSION_COLORS.entropy.h}, 60%, 70%, 0.9)` }}
            >
              Entropy
            </span>
            <span
              className="text-lg font-semibold tabular-nums"
              style={{
                color: `hsla(${DIMENSION_COLORS.entropy.h}, 70%, 75%, 1)`,
                textShadow: `0 0 10px hsla(${DIMENSION_COLORS.entropy.h}, 80%, 50%, 0.5)`,
              }}
            >
              {Math.round(entropy)}
            </span>
          </div>

          {/* Generativity indicator - bottom right */}
          <div
            className="absolute flex flex-col items-center"
            style={{ bottom: '8%', right: '15%' }}
          >
            <span
              className="text-xs font-light tracking-widest uppercase"
              style={{ color: `hsla(${DIMENSION_COLORS.generativity.h}, 60%, 70%, 0.9)` }}
            >
              Generativity
            </span>
            <span
              className="text-lg font-semibold tabular-nums"
              style={{
                color: `hsla(${DIMENSION_COLORS.generativity.h}, 70%, 75%, 1)`,
                textShadow: `0 0 10px hsla(${DIMENSION_COLORS.generativity.h}, 80%, 50%, 0.5)`,
              }}
            >
              {Math.round(generativity)}
            </span>
          </div>

          {/* Domain label - center bottom */}
          {domain && (
            <div
              className="absolute"
              style={{ bottom: '-8%', left: '50%', transform: 'translateX(-50%)' }}
            >
              <span
                className="text-sm font-medium tracking-wide capitalize"
                style={{
                  color: `hsla(${somaticState.dominantHue}, 50%, 80%, 0.9)`,
                  textShadow: `0 0 8px hsla(${somaticState.dominantHue}, 60%, 40%, 0.6)`,
                }}
              >
                {domain}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ManifoldOrb;
