import React, { useState } from 'react';
import { Scale, ArrowDown } from 'lucide-react';

interface SynthesisProbeProps {
    thesis: string;
    antithesis: string;
    prompt: string;
    onResponse: (response: string) => void;
}

export function SynthesisProbe({ thesis, antithesis, prompt, onResponse }: SynthesisProbeProps) {
    const [synthesis, setSynthesis] = useState('');

    const handleChange = (val: string) => {
        setSynthesis(val);
        onResponse(val);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">

                <div className="flex items-center justify-center gap-2 text-amber-400 mb-8">
                    <Scale size={20} />
                    <span className="text-xs font-bold uppercase tracking-wider">Non-Dual Synthesis</span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl">
                        <div className="text-xs font-bold text-blue-400 uppercase mb-2">Thesis</div>
                        <p className="text-sm text-blue-100 italic">"{thesis}"</p>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl">
                        <div className="text-xs font-bold text-red-400 uppercase mb-2">Antithesis</div>
                        <p className="text-sm text-red-100 italic">"{antithesis}"</p>
                    </div>
                </div>

                <div className="flex justify-center mb-4">
                    <ArrowDown className="text-zinc-600 animate-bounce" />
                </div>

                <div className="text-lg text-white font-serif leading-relaxed text-center mb-6">
                    {prompt}
                </div>

                <div className="relative">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-amber-500/20 to-red-500/20 rounded-xl blur-sm opacity-50"></div>
                    <textarea
                        value={synthesis}
                        onChange={(e) => handleChange(e.target.value)}
                        className="relative w-full h-40 bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                        placeholder="Synthesize the paradox. How can both be true?"
                    />
                </div>
            </div>
        </div>
    );
}
