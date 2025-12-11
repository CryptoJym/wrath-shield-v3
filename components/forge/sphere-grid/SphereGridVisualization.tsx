'use client';

/**
 * Sphere Grid Visualization Component
 *
 * @hyro-domain competency_visualization
 * @hyro-manifold FFX-inspired sphere grid for competency progression
 *
 * An interactive radial visualization showing learning progress
 * where competencies radiate outward from a center point.
 * - Center: Current position / core foundational skills
 * - Inner rings: Prerequisites and foundational concepts
 * - Outer rings: Advanced skills building on mastered foundations
 * - Glow intensity: Mastery level (brighter = more mastered)
 * - Test-ready nodes: Beacon animation for high-confidence test-out
 */

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import type {
  SphereNode,
  SphereGrid,
  NodeConnection,
  GridViewState,
  SphereSubject,
  NodeState,
  SphereGridColors,
} from '@/lib/hyro/sphere-grid-types';
import { DEFAULT_SPHERE_COLORS } from '@/lib/hyro/sphere-grid-types';

// =============================================================================
// TYPES
// =============================================================================

interface SphereGridVisualizationProps {
  grid: SphereGrid;
  width?: number;
  height?: number;
  colors?: SphereGridColors;
  onNodeClick?: (node: SphereNode) => void;
  onNodeHover?: (node: SphereNode | null) => void;
  showConnections?: boolean;
  showLabels?: boolean;
  animationsEnabled?: boolean;
  className?: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get color for a subject
 */
function getSubjectColor(subject: SphereSubject, colors: SphereGridColors): string {
  const colorMap: Record<SphereSubject, string> = {
    math: colors.math,
    ela: colors.ela,
    science: colors.science,
    social_studies: colors.social_studies,
    critical_thinking: colors.critical_thinking,
    neuroscience: colors.neuroscience,
    decision_making: colors.decision_making,
    pattern_recognition: colors.pattern_recognition,
    meta_learning: colors.meta_learning,
  };
  return colorMap[subject] || colors.math;
}

/**
 * Get color for a node state
 */
function getStateColor(state: NodeState, colors: SphereGridColors): string {
  const stateColorMap: Record<NodeState, string> = {
    locked: colors.locked,
    available: colors.available,
    in_progress: colors.inProgress,
    approaching: colors.approaching,
    mastered: colors.mastered,
    test_ready: colors.testReady,
    tested_passed: colors.testedPassed,
    legendary: colors.legendary,
  };
  return stateColorMap[state] || colors.available;
}

/**
 * Calculate glow intensity based on mastery score
 */
function getGlowIntensity(node: SphereNode): number {
  if (node.state === 'locked') return 0;
  if (node.state === 'legendary') return 1;
  if (node.state === 'tested_passed') return 0.9;
  if (node.state === 'test_ready') return 0.85;
  if (node.state === 'mastered') return 0.7;
  if (node.state === 'approaching') return 0.5;
  if (node.state === 'in_progress') return 0.4;
  return 0.2;
}

/**
 * Get node size in pixels
 */
function getNodeSize(node: SphereNode): number {
  switch (node.size) {
    case 'core': return 28;
    case 'large': return 22;
    case 'medium': return 18;
    case 'small': return 14;
    default: return 16;
  }
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/**
 * Animated ring background
 */
function GridRings({
  centerX,
  centerY,
  maxRadius,
  ringCount,
  colors,
}: {
  centerX: number;
  centerY: number;
  maxRadius: number;
  ringCount: number;
  colors: SphereGridColors;
}) {
  const ringSpacing = maxRadius / ringCount;

  return (
    <g className="grid-rings">
      {Array.from({ length: ringCount }).map((_, i) => (
        <circle
          key={i}
          cx={centerX}
          cy={centerY}
          r={ringSpacing * (i + 1)}
          fill="none"
          stroke={`${colors.locked}40`}
          strokeWidth={1}
          strokeDasharray={i === 0 ? 'none' : '4 8'}
          className="transition-opacity duration-300"
        />
      ))}
    </g>
  );
}

/**
 * Connection line between nodes
 */
function ConnectionLine({
  connection,
  nodes,
  colors,
  animated,
}: {
  connection: NodeConnection;
  nodes: Map<string, SphereNode>;
  colors: SphereGridColors;
  animated: boolean;
}) {
  const fromNode = nodes.get(connection.from);
  const toNode = nodes.get(connection.to);

  if (!fromNode || !toNode) return null;

  const stateColors: Record<string, string> = {
    locked: colors.connectionLocked,
    unlocked: colors.connectionUnlocked,
    active: colors.connectionActive,
    completed: colors.connectionCompleted,
  };

  const strokeColor = stateColors[connection.state] || colors.connectionLocked;
  const opacity = connection.state === 'locked' ? 0.3 : connection.strength;

  return (
    <g className="connection-line">
      <line
        x1={fromNode.x}
        y1={fromNode.y}
        x2={toNode.x}
        y2={toNode.y}
        stroke={strokeColor}
        strokeWidth={2 * connection.strength}
        strokeOpacity={opacity}
        strokeLinecap="round"
      />
      {animated && connection.state === 'active' && (
        <line
          x1={fromNode.x}
          y1={fromNode.y}
          x2={toNode.x}
          y2={toNode.y}
          stroke={colors.particleColor}
          strokeWidth={2}
          strokeOpacity={0.8}
          strokeDasharray="4 12"
          className="animate-dash"
        />
      )}
    </g>
  );
}

/**
 * Single node in the grid
 */
function GridNode({
  node,
  colors,
  isHovered,
  isSelected,
  showLabel,
  animated,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  node: SphereNode;
  colors: SphereGridColors;
  isHovered: boolean;
  isSelected: boolean;
  showLabel: boolean;
  animated: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const size = getNodeSize(node);
  const subjectColor = getSubjectColor(node.subject, colors);
  const stateColor = getStateColor(node.state, colors);
  const glowIntensity = getGlowIntensity(node);
  const isInteractive = node.state !== 'locked';

  // Determine animation class
  let animationClass = '';
  if (animated) {
    switch (node.animation) {
      case 'pulse':
        animationClass = 'animate-pulse-slow';
        break;
      case 'glow':
        animationClass = 'animate-glow';
        break;
      case 'beacon':
        animationClass = 'animate-beacon';
        break;
      case 'sparkle':
        animationClass = 'animate-sparkle';
        break;
      default:
        break;
    }
  }

  // Scale up when hovered or selected
  const scale = isHovered ? 1.3 : isSelected ? 1.2 : 1;

  return (
    <g
      className={`grid-node ${isInteractive ? 'cursor-pointer' : 'cursor-not-allowed'} ${animationClass}`}
      transform={`translate(${node.x}, ${node.y})`}
      onClick={isInteractive ? onClick : undefined}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Glow effect */}
      {glowIntensity > 0 && (
        <circle
          r={size * 1.5 * scale}
          fill={`url(#glow-${node.state})`}
          opacity={glowIntensity * 0.6}
          className="transition-all duration-300"
        />
      )}

      {/* Main node circle */}
      <circle
        r={size * scale}
        fill={node.state === 'locked' ? colors.locked : subjectColor}
        stroke={stateColor}
        strokeWidth={isHovered || isSelected ? 3 : 2}
        opacity={node.state === 'locked' ? 0.4 : 1}
        className="transition-all duration-200"
      />

      {/* Inner ring for mastery */}
      {node.mastery.score > 0 && node.state !== 'locked' && (
        <circle
          r={size * 0.6 * scale}
          fill="none"
          stroke={colors.glowColor}
          strokeWidth={2}
          strokeOpacity={node.mastery.score / 100}
          strokeDasharray={`${(node.mastery.score / 100) * Math.PI * size * 1.2} ${Math.PI * size * 1.2}`}
          transform={`rotate(-90)`}
          className="transition-all duration-500"
        />
      )}

      {/* Test-ready indicator */}
      {node.state === 'test_ready' && (
        <g>
          <circle
            r={size * 0.3 * scale}
            fill={colors.testReady}
            className="animate-ping"
          />
          <text
            y={-size - 8}
            textAnchor="middle"
            className="text-[8px] font-bold fill-blue-300"
          >
            TEST
          </text>
        </g>
      )}

      {/* Legendary star */}
      {node.state === 'legendary' && (
        <text
          textAnchor="middle"
          dominantBaseline="central"
          className="text-xs select-none"
        >
          ⭐
        </text>
      )}

      {/* Label */}
      {showLabel && (isHovered || isSelected) && (
        <g transform={`translate(0, ${size + 12})`}>
          <rect
            x={-60}
            y={-10}
            width={120}
            height={20}
            rx={4}
            fill="rgba(0,0,0,0.85)"
            stroke={subjectColor}
            strokeWidth={1}
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            className="text-[10px] font-medium fill-white select-none"
          >
            {node.name.length > 18 ? node.name.slice(0, 16) + '...' : node.name}
          </text>
        </g>
      )}
    </g>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function SphereGridVisualization({
  grid,
  width = 800,
  height = 800,
  colors = DEFAULT_SPHERE_COLORS,
  onNodeClick,
  onNodeHover,
  showConnections = true,
  showLabels = true,
  animationsEnabled = true,
  className = '',
}: SphereGridVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewState, setViewState] = useState<GridViewState>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    focusedNodeId: null,
    selectedNodeIds: [],
    highlightedSector: null,
  });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Convert Map to array for rendering
  const nodesArray = useMemo(() => Array.from(grid.nodes.values()), [grid.nodes]);

  // Handle mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setViewState(prev => ({
      ...prev,
      scale: Math.max(0.3, Math.min(3, prev.scale * delta)),
    }));
  }, []);

  // Handle pan start
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) { // Left click only
      setIsDragging(true);
      setDragStart({ x: e.clientX - viewState.offsetX, y: e.clientY - viewState.offsetY });
    }
  }, [viewState.offsetX, viewState.offsetY]);

  // Handle pan move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setViewState(prev => ({
        ...prev,
        offsetX: e.clientX - dragStart.x,
        offsetY: e.clientY - dragStart.y,
      }));
    }
  }, [isDragging, dragStart]);

  // Handle pan end
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle node interactions
  const handleNodeClick = useCallback((node: SphereNode) => {
    setViewState(prev => ({
      ...prev,
      selectedNodeIds: prev.selectedNodeIds.includes(node.id)
        ? prev.selectedNodeIds.filter(id => id !== node.id)
        : [node.id],
    }));
    onNodeClick?.(node);
  }, [onNodeClick]);

  const handleNodeHover = useCallback((node: SphereNode | null) => {
    setHoveredNodeId(node?.id || null);
    onNodeHover?.(node);
  }, [onNodeHover]);

  // Reset view
  const resetView = useCallback(() => {
    setViewState({
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      focusedNodeId: null,
      selectedNodeIds: [],
      highlightedSector: null,
    });
  }, []);

  // Center on a node
  const centerOnNode = useCallback((nodeId: string) => {
    const node = grid.nodes.get(nodeId);
    if (node) {
      setViewState(prev => ({
        ...prev,
        offsetX: width / 2 - node.x,
        offsetY: height / 2 - node.y,
        scale: 1.5,
        focusedNodeId: nodeId,
      }));
    }
  }, [grid.nodes, width, height]);

  // Transform string for the main group
  const transform = `translate(${viewState.offsetX}, ${viewState.offsetY}) scale(${viewState.scale})`;

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-zinc-950 ${className}`}>
      {/* Control buttons */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button
          onClick={resetView}
          className="px-3 py-1.5 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg backdrop-blur-sm border border-white/10 transition-colors"
        >
          Reset View
        </button>
        <button
          onClick={() => setViewState(prev => ({ ...prev, scale: prev.scale * 1.2 }))}
          className="px-3 py-1.5 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg backdrop-blur-sm border border-white/10 transition-colors"
        >
          +
        </button>
        <button
          onClick={() => setViewState(prev => ({ ...prev, scale: prev.scale * 0.8 }))}
          className="px-3 py-1.5 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg backdrop-blur-sm border border-white/10 transition-colors"
        >
          −
        </button>
      </div>

      {/* Stats overlay */}
      <div className="absolute bottom-4 left-4 z-10 bg-zinc-900/90 backdrop-blur-sm rounded-xl p-3 border border-white/10">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-emerald-400">{grid.stats.masteredNodes}</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Mastered</div>
          </div>
          <div>
            <div className="text-lg font-bold text-blue-400">{grid.stats.testReadyNodes}</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Test Ready</div>
          </div>
          <div>
            <div className="text-lg font-bold text-purple-400">{grid.stats.completionPercent}%</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Complete</div>
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={`${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Definitions for gradients and filters */}
        <defs>
          {/* Glow gradients for each state */}
          <radialGradient id="glow-mastered" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={colors.mastered} stopOpacity="0.6" />
            <stop offset="100%" stopColor={colors.mastered} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="glow-test_ready" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={colors.testReady} stopOpacity="0.8" />
            <stop offset="100%" stopColor={colors.testReady} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="glow-tested_passed" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={colors.testedPassed} stopOpacity="0.7" />
            <stop offset="100%" stopColor={colors.testedPassed} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="glow-legendary" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={colors.legendary} stopOpacity="0.9" />
            <stop offset="100%" stopColor={colors.legendary} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="glow-in_progress" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={colors.inProgress} stopOpacity="0.5" />
            <stop offset="100%" stopColor={colors.inProgress} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="glow-approaching" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={colors.approaching} stopOpacity="0.5" />
            <stop offset="100%" stopColor={colors.approaching} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="glow-available" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={colors.available} stopOpacity="0.3" />
            <stop offset="100%" stopColor={colors.available} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="glow-locked" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={colors.locked} stopOpacity="0.1" />
            <stop offset="100%" stopColor={colors.locked} stopOpacity="0" />
          </radialGradient>

          {/* Background radial gradient */}
          <radialGradient id="bg-gradient" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#1a1a2e" />
            <stop offset="100%" stopColor={colors.background} />
          </radialGradient>

          {/* Glow filter */}
          <filter id="glow-filter" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background */}
        <rect width={width} height={height} fill="url(#bg-gradient)" />

        {/* Main transform group */}
        <g transform={transform}>
          {/* Grid rings */}
          <GridRings
            centerX={grid.centerX}
            centerY={grid.centerY}
            maxRadius={grid.maxRadius}
            ringCount={8}
            colors={colors}
          />

          {/* Connections */}
          {showConnections && (
            <g className="connections">
              {grid.connections.map((conn, idx) => (
                <ConnectionLine
                  key={`${conn.from}-${conn.to}-${idx}`}
                  connection={conn}
                  nodes={grid.nodes}
                  colors={colors}
                  animated={animationsEnabled}
                />
              ))}
            </g>
          )}

          {/* Nodes - render in order: locked, then available, then active states on top */}
          <g className="nodes">
            {nodesArray
              .sort((a, b) => {
                const order: Record<NodeState, number> = {
                  locked: 0,
                  available: 1,
                  in_progress: 2,
                  approaching: 3,
                  mastered: 4,
                  test_ready: 5,
                  tested_passed: 6,
                  legendary: 7,
                };
                return order[a.state] - order[b.state];
              })
              .map((node) => (
                <GridNode
                  key={node.id}
                  node={node}
                  colors={colors}
                  isHovered={hoveredNodeId === node.id}
                  isSelected={viewState.selectedNodeIds.includes(node.id)}
                  showLabel={showLabels}
                  animated={animationsEnabled}
                  onClick={() => handleNodeClick(node)}
                  onMouseEnter={() => handleNodeHover(node)}
                  onMouseLeave={() => handleNodeHover(null)}
                />
              ))}
          </g>

          {/* Center marker */}
          <g transform={`translate(${grid.centerX}, ${grid.centerY})`}>
            <circle
              r={30}
              fill="none"
              stroke={colors.glowColor}
              strokeWidth={2}
              strokeDasharray="6 6"
              opacity={0.3}
              className="animate-spin-slow"
            />
            <circle
              r={8}
              fill={colors.glowColor}
              opacity={0.5}
            />
          </g>
        </g>
      </svg>

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -32;
          }
        }
        .animate-dash {
          animation: dash 1s linear infinite;
        }
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
        }
        @keyframes pulse-slow {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }
        .animate-pulse-slow {
          animation: pulse-slow 2s ease-in-out infinite;
        }
        @keyframes glow {
          0%, 100% {
            filter: drop-shadow(0 0 4px currentColor);
          }
          50% {
            filter: drop-shadow(0 0 12px currentColor);
          }
        }
        .animate-glow {
          animation: glow 2s ease-in-out infinite;
        }
        @keyframes beacon {
          0%, 100% {
            filter: drop-shadow(0 0 8px ${colors.testReady});
            transform: scale(1);
          }
          50% {
            filter: drop-shadow(0 0 20px ${colors.testReady});
            transform: scale(1.05);
          }
        }
        .animate-beacon {
          animation: beacon 1.5s ease-in-out infinite;
        }
        @keyframes sparkle {
          0%, 100% {
            filter: drop-shadow(0 0 4px ${colors.legendary})
                   drop-shadow(0 0 8px ${colors.legendary});
          }
          25% {
            filter: drop-shadow(0 0 12px ${colors.legendary})
                   drop-shadow(0 0 24px ${colors.legendary});
          }
          50% {
            filter: drop-shadow(0 0 6px ${colors.legendary});
          }
          75% {
            filter: drop-shadow(0 0 16px ${colors.legendary})
                   drop-shadow(0 0 32px ${colors.legendary});
          }
        }
        .animate-sparkle {
          animation: sparkle 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

export default SphereGridVisualization;
