'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ManifoldOrb,
  CalibrationOrb,
  MetaDimensionSpectrum,
  MetaDimensionRadar,
  DomainStateGrid,
  type MetaDimensions
} from '@/components/hyro/manifold';

/**
 * HYRO Manifold Dashboard
 *
 * The somatic mirror of cognitive topology.
 * This page doesn't just display data - it embodies the manifold.
 */

// Demo data for initial render (will be replaced with API data)
const DEMO_STATE_VECTOR = {
  coherence: 72,
  entropy: 58,
  generativity: 65,
};

const DEMO_META_DIMENSIONS: MetaDimensions = {
  manifold_fluidity: 0.68,
  multi_model_coherence: 0.72,
  identity_elasticity: 0.55,
  gradient_awareness: 0.63,
  entropy_intuition: 0.71,
  non_dual_resolution: 0.48,
  cooperative_generativity: 0.76,
};

const DEMO_DOMAINS = [
  {
    domain: 'math',
    stateVector: { coherence: 75, entropy: 52, generativity: 68, n_items_used: 24, ci_low: 65, ci_high: 85 },
    zpdRecommendation: { content_type: 'transfer_task', scaffolding_level: 'minimal', rationale: 'Strong foundation allows transfer challenges' },
  },
  {
    domain: 'reading',
    stateVector: { coherence: 82, entropy: 61, generativity: 70, n_items_used: 31, ci_low: 72, ci_high: 92 },
    zpdRecommendation: { content_type: 'novel_ambiguous', scaffolding_level: 'minimal', rationale: 'Ready for complex, ambiguous texts' },
  },
  {
    domain: 'science',
    stateVector: { coherence: 65, entropy: 70, generativity: 58, n_items_used: 18, ci_low: 50, ci_high: 80 },
    zpdRecommendation: { content_type: 'balanced', scaffolding_level: 'moderate', rationale: 'Balanced growth across dimensions' },
  },
  {
    domain: 'coding',
    stateVector: { coherence: 78, entropy: 48, generativity: 72, n_items_used: 15, ci_low: 60, ci_high: 90 },
    zpdRecommendation: { content_type: 'structured_practice', scaffolding_level: 'moderate', rationale: 'Build entropy tolerance through guided exploration' },
  },
  {
    domain: 'critical_thinking',
    stateVector: { coherence: 55, entropy: 65, generativity: 52, n_items_used: 12, ci_low: 40, ci_high: 70 },
    zpdRecommendation: { content_type: 'foundational', scaffolding_level: 'significant', rationale: 'Strengthen foundational coherence first' },
  },
  {
    domain: 'problem_solving',
    stateVector: { coherence: 70, entropy: 58, generativity: 75, n_items_used: 20, ci_low: 58, ci_high: 82 },
    zpdRecommendation: { content_type: 'transfer_task', scaffolding_level: 'minimal', rationale: 'High generativity supports transfer' },
  },
];

export default function ManifoldPage() {
  const [loading, setLoading] = useState(true);
  const [manifoldData, setManifoldData] = useState<any>(null);
  const [showCalibration, setShowCalibration] = useState(true);

  // Load manifold data from API
  useEffect(() => {
    async function loadManifoldData() {
      try {
        const response = await fetch('/api/hyro/state?action=manifold');
        if (response.ok) {
          const data = await response.json();

          if (data.aggregate) {
            setManifoldData({
              aggregate: data.aggregate,
              predicted: data.predicted_aggregate || { ...data.aggregate, entropy: data.aggregate.entropy + 10 },
              meta: data.meta_dimensions || DEMO_META_DIMENSIONS,
              domains: data.domain_vectors?.map((d: any) => ({
                domain: d.stat_name,
                stateVector: {
                  coherence: d.coherence,
                  entropy: d.entropy,
                  generativity: d.generativity,
                  n_items_used: d.n_items_used || 0,
                  ci_low: d.ci_low,
                  ci_high: d.ci_high,
                },
                zpdRecommendation: d.zpd_recommendation ? JSON.parse(d.zpd_recommendation) : undefined
              })) || DEMO_DOMAINS,
            });
          }
        } else {
          // Fallback to demo data if API fails
          throw new Error('API returned non-200');
        }
      } catch (error) {
        console.error('Failed to load manifold data:', error);
        setManifoldData({
          aggregate: DEMO_STATE_VECTOR,
          predicted: { ...DEMO_STATE_VECTOR, entropy: 80 },
          meta: DEMO_META_DIMENSIONS,
          domains: DEMO_DOMAINS,
        });
      } finally {
        setLoading(false);
      }
    }

    loadManifoldData();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      {/* Loading Overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black"
            exit={{ opacity: 0 }}
          >
            <ManifoldOrb stateVector={DEMO_STATE_VECTOR} size="md" />
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-8 text-zinc-500 font-light tracking-widest uppercase text-sm"
            >
              Calibrating Manifold State...
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      {!loading && manifoldData && (
        <div className="relative z-10 container mx-auto px-4 py-8 h-screen flex flex-col">

          {/* Header & Controls */}
          <header className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-500">
                Hyro Manifold
              </h1>
              <p className="text-zinc-500 mt-2 max-w-md">
                Visualizing the generative transfer capacity of your neural architecture.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowCalibration(!showCalibration)}
                className={`px-4 py-2 rounded-full text-xs uppercase tracking-widest border transition-all ${showCalibration
                  ? 'bg-zinc-800 border-zinc-600 text-white'
                  : 'bg-transparent border-zinc-800 text-zinc-600 hover:border-zinc-600'
                  }`}
              >
                {showCalibration ? 'Hide Calibration' : 'Show Calibration'}
              </button>
            </div>
          </header>

          <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-8 min-h-0">

            {/* Left Column: Meta Dimensions */}
            <div className="xl:col-span-3 flex flex-col gap-6 overflow-y-auto pr-2">
              <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800/50 backdrop-blur-sm flex justify-center">
                {/* Radar Chart */}
                <MetaDimensionRadar dimensions={manifoldData.meta} size={280} />
              </div>

              <div className="flex-1 bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800/50 backdrop-blur-sm">
                <MetaDimensionSpectrum dimensions={manifoldData.meta} />
              </div>
            </div>

            {/* Center Column: The Manifold Orb */}
            <div className="xl:col-span-5 flex flex-col items-center justify-center relative">
              {/* Background Glow */}
              <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 via-purple-900/10 to-transparent rounded-full blur-3xl" />

              <CalibrationOrb
                actualState={manifoldData.aggregate}
                predictedState={manifoldData.predicted}
                size="xl"
                showCalibration={showCalibration}
              />

              {/* State Vector Readout */}
              <div className="mt-12 grid grid-cols-3 gap-8 text-center relative z-20">
                <div>
                  <div className="text-3xl font-light text-blue-400">{Math.round(manifoldData.aggregate.coherence)}</div>
                  <div className="text-xs uppercase tracking-widest text-zinc-500 mt-2">Coherence</div>
                </div>
                <div>
                  <div className="text-3xl font-light text-purple-400">{Math.round(manifoldData.aggregate.entropy)}</div>
                  <div className="text-xs uppercase tracking-widest text-zinc-500 mt-2">Entropy</div>
                </div>
                <div>
                  <div className="text-3xl font-light text-amber-400">{Math.round(manifoldData.aggregate.generativity)}</div>
                  <div className="text-xs uppercase tracking-widest text-zinc-500 mt-2">Generativity</div>
                </div>
              </div>
            </div>

            {/* Right Column: Domain States */}
            <div className="xl:col-span-4 overflow-y-auto pl-2">
              <DomainStateGrid domains={manifoldData.domains} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
