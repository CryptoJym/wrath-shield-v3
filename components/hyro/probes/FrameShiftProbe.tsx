import React, { useState } from 'react';
import { ArrowLeftRight, Link as LinkIcon, Plus } from 'lucide-react';

interface FrameShiftProbeProps {
    domainA: string;
    domainB: string;
    prompt: string;
    onResponse: (response: string) => void;
}

export function FrameShiftProbe({ domainA, domainB, prompt, onResponse }: FrameShiftProbeProps) {
    const [connections, setConnections] = useState<string[]>([]);
    const [currentInput, setCurrentInput] = useState('');

    const addConnection = () => {
        if (currentInput.trim()) {
            const newConnections = [...connections, currentInput.trim()];
            setConnections(newConnections);
            setCurrentInput('');
            // Combine connections into a single response string for the parent
            onResponse(newConnections.join('\n\n'));
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                <div className="flex items-center justify-center gap-8 mb-8">
                    <div className="text-center">
                        <div className="w-16 h-16 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center text-2xl mb-2 mx-auto">
                            📐
                        </div>
                        <div className="text-sm font-bold text-blue-400 uppercase tracking-wider">{domainA}</div>
                    </div>

                    <div className="flex flex-col items-center text-zinc-500">
                        <ArrowLeftRight size={24} />
                        <span className="text-[10px] uppercase tracking-widest mt-1">Frame Shift</span>
                    </div>

                    <div className="text-center">
                        <div className="w-16 h-16 rounded-full bg-purple-500/20 border border-purple-500/50 flex items-center justify-center text-2xl mb-2 mx-auto">
                            🎵
                        </div>
                        <div className="text-sm font-bold text-purple-400 uppercase tracking-wider">{domainB}</div>
                    </div>
                </div>

                <div className="text-lg text-white font-serif leading-relaxed text-center mb-8">
                    {prompt}
                </div>

                <div className="space-y-4">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={currentInput}
                            onChange={(e) => setCurrentInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addConnection()}
                            placeholder="Type a structural similarity..."
                            className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                        <button
                            onClick={addConnection}
                            disabled={!currentInput.trim()}
                            className="px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 transition-colors"
                        >
                            <Plus size={20} />
                        </button>
                    </div>

                    <div className="space-y-2">
                        {connections.map((conn, i) => (
                            <div key={i} className="flex items-start gap-3 bg-zinc-800/30 p-3 rounded-lg border border-white/5 animate-in slide-in-from-bottom-2">
                                <LinkIcon size={16} className="text-indigo-400 mt-1 shrink-0" />
                                <p className="text-zinc-300 text-sm">{conn}</p>
                            </div>
                        ))}
                        {connections.length === 0 && (
                            <div className="text-center text-zinc-600 text-sm py-4 italic">
                                No connections identified yet. Look for deep patterns.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
