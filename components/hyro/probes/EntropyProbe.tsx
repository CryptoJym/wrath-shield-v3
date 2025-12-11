import React, { useState } from 'react';
import { Waves, Eye, EyeOff } from 'lucide-react';

interface EntropyProbeProps {
    sequence: string; // e.g., "2, 3, 5, 9, 17..."
    prompt: string;
    onResponse: (response: string) => void;
}

export function EntropyProbe({ sequence, prompt, onResponse }: EntropyProbeProps) {
    const [noiseFilter, setNoiseFilter] = useState(false);
    const [hypothesis, setHypothesis] = useState('');

    const handleHypothesisChange = (val: string) => {
        setHypothesis(val);
        onResponse(val);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 relative overflow-hidden">

                {/* Visual Metaphor: Noise/Signal */}
                <div className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${noiseFilter ? 'opacity-10' : 'opacity-30'}`}>
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                </div>

                <div className="relative z-10">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2 text-emerald-400">
                            <Waves size={20} />
                            <span className="text-xs font-bold uppercase tracking-wider">Entropy Compression</span>
                        </div>
                        <button
                            onClick={() => setNoiseFilter(!noiseFilter)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${noiseFilter
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700'
                                }`}
                        >
                            {noiseFilter ? <Eye size={14} /> : <EyeOff size={14} />}
                            {noiseFilter ? 'Noise Filter: ON' : 'Noise Filter: OFF'}
                        </button>
                    </div>

                    <div className="text-center mb-8">
                        <div className={`text-3xl font-mono tracking-widest transition-all duration-500 ${noiseFilter ? 'text-white blur-none' : 'text-zinc-400 blur-[1px]'}`}>
                            {sequence}
                        </div>
                        <p className="text-zinc-500 text-xs mt-2 font-mono">Signal detected. Decode the pattern.</p>
                    </div>

                    <div className="text-lg text-white font-serif leading-relaxed mb-6">
                        {prompt}
                    </div>

                    <textarea
                        value={hypothesis}
                        onChange={(e) => handleHypothesisChange(e.target.value)}
                        className="w-full h-32 bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors resize-none font-mono text-sm"
                        placeholder="// Enter your decoding hypothesis..."
                    />
                </div>
            </div>
        </div>
    );
}
