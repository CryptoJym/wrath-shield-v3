'use client';

/**
 * SkillDashboard Component
 * Visual display of skill proficiencies with progress tracking
 * Shows individual skills, category summaries, and growth trends
 */

import { useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Minus, Star, Trophy,
  Target, ChevronDown, ChevronUp, Lock, Unlock
} from 'lucide-react';

export interface Skill {
  id: string;
  name: string;
  category: string;
  stat_name: string;
  proficiency_level: number;
  xp_current: number;
  xp_required: number;
  mastery_percent: number;
  last_practiced_at?: number;
  practice_count: number;
  trend: 'up' | 'down' | 'stable';
  is_unlocked: boolean;
  unlock_requirement?: string;
}

interface SkillDashboardProps {
  skills: Skill[];
  categoryFilter?: string;
  onSelectSkill?: (skill: Skill) => void;
}

const statColors: Record<string, string> = {
  strength: '#ef4444',
  intelligence: '#3b82f6',
  wisdom: '#a78bfa',
  charisma: '#f59e0b',
  dexterity: '#10b981',
  constitution: '#ec4899',
};

const categoryLabels: Record<string, string> = {
  mathematics: 'Math',
  reading: 'Reading',
  science: 'Science',
  history: 'History',
  language_arts: 'Language',
  critical_thinking: 'Thinking',
  communication: 'Communication',
  creativity: 'Creativity',
};

function getLevelLabel(level: number): string {
  if (level >= 90) return 'Master';
  if (level >= 75) return 'Expert';
  if (level >= 60) return 'Advanced';
  if (level >= 40) return 'Intermediate';
  if (level >= 20) return 'Novice';
  return 'Beginner';
}

function getLevelColor(level: number): string {
  if (level >= 90) return '#f59e0b';
  if (level >= 75) return '#a78bfa';
  if (level >= 60) return '#3b82f6';
  if (level >= 40) return '#10b981';
  if (level >= 20) return '#84cc16';
  return '#888';
}

export function SkillDashboard({ skills, categoryFilter, onSelectSkill }: SkillDashboardProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'level' | 'recent' | 'name'>('level');

  // Group skills by category
  const groupedSkills = useMemo(() => {
    const groups: Record<string, Skill[]> = {};

    skills.forEach((skill) => {
      if (categoryFilter && skill.category !== categoryFilter) return;

      if (!groups[skill.category]) {
        groups[skill.category] = [];
      }
      groups[skill.category].push(skill);
    });

    // Sort within each group
    Object.keys(groups).forEach((cat) => {
      groups[cat].sort((a, b) => {
        switch (sortBy) {
          case 'level':
            return b.proficiency_level - a.proficiency_level;
          case 'recent':
            return (b.last_practiced_at || 0) - (a.last_practiced_at || 0);
          case 'name':
            return a.name.localeCompare(b.name);
          default:
            return 0;
        }
      });
    });

    return groups;
  }, [skills, categoryFilter, sortBy]);

  // Calculate category averages
  const categoryStats = useMemo(() => {
    const stats: Record<string, { avg: number; count: number; unlocked: number }> = {};

    Object.entries(groupedSkills).forEach(([cat, catSkills]) => {
      const unlocked = catSkills.filter((s) => s.is_unlocked);
      stats[cat] = {
        avg: unlocked.length > 0
          ? unlocked.reduce((sum, s) => sum + s.proficiency_level, 0) / unlocked.length
          : 0,
        count: catSkills.length,
        unlocked: unlocked.length,
      };
    });

    return stats;
  }, [groupedSkills]);

  const toggleCategory = (cat: string) => {
    setExpandedCategory((prev) => (prev === cat ? null : cat));
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>Skill Proficiency</h2>
        <div style={styles.sortContainer}>
          <span style={styles.sortLabel}>Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            style={styles.sortSelect}
          >
            <option value="level">By Level</option>
            <option value="recent">Recently Practiced</option>
            <option value="name">Alphabetical</option>
          </select>
        </div>
      </div>

      {/* Category List */}
      <div style={styles.categoryList}>
        {Object.entries(groupedSkills).map(([category, catSkills]) => {
          const stats = categoryStats[category];
          const isExpanded = expandedCategory === category;

          return (
            <div key={category} style={styles.categorySection}>
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category)}
                style={styles.categoryHeader}
              >
                <div style={styles.categoryInfo}>
                  <h3 style={styles.categoryTitle}>
                    {categoryLabels[category] || category}
                  </h3>
                  <span style={styles.categoryCount}>
                    {stats.unlocked}/{stats.count} skills
                  </span>
                </div>

                {/* Category Progress */}
                <div style={styles.categoryProgress}>
                  <div style={styles.categoryBar}>
                    <div
                      style={{
                        ...styles.categoryFill,
                        width: `${stats.avg}%`,
                        background: getLevelColor(stats.avg),
                      }}
                    />
                  </div>
                  <span style={styles.categoryLevel}>{Math.round(stats.avg)}%</span>
                </div>

                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>

              {/* Expanded Skills */}
              {isExpanded && (
                <div style={styles.skillList}>
                  {catSkills.map((skill) => (
                    <div
                      key={skill.id}
                      onClick={() => skill.is_unlocked && onSelectSkill?.(skill)}
                      style={{
                        ...styles.skillCard,
                        ...(skill.is_unlocked ? {} : styles.skillCardLocked),
                        cursor: skill.is_unlocked && onSelectSkill ? 'pointer' : 'default',
                      }}
                    >
                      {/* Skill Header */}
                      <div style={styles.skillHeader}>
                        <div style={styles.skillName}>
                          {skill.is_unlocked ? (
                            <Unlock size={14} color="#10b981" />
                          ) : (
                            <Lock size={14} color="#666" />
                          )}
                          {skill.name}
                        </div>
                        <div style={styles.skillMeta}>
                          <span
                            style={{
                              ...styles.statBadge,
                              background: `${statColors[skill.stat_name] || '#888'}20`,
                              color: statColors[skill.stat_name] || '#888',
                            }}
                          >
                            {skill.stat_name}
                          </span>
                          {skill.is_unlocked && (
                            <>
                              {skill.trend === 'up' && <TrendingUp size={14} color="#10b981" />}
                              {skill.trend === 'down' && <TrendingDown size={14} color="#ef4444" />}
                              {skill.trend === 'stable' && <Minus size={14} color="#888" />}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {skill.is_unlocked ? (
                        <>
                          <div style={styles.progressContainer}>
                            <div style={styles.progressBar}>
                              <div
                                style={{
                                  ...styles.progressFill,
                                  width: `${skill.proficiency_level}%`,
                                  background: `linear-gradient(90deg, ${getLevelColor(skill.proficiency_level)}, ${getLevelColor(skill.proficiency_level)}dd)`,
                                }}
                              />
                            </div>
                            <span style={styles.progressText}>{skill.proficiency_level}%</span>
                          </div>

                          {/* Skill Details */}
                          <div style={styles.skillDetails}>
                            <span
                              style={{
                                ...styles.levelBadge,
                                color: getLevelColor(skill.proficiency_level),
                              }}
                            >
                              <Star size={12} />
                              {getLevelLabel(skill.proficiency_level)}
                            </span>
                            <span style={styles.xpInfo}>
                              {skill.xp_current}/{skill.xp_required} XP
                            </span>
                            <span style={styles.practiceCount}>
                              <Target size={12} />
                              {skill.practice_count} practices
                            </span>
                          </div>
                        </>
                      ) : (
                        <div style={styles.lockInfo}>
                          <Lock size={16} />
                          {skill.unlock_requirement || 'Complete prerequisites to unlock'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {Object.keys(groupedSkills).length === 0 && (
        <div style={styles.emptyState}>
          <Trophy size={48} style={{ opacity: 0.3 }} />
          <h3>No Skills Available</h3>
          <p style={{ color: '#888' }}>
            Start learning to unlock new skills!
          </p>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  title: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: 700,
  },
  sortContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  sortLabel: {
    fontSize: '0.75rem',
    color: '#888',
    textTransform: 'uppercase',
  },
  sortSelect: {
    padding: '0.375rem 0.75rem',
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '0.375rem',
    color: '#fff',
    fontSize: '0.875rem',
    cursor: 'pointer',
  },
  categoryList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  categorySection: {
    background: '#1a1a1a',
    borderRadius: '0.75rem',
    border: '1px solid #333',
    overflow: 'hidden',
  },
  categoryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    width: '100%',
    padding: '1rem',
    background: 'transparent',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    textAlign: 'left',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryTitle: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 600,
    textTransform: 'capitalize',
  },
  categoryCount: {
    fontSize: '0.75rem',
    color: '#888',
  },
  categoryProgress: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    width: '150px',
  },
  categoryBar: {
    flex: 1,
    height: '6px',
    background: '#333',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  categoryFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  categoryLevel: {
    fontSize: '0.875rem',
    fontWeight: 600,
    minWidth: '40px',
    textAlign: 'right',
  },
  skillList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    padding: '0 1rem 1rem 1rem',
  },
  skillCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    padding: '0.875rem',
    background: '#0f0f0f',
    borderRadius: '0.5rem',
    border: '1px solid #333',
    transition: 'all 0.2s ease',
  },
  skillCardLocked: {
    opacity: 0.5,
  },
  skillHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skillName: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontWeight: 500,
  },
  skillMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  statBadge: {
    padding: '0.125rem 0.5rem',
    borderRadius: '999px',
    fontSize: '0.6875rem',
    fontWeight: 500,
    textTransform: 'capitalize',
  },
  progressContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  progressBar: {
    flex: 1,
    height: '8px',
    background: '#333',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  progressText: {
    fontSize: '0.875rem',
    fontWeight: 600,
    minWidth: '40px',
    textAlign: 'right',
  },
  skillDetails: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  levelBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.75rem',
    fontWeight: 500,
  },
  xpInfo: {
    fontSize: '0.75rem',
    color: '#888',
  },
  practiceCount: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.75rem',
    color: '#888',
  },
  lockInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.8125rem',
    color: '#666',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem',
    gap: '1rem',
    textAlign: 'center',
  },
};

export default SkillDashboard;
