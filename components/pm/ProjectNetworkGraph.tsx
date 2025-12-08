'use client';

/**
 * Project Network Graph Visualization
 *
 * Interactive SVG-based network graph showing:
 * - Domains/orgs as hub nodes with glassmorphism effect
 * - Projects as connected intermediate nodes
 * - Repos as leaf nodes
 * - Animated connections with activity indicators
 * - Interactive focus mode
 */

import { useState, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Github,
  Folder,
  GitBranch,
  Star,
  AlertCircle,
  Clock,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Maximize2,
  Activity
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface RepoMeta {
  stars?: number;
  issues?: number;
  prs?: number;
  lastUpdate?: string;
  language?: string;
}

interface TreeNode {
  id: string;
  name: string;
  type: 'org' | 'project' | 'repo';
  status: 'active' | 'archived' | 'error' | 'pending' | 'pending-sync';
  children?: TreeNode[];
  meta?: RepoMeta;
}

interface NodePosition {
  x: number;
  y: number;
  node: TreeNode;
  parentId?: string;
}

interface ConnectionLine {
  from: string;
  to: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export function ProjectNetworkGraph() {
  const { data, isLoading, mutate } = useSWR('/api/pm/repos', fetcher);
  const treeData: TreeNode[] = data?.tree || [];

  const [zoom, setZoom] = useState(1);
  const [focusedNode, setFocusedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Calculate node positions in a radial layout
  const { positions, connections, bounds } = useMemo(() => {
    const pos: NodePosition[] = [];
    const conn: ConnectionLine[] = [];
    let minX = 0, maxX = 0, minY = 0, maxY = 0;

    const centerX = 600;
    const centerY = 400;
    const orgRadius = 250;
    const projectRadius = 150;
    const repoRadius = 80;

    // Position org/domain nodes in a circle
    treeData.forEach((org, orgIndex) => {
      const orgAngle = (orgIndex / treeData.length) * Math.PI * 2 - Math.PI / 2;
      const orgX = centerX + Math.cos(orgAngle) * orgRadius;
      const orgY = centerY + Math.sin(orgAngle) * orgRadius;

      pos.push({ x: orgX, y: orgY, node: org });

      minX = Math.min(minX, orgX - 100);
      maxX = Math.max(maxX, orgX + 100);
      minY = Math.min(minY, orgY - 100);
      maxY = Math.max(maxY, orgY + 100);

      // Position project nodes around each org
      const projects = org.children || [];
      projects.forEach((project, projIndex) => {
        const projAngle = orgAngle + ((projIndex - (projects.length - 1) / 2) * 0.3);
        const projX = orgX + Math.cos(projAngle) * projectRadius;
        const projY = orgY + Math.sin(projAngle) * projectRadius;

        pos.push({ x: projX, y: projY, node: project, parentId: org.id });
        conn.push({
          from: org.id,
          to: project.id,
          fromX: orgX,
          fromY: orgY,
          toX: projX,
          toY: projY
        });

        minX = Math.min(minX, projX - 80);
        maxX = Math.max(maxX, projX + 80);
        minY = Math.min(minY, projY - 80);
        maxY = Math.max(maxY, projY + 80);

        // Position repo nodes around each project
        const repos = project.children || [];
        repos.forEach((repo, repoIndex) => {
          const repoAngle = projAngle + ((repoIndex - (repos.length - 1) / 2) * 0.25);
          const repoX = projX + Math.cos(repoAngle) * repoRadius;
          const repoY = projY + Math.sin(repoAngle) * repoRadius;

          pos.push({ x: repoX, y: repoY, node: repo, parentId: project.id });
          conn.push({
            from: project.id,
            to: repo.id,
            fromX: projX,
            fromY: projY,
            toX: repoX,
            toY: repoY
          });

          minX = Math.min(minX, repoX - 50);
          maxX = Math.max(maxX, repoX + 50);
          minY = Math.min(minY, repoY - 50);
          maxY = Math.max(maxY, repoY + 50);
        });
      });
    });

    return {
      positions: pos,
      connections: conn,
      bounds: { minX, maxX, minY, maxY, width: maxX - minX + 100, height: maxY - minY + 100 }
    };
  }, [treeData]);

  // Generate bezier curve path
  const getBezierPath = useCallback((c: ConnectionLine) => {
    const dx = c.toX - c.fromX;
    const dy = c.toY - c.fromY;
    const cx1 = c.fromX + dx * 0.3;
    const cy1 = c.fromY;
    const cx2 = c.toX - dx * 0.3;
    const cy2 = c.toY;
    return `M ${c.fromX} ${c.fromY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${c.toX} ${c.toY}`;
  }, []);

  // Get node color based on type
  const getNodeColor = (type: string, status: string) => {
    if (status === 'error') return { bg: 'rgba(239, 68, 68, 0.2)', border: 'rgba(239, 68, 68, 0.5)', text: '#f87171' };
    if (status === 'archived') return { bg: 'rgba(100, 116, 139, 0.2)', border: 'rgba(100, 116, 139, 0.5)', text: '#94a3b8' };

    switch (type) {
      case 'org':
        return { bg: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.5)', text: '#818cf8' };
      case 'project':
        return { bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.5)', text: '#22d3ee' };
      case 'repo':
        return { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)', text: '#34d399' };
      default:
        return { bg: 'rgba(100, 116, 139, 0.15)', border: 'rgba(100, 116, 139, 0.4)', text: '#94a3b8' };
    }
  };

  // Node icon component
  const NodeIcon = ({ type }: { type: string }) => {
    switch (type) {
      case 'org':
        return <Github size={16} />;
      case 'project':
        return <Folder size={14} />;
      case 'repo':
        return <GitBranch size={12} />;
      default:
        return null;
    }
  };

  // Node sizes
  const getNodeSize = (type: string) => {
    switch (type) {
      case 'org': return { width: 120, height: 50 };
      case 'project': return { width: 100, height: 40 };
      case 'repo': return { width: 80, height: 32 };
      default: return { width: 80, height: 32 };
    }
  };

  // Stats
  const stats = useMemo(() => {
    let orgs = 0, projects = 0, repos = 0;
    treeData.forEach(org => {
      orgs++;
      (org.children || []).forEach(proj => {
        projects++;
        repos += (proj.children || []).length;
      });
    });
    return { orgs, projects, repos };
  }, [treeData]);

  if (isLoading) {
    return (
      <div className="w-full h-[600px] bg-slate-950/50 rounded-xl border border-white/5 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          Loading project graph...
        </div>
      </div>
    );
  }

  if (treeData.length === 0) {
    return (
      <div className="w-full h-[600px] bg-slate-950/50 rounded-xl border border-white/5 flex items-center justify-center">
        <div className="text-center text-slate-500">
          <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No project data available</p>
          <p className="text-xs mt-1">Configure domains and projects to see the network</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-slate-950/50 rounded-xl border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
            <Activity className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Project Network</h3>
            <p className="text-xs text-slate-500">
              {stats.orgs} Domains • {stats.projects} Projects • {stats.repos} Repos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs text-slate-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(z => Math.min(1.5, z + 0.1))}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <Maximize2 size={16} />
          </button>
          <button
            onClick={() => mutate()}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Graph Area */}
      <div className="relative h-[600px] overflow-auto">
        <svg
          width={bounds.width * zoom}
          height={bounds.height * zoom}
          viewBox={`${bounds.minX - 50} ${bounds.minY - 50} ${bounds.width} ${bounds.height}`}
          className="absolute inset-0"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
        >
          {/* Gradient definitions */}
          <defs>
            <linearGradient id="orgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(99, 102, 241, 0.3)" />
              <stop offset="100%" stopColor="rgba(99, 102, 241, 0.1)" />
            </linearGradient>
            <linearGradient id="projectGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(6, 182, 212, 0.3)" />
              <stop offset="100%" stopColor="rgba(6, 182, 212, 0.1)" />
            </linearGradient>
            <linearGradient id="repoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(16, 185, 129, 0.3)" />
              <stop offset="100%" stopColor="rgba(16, 185, 129, 0.1)" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Connection lines */}
          {connections.map((conn, i) => {
            const isHighlighted = hoveredNode === conn.from || hoveredNode === conn.to ||
              focusedNode === conn.from || focusedNode === conn.to;
            return (
              <path
                key={`conn-${i}`}
                d={getBezierPath(conn)}
                fill="none"
                stroke={isHighlighted ? 'rgba(99, 102, 241, 0.6)' : 'rgba(100, 116, 139, 0.2)'}
                strokeWidth={isHighlighted ? 2 : 1}
                className="transition-all duration-300"
              />
            );
          })}

          {/* Nodes */}
          {positions.map((pos) => {
            const { node } = pos;
            const colors = getNodeColor(node.type, node.status);
            const size = getNodeSize(node.type);
            const isHovered = hoveredNode === node.id;
            const isFocused = focusedNode === node.id;

            return (
              <g
                key={node.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => setFocusedNode(focusedNode === node.id ? null : node.id)}
                className="cursor-pointer"
              >
                {/* Glow effect for hovered/focused */}
                {(isHovered || isFocused) && (
                  <rect
                    x={-size.width / 2 - 4}
                    y={-size.height / 2 - 4}
                    width={size.width + 8}
                    height={size.height + 8}
                    rx={10}
                    fill="none"
                    stroke={colors.border}
                    strokeWidth={2}
                    filter="url(#glow)"
                    className="animate-pulse"
                  />
                )}

                {/* Node background */}
                <rect
                  x={-size.width / 2}
                  y={-size.height / 2}
                  width={size.width}
                  height={size.height}
                  rx={8}
                  fill={colors.bg}
                  stroke={colors.border}
                  strokeWidth={1}
                  className="transition-all duration-200"
                />

                {/* Icon */}
                <g transform={`translate(${-size.width / 2 + 10}, ${-6})`}>
                  <foreignObject width={20} height={20}>
                    <div className="flex items-center justify-center" style={{ color: colors.text }}>
                      <NodeIcon type={node.type} />
                    </div>
                  </foreignObject>
                </g>

                {/* Label */}
                <text
                  x={node.type === 'repo' ? 0 : 8}
                  y={4}
                  textAnchor={node.type === 'repo' ? 'middle' : 'start'}
                  fill={colors.text}
                  fontSize={node.type === 'org' ? 12 : node.type === 'project' ? 11 : 9}
                  fontWeight={node.type === 'org' ? 600 : 500}
                  className="select-none"
                >
                  {node.name.length > 12 ? node.name.slice(0, 12) + '...' : node.name}
                </text>

                {/* Status indicator */}
                <circle
                  cx={size.width / 2 - 8}
                  cy={-size.height / 2 + 8}
                  r={4}
                  fill={
                    node.status === 'active' ? '#22c55e' :
                      node.status === 'error' ? '#ef4444' :
                        node.status === 'archived' ? '#64748b' : '#f59e0b'
                  }
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 p-4 border-t border-white/5 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-indigo-500/30 border border-indigo-500/50" />
          <span>Domain/Org</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-cyan-500/30 border border-cyan-500/50" />
          <span>Project</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500/50" />
          <span>Repository</span>
        </div>
        <div className="flex items-center gap-4 ml-auto">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>Active</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span>Error</span>
          </div>
        </div>
      </div>

      {/* Focused Node Detail Panel */}
      <AnimatePresence>
        {focusedNode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-20 left-4 right-4 p-4 bg-slate-900/95 backdrop-blur-sm border border-white/10 rounded-xl"
          >
            {(() => {
              const focused = positions.find(p => p.node.id === focusedNode);
              if (!focused) return null;
              const { node } = focused;
              const colors = getNodeColor(node.type, node.status);

              return (
                <div className="flex items-start gap-4">
                  <div
                    className="p-3 rounded-lg border"
                    style={{ background: colors.bg, borderColor: colors.border }}
                  >
                    <div style={{ color: colors.text }}>
                      <NodeIcon type={node.type} />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-white">{node.name}</h4>
                    <p className="text-sm text-slate-400 capitalize">{node.type} • {node.status}</p>
                    {node.meta && (
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        {node.meta.stars !== undefined && (
                          <span className="flex items-center gap-1">
                            <Star size={12} /> {node.meta.stars}
                          </span>
                        )}
                        {node.meta.issues !== undefined && (
                          <span className="flex items-center gap-1">
                            <AlertCircle size={12} /> {node.meta.issues}
                          </span>
                        )}
                        {node.meta.lastUpdate && (
                          <span className="flex items-center gap-1">
                            <Clock size={12} /> {node.meta.lastUpdate}
                          </span>
                        )}
                        {node.meta.language && (
                          <span className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-400">
                            {node.meta.language}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setFocusedNode(null)}
                    className="text-slate-500 hover:text-white"
                  >
                    ×
                  </button>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
