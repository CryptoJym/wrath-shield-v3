"use client";

import React from 'react';
import { Filter, Circle, GitBranch, Activity, Brain, Coins, Gavel, Mail, Calendar, Users } from 'lucide-react';

export interface GraphFiltersProps {
  statusFilter: 'all' | 'green' | 'yellow' | 'red';
  typeFilter: 'all' | string;
  onStatusFilterChange: (filter: 'all' | 'green' | 'yellow' | 'red') => void;
  onTypeFilterChange: (filter: 'all' | string) => void;
  availableTypes: string[];
}

const TypeIconMap: Record<string, React.ElementType> = {
  'brain': Brain,
  'coins': Coins,
  'gavel': Gavel,
  'mail': Mail,
  'calendar': Calendar,
  'users': Users,
  'activity': Activity,
  'clipboard-list': GitBranch,
};

export const GraphFilters: React.FC<GraphFiltersProps> = ({
  statusFilter,
  typeFilter,
  onStatusFilterChange,
  onTypeFilterChange,
  availableTypes,
}) => {
  return (
    <div className="border border-border bg-card rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-border">
        <Filter size={16} className="text-primary" />
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Filters
        </h3>
      </div>

      {/* Status Filter */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Status
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onStatusFilterChange('all')}
            className={`px-3 py-2 rounded-lg border transition-all text-xs font-medium ${
              statusFilter === 'all'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-secondary/20 text-muted-foreground hover:border-primary/50'
            }`}
          >
            All
          </button>
          <button
            onClick={() => onStatusFilterChange('green')}
            className={`px-3 py-2 rounded-lg border transition-all text-xs font-medium flex items-center justify-center gap-1.5 ${
              statusFilter === 'green'
                ? 'border-green-500 bg-green-500/10 text-green-500'
                : 'border-border bg-secondary/20 text-muted-foreground hover:border-green-500/50'
            }`}
          >
            <Circle size={10} className="fill-current" />
            Healthy
          </button>
          <button
            onClick={() => onStatusFilterChange('yellow')}
            className={`px-3 py-2 rounded-lg border transition-all text-xs font-medium flex items-center justify-center gap-1.5 ${
              statusFilter === 'yellow'
                ? 'border-yellow-500 bg-yellow-500/10 text-yellow-500'
                : 'border-border bg-secondary/20 text-muted-foreground hover:border-yellow-500/50'
            }`}
          >
            <Circle size={10} className="fill-current" />
            Warning
          </button>
          <button
            onClick={() => onStatusFilterChange('red')}
            className={`px-3 py-2 rounded-lg border transition-all text-xs font-medium flex items-center justify-center gap-1.5 ${
              statusFilter === 'red'
                ? 'border-red-500 bg-red-500/10 text-red-500'
                : 'border-border bg-secondary/20 text-muted-foreground hover:border-red-500/50'
            }`}
          >
            <Circle size={10} className="fill-current" />
            Critical
          </button>
        </div>
      </div>

      {/* Type Filter */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Agent Type
        </h4>
        <div className="space-y-1.5">
          <button
            onClick={() => onTypeFilterChange('all')}
            className={`w-full px-3 py-2 rounded-lg border transition-all text-xs font-medium text-left ${
              typeFilter === 'all'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-secondary/20 text-muted-foreground hover:border-primary/50'
            }`}
          >
            All Types
          </button>
          {availableTypes.map((type) => {
            const Icon = TypeIconMap[type] || Activity;
            return (
              <button
                key={type}
                onClick={() => onTypeFilterChange(type)}
                className={`w-full px-3 py-2 rounded-lg border transition-all text-xs font-medium text-left flex items-center gap-2 ${
                  typeFilter === type
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-secondary/20 text-muted-foreground hover:border-primary/50'
                }`}
              >
                <Icon size={14} />
                <span className="capitalize">{type.replace('-', ' ')}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Filter Count */}
      <div className="pt-2 border-t border-border">
        <div className="text-xs text-muted-foreground">
          {statusFilter === 'all' && typeFilter === 'all' ? (
            'No filters active'
          ) : (
            <>
              <span className="font-semibold text-primary">
                {[statusFilter !== 'all' ? 1 : 0, typeFilter !== 'all' ? 1 : 0].reduce((a, b) => a + b, 0)}
              </span>
              {' '}filter(s) active
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GraphFilters;
