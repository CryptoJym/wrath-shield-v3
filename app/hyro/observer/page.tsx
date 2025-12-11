'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Brain, TrendingUp, AlertCircle, Calendar, ArrowRight, Activity, Zap } from 'lucide-react';

// Mock data for history (will be replaced by API)
const MOCK_HISTORY = [
    { date: '2025-11-01', coherence: 45, entropy: 40, generativity: 35 },
    { date: '2025-11-08', coherence: 48, entropy: 42, generativity: 38 },
    { date: '2025-11-15', coherence: 52, entropy: 45, generativity: 40 },
    { date: '2025-11-22', coherence: 58, entropy: 48, generativity: 45 },
    { date: '2025-11-29', coherence: 62, entropy: 55, generativity: 50 },
    { date: '2025-12-06', coherence: 68, entropy: 58, generativity: 60 },
];

const MOCK_ALERTS = [
    { id: 1, type: 'opportunity', title: 'High Entropy Tolerance', message: 'Student is ready for ambiguous, open-ended challenges in Science.', date: '2 days ago' },
    { id: 2, type: 'risk', title: 'Coherence Dip', message: 'Recent essays show fragmented logic. Recommend synthesis exercises.', date: '1 week ago' },
];

export default function ObserverPage() {
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState(MOCK_HISTORY);
    const [alerts, setAlerts] = useState(MOCK_ALERTS);

    useEffect(() => {
        // Simulate API load
        setTimeout(() => setLoading(false), 1000);
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin h-12 w-12 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-zinc-400 uppercase tracking-widest text-sm">Loading Observer Stream...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-indigo-500/30">
            {/* Header */}
            <header className="border-b border-white/5 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center text-indigo-400">
                            <Activity size={18} />
                        </div>
                        <h1 className="text-lg font-bold text-white">Observer Dashboard</h1>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-zinc-400">
                        <span>Student: <strong className="text-white">Leo</strong></span>
                        <span className="w-px h-4 bg-white/10" />
                        <span>Grade: <strong className="text-white">6</strong></span>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

                {/* Top Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-6 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 text-blue-400 mb-2">
                                <Brain size={16} />
                                <span className="text-xs font-bold uppercase tracking-wider">Coherence</span>
                            </div>
                            <div className="text-4xl font-light text-white">68</div>
                            <div className="text-sm text-emerald-400 mt-2 flex items-center gap-1">
                                <TrendingUp size={14} /> +6% this month
                            </div>
                        </div>
                    </div>

                    <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-6 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 text-purple-400 mb-2">
                                <Zap size={16} />
                                <span className="text-xs font-bold uppercase tracking-wider">Entropy</span>
                            </div>
                            <div className="text-4xl font-light text-white">58</div>
                            <div className="text-sm text-emerald-400 mt-2 flex items-center gap-1">
                                <TrendingUp size={14} /> +12% this month
                            </div>
                        </div>
                    </div>

                    <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-6 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 text-amber-400 mb-2">
                                <TrendingUp size={16} />
                                <span className="text-xs font-bold uppercase tracking-wider">Generativity</span>
                            </div>
                            <div className="text-4xl font-light text-white">60</div>
                            <div className="text-sm text-emerald-400 mt-2 flex items-center gap-1">
                                <TrendingUp size={14} /> +8% this month
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Charts Area */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Evolution Chart */}
                    <div className="lg:col-span-2 bg-zinc-900/50 border border-white/5 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-medium text-white">Manifold Evolution</h3>
                            <select className="bg-zinc-800 border border-white/10 rounded-lg text-xs px-3 py-1.5 text-zinc-300 focus:outline-none">
                                <option>Last 30 Days</option>
                                <option>Last 90 Days</option>
                                <option>All Time</option>
                            </select>
                        </div>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={history}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                    <XAxis dataKey="date" stroke="#52525b" fontSize={12} tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} />
                                    <YAxis stroke="#52525b" fontSize={12} domain={[0, 100]} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                                        itemStyle={{ fontSize: '12px' }}
                                    />
                                    <Line type="monotone" dataKey="coherence" stroke="#60a5fa" strokeWidth={2} dot={{ r: 4, fill: '#60a5fa' }} name="Coherence" />
                                    <Line type="monotone" dataKey="entropy" stroke="#c084fc" strokeWidth={2} dot={{ r: 4, fill: '#c084fc' }} name="Entropy" />
                                    <Line type="monotone" dataKey="generativity" stroke="#fbbf24" strokeWidth={2} dot={{ r: 4, fill: '#fbbf24' }} name="Generativity" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* ZPD Alerts & Insights */}
                    <div className="space-y-6">
                        <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-6">
                            <h3 className="text-lg font-medium text-white mb-4">ZPD Insights</h3>
                            <div className="space-y-4">
                                {alerts.map((alert) => (
                                    <div key={alert.id} className={`p-4 rounded-lg border ${alert.type === 'opportunity' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                                        <div className="flex items-start gap-3">
                                            <AlertCircle size={18} className={alert.type === 'opportunity' ? 'text-emerald-400' : 'text-amber-400'} />
                                            <div>
                                                <h4 className={`text-sm font-bold ${alert.type === 'opportunity' ? 'text-emerald-400' : 'text-amber-400'}`}>{alert.title}</h4>
                                                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{alert.message}</p>
                                                <div className="text-[10px] text-zinc-600 mt-2 flex items-center gap-1">
                                                    <Calendar size={10} /> {alert.date}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl p-6 text-white relative overflow-hidden">
                            <div className="relative z-10">
                                <h3 className="text-lg font-bold mb-2">Assign Meta-Quest</h3>
                                <p className="text-sm text-indigo-100 mb-4">Target specific manifold dimensions with AI-generated challenges.</p>
                                <button className="w-full py-2 bg-white text-indigo-600 rounded-lg font-bold text-sm hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2">
                                    Create Assignment <ArrowRight size={16} />
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
