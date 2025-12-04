'use client';

/**
 * HYRO FORGE: Skill Proficiency Page
 * Detailed view of skill progress and mastery levels
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Trophy, Loader2, Target, Star, TrendingUp, Brain } from 'lucide-react';
import Link from 'next/link';
import { SkillDashboard, type Skill } from '@/components/forge/proficiency';

interface ProficiencyStats {
  total_skills: number;
  unlocked_skills: number;
  mastered_skills: number;
  avg_proficiency: number;
  total_practice_sessions: number;
  strongest_category: string;
  weakest_category: string;
}

const categoryList = [
  { value: '', label: 'All Categories' },
  { value: 'mathematics', label: 'Mathematics' },
  { value: 'reading', label: 'Reading' },
  { value: 'science', label: 'Science' },
  { value: 'history', label: 'History' },
  { value: 'language_arts', label: 'Language Arts' },
  { value: 'critical_thinking', label: 'Critical Thinking' },
  { value: 'communication', label: 'Communication' },
  { value: 'creativity', label: 'Creativity' },
];

export default function ProficiencyPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [stats, setStats] = useState<ProficiencyStats | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch skills and stats
  const fetchProficiency = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/hyro/proficiency');
      if (!response.ok) throw new Error('Failed to fetch proficiency data');

      const data = await response.json();
      setSkills(data.skills || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load proficiency');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProficiency();
  }, [fetchProficiency]);

  // Calculate stat summaries
  const statSummaries = useMemo(() => {
    const summaries: Record<string, { count: number; avgLevel: number }> = {};

    skills.forEach((skill) => {
      if (!skill.is_unlocked) return;

      if (!summaries[skill.stat_name]) {
        summaries[skill.stat_name] = { count: 0, avgLevel: 0 };
      }
      summaries[skill.stat_name].count++;
      summaries[skill.stat_name].avgLevel += skill.proficiency_level;
    });

    // Calculate averages
    Object.keys(summaries).forEach((stat) => {
      if (summaries[stat].count > 0) {
        summaries[stat].avgLevel /= summaries[stat].count;
      }
    });

    return summaries;
  }, [skills]);

  if (loading && skills.length === 0) {
    return (
      <div style={styles.loadingContainer}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
        <span>Loading skill proficiency...</span>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <Link href="/hyro/forge" style={styles.backButton}>
            <ArrowLeft size={20} />
            Back to Forge
          </Link>
          <h1 style={styles.title}>
            <Trophy size={28} style={{ color: '#f59e0b' }} />
            Skill Proficiency
          </h1>
        </div>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={styles.categorySelect}
        >
          {categoryList.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </header>

      {/* Stats Bar */}
      {stats && (
        <div style={styles.statsBar}>
          <div style={styles.statItem}>
            <Target size={16} />
            <span style={styles.statValue}>
              {stats.unlocked_skills}/{stats.total_skills}
            </span>
            <span style={styles.statLabel}>Unlocked</span>
          </div>
          <div style={styles.statItem}>
            <Star size={16} color="#f59e0b" />
            <span style={styles.statValue}>{stats.mastered_skills}</span>
            <span style={styles.statLabel}>Mastered</span>
          </div>
          <div style={styles.statItem}>
            <TrendingUp size={16} color="#10b981" />
            <span style={styles.statValue}>{Math.round(stats.avg_proficiency)}%</span>
            <span style={styles.statLabel}>Average</span>
          </div>
          <div style={styles.statItem}>
            <Brain size={16} color="#a78bfa" />
            <span style={styles.statValue}>{stats.total_practice_sessions}</span>
            <span style={styles.statLabel}>Practices</span>
          </div>
        </div>
      )}

      {/* Stat Summaries */}
      {Object.keys(statSummaries).length > 0 && (
        <div style={styles.statSummaries}>
          {Object.entries(statSummaries).map(([stat, data]) => (
            <div key={stat} style={styles.statSummaryCard}>
              <span style={styles.statSummaryName}>{stat}</span>
              <div style={styles.statSummaryBar}>
                <div
                  style={{
                    ...styles.statSummaryFill,
                    width: `${data.avgLevel}%`,
                  }}
                />
              </div>
              <span style={styles.statSummaryValue}>{Math.round(data.avgLevel)}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Strength/Weakness Hints */}
      {stats && stats.strongest_category && stats.weakest_category && (
        <div style={styles.hintBar}>
          <div style={styles.hint}>
            <TrendingUp size={14} color="#10b981" />
            <span>Strongest: </span>
            <strong style={{ color: '#10b981', textTransform: 'capitalize' }}>
              {stats.strongest_category.replace('_', ' ')}
            </strong>
          </div>
          <div style={styles.hint}>
            <Target size={14} color="#f59e0b" />
            <span>Focus Area: </span>
            <strong style={{ color: '#f59e0b', textTransform: 'capitalize' }}>
              {stats.weakest_category.replace('_', ' ')}
            </strong>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div style={styles.error}>
          {error}
          <button onClick={fetchProficiency} style={styles.retryButton}>
            Retry
          </button>
        </div>
      )}

      {/* Main Content */}
      <main style={styles.main}>
        <SkillDashboard
          skills={skills}
          categoryFilter={categoryFilter || undefined}
        />
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '50vh',
    gap: '1rem',
    color: '#888',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem',
    borderBottom: '1px solid #333',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    background: 'transparent',
    border: '1px solid #333',
    borderRadius: '0.375rem',
    color: '#888',
    textDecoration: 'none',
    fontSize: '0.875rem',
    cursor: 'pointer',
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: 0,
  },
  categorySelect: {
    padding: '0.5rem 1rem',
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '0.5rem',
    color: '#fff',
    fontSize: '0.875rem',
    cursor: 'pointer',
  },
  statsBar: {
    display: 'flex',
    gap: '2rem',
    padding: '1rem',
    background: '#1a1a1a',
    borderBottom: '1px solid #333',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: '#888',
  },
  statValue: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#fff',
  },
  statLabel: {
    fontSize: '0.75rem',
    textTransform: 'uppercase',
  },
  statSummaries: {
    display: 'flex',
    gap: '0.75rem',
    padding: '1rem',
    background: '#0f0f0f',
    borderBottom: '1px solid #333',
    overflowX: 'auto',
    flexWrap: 'nowrap',
  },
  statSummaryCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0.875rem',
    background: '#1a1a1a',
    borderRadius: '0.5rem',
    border: '1px solid #333',
    minWidth: 'fit-content',
  },
  statSummaryName: {
    fontSize: '0.75rem',
    fontWeight: 500,
    textTransform: 'capitalize',
    color: '#ccc',
    minWidth: '70px',
  },
  statSummaryBar: {
    width: '60px',
    height: '6px',
    background: '#333',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  statSummaryFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #f59e0b, #10b981)',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  statSummaryValue: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#888',
    minWidth: '30px',
    textAlign: 'right',
  },
  hintBar: {
    display: 'flex',
    gap: '2rem',
    padding: '0.75rem 1rem',
    background: '#0f0f0f',
    borderBottom: '1px solid #333',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  hint: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.8125rem',
    color: '#888',
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    padding: '1rem',
    background: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
  },
  retryButton: {
    padding: '0.5rem 1rem',
    background: '#ef4444',
    border: 'none',
    borderRadius: '0.375rem',
    color: '#fff',
    cursor: 'pointer',
  },
  main: {
    flex: 1,
    padding: '1rem',
    maxWidth: '900px',
    margin: '0 auto',
    width: '100%',
  },
};
