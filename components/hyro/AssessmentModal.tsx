
import React, { useState, useEffect, useRef } from 'react';
import { X, MessageSquare, Check, AlertCircle, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { FrameShiftProbe } from './probes/FrameShiftProbe';
import { EntropyProbe } from './probes/EntropyProbe';
import { SynthesisProbe } from './probes/SynthesisProbe';

interface AssessmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    standardId: string;
    standardDescription: string;
}

export default function AssessmentModal({ isOpen, onClose, standardId, standardDescription }: AssessmentModalProps) {
    const [step, setStep] = useState<'init' | 'question' | 'evaluating' | 'result'>('init');
    const [question, setQuestion] = useState<string>('');
    const [context, setContext] = useState<string>('');
    const [metaProbeType, setMetaProbeType] = useState<string | null>(null);
    const [studentResponse, setStudentResponse] = useState<string>('');
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && standardId) {
            startAssessment();
        }
    }, [isOpen, standardId]);

    const startAssessment = async () => {
        setStep('init');
        setLoading(true);
        setResult(null);
        setStudentResponse('');

        try {
            const res = await fetch('/api/hyro/education', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'assess-init', standardId })
            });
            const data = await res.json();
            setQuestion(data.question);
            setContext(data.context);
            setMetaProbeType(data.meta_probe_type || null);
            setStep('question');
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const submitResponse = async () => {
        if (!studentResponse.trim()) return;

        setStep('evaluating');
        setLoading(true);

        try {
            const res = await fetch('/api/hyro/education', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'assess-evaluate',
                    standardId,
                    question,
                    studentResponse
                })
            });
            const data = await res.json();
            setResult(data.result);
            setStep('result');
        } catch (e) {
            console.error(e);
            setStep('question'); // Retry
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-4 border-b border-white/5 flex items-center justify-between bg-zinc-950">
                    <div>
                        <h3 className="text-lg font-medium text-white flex items-center gap-2">
                            <MessageSquare size={18} className="text-indigo-400" />
                            Check for Understanding
                        </h3>
                        <p className="text-xs text-zinc-500 font-mono mt-1">{standardId} - {standardDescription.substring(0, 60)}...</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar" ref={scrollRef}>

                    {loading && step === 'init' && (
                        <div className="flex flex-col items-center justify-center h-48 gap-4 text-zinc-400">
                            <RefreshCw className="animate-spin text-indigo-500" size={32} />
                            <p>Preparing interview question...</p>
                        </div>
                    )}

                    {!loading && step === 'question' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {context && (
                                <div className="bg-zinc-800/50 p-4 rounded-xl border border-white/5 text-sm text-zinc-300 italic">
                                    {context}
                                </div>
                            )}

                            {/* Dynamic Probe Rendering */}
                            {metaProbeType === 'frame_shift' ? (
                                <FrameShiftProbe
                                    domainA="Domain A" // In real app, parse from question metadata
                                    domainB="Domain B"
                                    prompt={question}
                                    onResponse={setStudentResponse}
                                />
                            ) : metaProbeType === 'entropy_compression' ? (
                                <EntropyProbe
                                    sequence="2, 3, 5, 9, 17..." // In real app, parse from question metadata
                                    prompt={question}
                                    onResponse={setStudentResponse}
                                />
                            ) : metaProbeType === 'non_dual_synthesis' ? (
                                <SynthesisProbe
                                    thesis="Thesis Statement" // In real app, parse from question metadata
                                    antithesis="Antithesis Statement"
                                    prompt={question}
                                    onResponse={setStudentResponse}
                                />
                            ) : (
                                // Default Text Interface
                                <>
                                    <div className="space-y-2">
                                        <span className="text-xs font-bold text-indigo-400 tracking-wider">QUESTION</span>
                                        <div className="text-xl text-white font-serif leading-relaxed">
                                            <ReactMarkdown>{question}</ReactMarkdown>
                                        </div>
                                    </div>

                                    <div className="space-y-2 pt-4">
                                        <span className="text-xs font-bold text-zinc-500 tracking-wider">YOUR ANSWER</span>
                                        <textarea
                                            value={studentResponse}
                                            onChange={e => setStudentResponse(e.target.value)}
                                            className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                                            placeholder="Type your explanation here..."
                                            autoFocus
                                        />
                                    </div>
                                </>
                            )}

                            <div className="flex justify-end pt-2">
                                <button
                                    onClick={submitResponse}
                                    disabled={!studentResponse.trim()}
                                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    Submit Answer <Check size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {loading && step === 'evaluating' && (
                        <div className="flex flex-col items-center justify-center h-48 gap-4 text-zinc-400">
                            <RefreshCw className="animate-spin text-emerald-500" size={32} />
                            <p>Evaluating your response...</p>
                        </div>
                    )}

                    {!loading && step === 'result' && result && (
                        <div className="space-y-6 animate-in zoom-in duration-300">
                            <div className={`p-6 rounded-2xl border ${result.score >= 70 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'} flex flex-col items-center text-center gap-4`}>
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${result.score >= 70 ? 'bg-emerald-500 text-zinc-950' : 'bg-amber-500 text-zinc-950'}`}>
                                    {result.score}
                                </div>
                                <div>
                                    <h4 className={`text-xl font-medium ${result.score >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {result.score >= 90 ? 'Mastery Achieved!' : result.score >= 70 ? 'Proficient' : 'Needs Practice'}
                                    </h4>
                                    <p className="text-zinc-400 text-sm mt-2">{result.feedback}</p>
                                </div>
                            </div>

                            {result.misconception_detected && (
                                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start gap-3">
                                    <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
                                    <div>
                                        <span className="block text-red-400 font-medium text-sm mb-1">Misconception Detected</span>
                                        <p className="text-zinc-300 text-sm">{result.misconception_detected}</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-center gap-3 pt-4">
                                {result.score < 90 && (
                                    <button
                                        onClick={() => startAssessment()} // Retry with new question
                                        className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition-colors"
                                    >
                                        Try Another Question
                                    </button>
                                )}
                                <button
                                    onClick={onClose}
                                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
