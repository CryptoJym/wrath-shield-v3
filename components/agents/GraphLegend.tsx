"use client";

import React from 'react';
import { Info, Circle, ArrowRight, ArrowRightLeft, GitBranch } from 'lucide-react';

export const GraphLegend: React.FC = () => {
  return (
    <div className="border border-border bg-card rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-border">
        <Info size={16} className="text-primary" />
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Legend
        </h3>
      </div>

      {/* Node Status */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Node Status
        </h4>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Circle size={12} className="fill-green-500 text-green-500" />
            <span className="text-xs text-foreground">Healthy (HP &gt; 80)</span>
          </div>
          <div className="flex items-center gap-2">
            <Circle size={12} className="fill-yellow-500 text-yellow-500" />
            <span className="text-xs text-foreground">Warning (HP 50-80)</span>
          </div>
          <div className="flex items-center gap-2">
            <Circle size={12} className="fill-red-500 text-red-500" />
            <span className="text-xs text-foreground">Critical (HP &lt; 50)</span>
          </div>
        </div>
      </div>

      {/* Edge Types */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Connection Types
        </h4>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <ArrowRight size={12} className="text-green-500" />
            <span className="text-xs text-foreground">Data Flow</span>
          </div>
          <div className="flex items-center gap-2">
            <ArrowRight size={12} className="text-blue-500" strokeDasharray="3,3" />
            <span className="text-xs text-foreground">Control Flow</span>
          </div>
          <div className="flex items-center gap-2">
            <ArrowRightLeft size={12} className="text-purple-500" />
            <span className="text-xs text-foreground">Bidirectional</span>
          </div>
        </div>
      </div>

      {/* Health Bars */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Agent Metrics
        </h4>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-1.5 bg-red-500 rounded-full"></div>
            <span className="text-xs text-foreground">HP (Health Points)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-1.5 bg-blue-500 rounded-full"></div>
            <span className="text-xs text-foreground">MP (Magic/Processing Power)</span>
          </div>
        </div>
      </div>

      {/* Edge Health */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Connection Health
        </h4>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-green-500"></div>
            <span className="text-xs text-foreground">Healthy Link</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-red-500 opacity-50"></div>
            <span className="text-xs text-foreground">Degraded Link</span>
          </div>
          <div className="flex items-center gap-2">
            <Circle size={6} className="fill-green-500 text-green-500 animate-pulse" />
            <span className="text-xs text-foreground">Active Data Flow</span>
          </div>
        </div>
      </div>

      {/* Interaction Hints */}
      <div className="space-y-2 pt-2 border-t border-border">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Interactions
        </h4>
        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground">
            • Click node for details
          </div>
          <div className="text-xs text-muted-foreground">
            • Click edge for metrics
          </div>
          <div className="text-xs text-muted-foreground">
            • Scroll to zoom
          </div>
          <div className="text-xs text-muted-foreground">
            • Drag to pan
          </div>
        </div>
      </div>
    </div>
  );
};

export default GraphLegend;
