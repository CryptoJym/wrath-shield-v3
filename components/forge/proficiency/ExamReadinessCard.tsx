import { Brain, Calendar, TrendingUp } from 'lucide-react';

export default function ExamReadinessCard() {
    return (
        <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-6 backdrop-blur-sm relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="flex items-start justify-between mb-4 relative z-10">
                <div>
                    <h3 className="text-zinc-200 font-medium flex items-center gap-2">
                        <Brain size={16} className="text-amber-500" />
                        Exam Readiness Oracle
                    </h3>
                    <p className="text-xs text-zinc-500 mt-1">Predictive confidence based on velocity</p>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold text-amber-500">87%</div>
                    <div className="text-xs text-amber-500/60 uppercase tracking-wider font-bold">Passing Prob.</div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 relative z-10">
                <div className="bg-zinc-950/50 rounded-lg p-3 border border-white/5">
                    <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
                        <Calendar size={12} />
                        Est. Mastery
                    </div>
                    <div className="text-zinc-200 font-mono">14 Days</div>
                </div>
                <div className="bg-zinc-900/50 rounded-lg p-3 border border-white/5">
                    <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
                        <TrendingUp size={12} />
                        Velocity
                    </div>
                    <div className="text-emerald-400 font-mono text-sm">+12% / week</div>
                </div>
            </div>
        </div>
    );
}
