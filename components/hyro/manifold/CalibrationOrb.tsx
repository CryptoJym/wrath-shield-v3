'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ManifoldOrb } from './ManifoldOrb';

interface StateVector {
    coherence: number;
    entropy: number;
    generativity: number;
}

interface CalibrationOrbProps {
    actualState: StateVector;
    predictedState: StateVector;
    domain?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    showCalibration?: boolean;
    className?: string;
}

export function CalibrationOrb({
    actualState,
    predictedState,
    domain,
    size = 'lg',
    showCalibration = true,
    className = '',
}: CalibrationOrbProps) {
    return (
        <div className={`relative flex items-center justify-center ${className}`}>
            {/* The Ghost Orb (Predicted State) */}
            {showCalibration && (
                <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none mix-blend-screen">
                    <ManifoldOrb
                        stateVector={predictedState}
                        size={size}
                        showLabels={false}
                        interactive={false}
                        variant="ghost"
                    />

                    {/* Label for predicted state */}
                    <motion.div
                        className="absolute top-[15%] right-[15%] bg-zinc-900/80 backdrop-blur px-2 py-1 rounded border border-zinc-700/50"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1 }}
                    >
                        <span className="text-[10px] text-zinc-400 uppercase tracking-widest">Predicted</span>
                    </motion.div>
                </div>
            )}

            {/* The Real Orb (Produced State) */}
            <div className="relative z-10">
                <ManifoldOrb
                    stateVector={actualState}
                    domain={domain}
                    size={size}
                    showLabels={true}
                    interactive={true}
                    variant="default"
                />
            </div>

            {/* Connection lines (Calibration Gap) */}
            {showCalibration && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-15 opacity-30">
                    {/* This would ideally be dynamic lines connecting the centers or key points, 
              but for now we rely on the visual overlay of the two orbs */}
                </svg>
            )}
        </div>
    );
}
