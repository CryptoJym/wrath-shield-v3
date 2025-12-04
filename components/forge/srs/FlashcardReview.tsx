'use client';

/**
 * FlashcardReview Component
 * Interactive flashcard review with flip animation and spaced repetition rating
 */

import { useState, useCallback, useEffect } from 'react';
import {
  RotateCcw, CheckCircle, XCircle, Brain, Zap,
  ChevronLeft, ChevronRight, Clock, Target
} from 'lucide-react';

export interface Card {
  id: string;
  front_content: string;
  back_content: string;
  card_type: string;
  category?: string;
  difficulty: number;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  stat_name?: string;
  source_type?: string;
  source_id?: string;
  tags?: string[];
  next_review_at: number;
  created_at: number;
}

interface FlashcardReviewProps {
  cards: Card[];
  onReviewCard: (cardId: string, quality: number, responseTimeMs: number) => Promise<ReviewResult>;
  onComplete: (summary: ReviewSummary) => void;
}

interface ReviewResult {
  card_id: string;
  new_interval: number;
  new_ease_factor: number;
  next_review_at: number;
  xp_earned: number;
}

interface ReviewSummary {
  total_cards: number;
  correct: number;
  incorrect: number;
  accuracy: number;
  total_xp: number;
  avg_response_time_ms: number;
}

type Quality = 0 | 1 | 2 | 3 | 4 | 5;

const qualityLabels: Record<Quality, { label: string; color: string; description: string }> = {
  0: { label: 'Blackout', color: '#ef4444', description: 'Complete failure to recall' },
  1: { label: 'Wrong', color: '#f97316', description: 'Incorrect response but recognized' },
  2: { label: 'Hard', color: '#f59e0b', description: 'Correct with serious difficulty' },
  3: { label: 'Good', color: '#84cc16', description: 'Correct with some hesitation' },
  4: { label: 'Easy', color: '#22c55e', description: 'Correct with minor hesitation' },
  5: { label: 'Perfect', color: '#10b981', description: 'Perfect response, instant recall' },
};

export function FlashcardReview({ cards, onReviewCard, onComplete }: FlashcardReviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ReviewResult[]>([]);
  const [responseTimes, setResponseTimes] = useState<number[]>([]);

  const currentCard = cards[currentIndex];
  const progress = ((currentIndex) / cards.length) * 100;
  const isComplete = currentIndex >= cards.length;

  // Reset timer when card changes
  useEffect(() => {
    setStartTime(Date.now());
    setIsFlipped(false);
  }, [currentIndex]);

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const handleRate = useCallback(async (quality: Quality) => {
    if (!currentCard || isLoading) return;

    const responseTime = Date.now() - startTime;
    setIsLoading(true);

    try {
      const result = await onReviewCard(currentCard.id, quality, responseTime);
      setResults((prev) => [...prev, result]);
      setResponseTimes((prev) => [...prev, responseTime]);

      // Move to next card
      setCurrentIndex((prev) => prev + 1);
    } catch (error) {
      console.error('Failed to submit review:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentCard, startTime, onReviewCard, isLoading]);

  // Complete handler
  useEffect(() => {
    if (isComplete && results.length > 0) {
      const correct = results.filter((_, i) => {
        // Find the quality rating (we infer from XP earned)
        return results[i].xp_earned >= 8; // Good or better ratings
      }).length;

      const summary: ReviewSummary = {
        total_cards: results.length,
        correct,
        incorrect: results.length - correct,
        accuracy: (correct / results.length) * 100,
        total_xp: results.reduce((sum, r) => sum + r.xp_earned, 0),
        avg_response_time_ms: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      };

      onComplete(summary);
    }
  }, [isComplete, results, responseTimes, onComplete]);

  if (cards.length === 0) {
    return (
      <div style={styles.emptyState}>
        <Brain size={48} style={{ opacity: 0.3 }} />
        <h3>No cards to review!</h3>
        <p style={{ color: '#888' }}>All caught up. Check back later.</p>
      </div>
    );
  }

  if (isComplete) {
    return null; // Parent handles completion view
  }

  return (
    <div style={styles.container}>
      {/* Progress Bar */}
      <div style={styles.progressContainer}>
        <div style={styles.progressBar}>
          <div style={{ ...styles.progressFill, width: `${progress}%` }} />
        </div>
        <span style={styles.progressText}>
          {currentIndex + 1} / {cards.length}
        </span>
      </div>

      {/* Card Info */}
      <div style={styles.cardMeta}>
        {currentCard.category && (
          <span style={styles.categoryBadge}>{currentCard.category}</span>
        )}
        {currentCard.stat_name && (
          <span style={styles.statBadge}>{currentCard.stat_name}</span>
        )}
        <span style={styles.difficultyBadge}>
          Level {currentCard.difficulty}
        </span>
      </div>

      {/* Flashcard */}
      <div
        style={styles.cardContainer}
        onClick={handleFlip}
      >
        <div
          style={{
            ...styles.card,
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Front */}
          <div style={styles.cardFace}>
            <div style={styles.cardLabel}>Question</div>
            <div style={styles.cardContent}>
              {currentCard.front_content}
            </div>
            <div style={styles.flipHint}>
              <RotateCcw size={16} />
              Tap to reveal answer
            </div>
          </div>

          {/* Back */}
          <div style={{ ...styles.cardFace, ...styles.cardBack }}>
            <div style={styles.cardLabel}>Answer</div>
            <div style={styles.cardContent}>
              {currentCard.back_content}
            </div>
          </div>
        </div>
      </div>

      {/* Rating Buttons - Only shown when flipped */}
      {isFlipped && (
        <div style={styles.ratingSection}>
          <p style={styles.ratingPrompt}>How well did you know this?</p>
          <div style={styles.ratingButtons}>
            {([0, 1, 2, 3, 4, 5] as Quality[]).map((q) => (
              <button
                key={q}
                onClick={() => handleRate(q)}
                disabled={isLoading}
                style={{
                  ...styles.ratingButton,
                  borderColor: qualityLabels[q].color,
                  color: qualityLabels[q].color,
                }}
                title={qualityLabels[q].description}
              >
                {q < 2 ? <XCircle size={16} /> : <CheckCircle size={16} />}
                <span style={styles.ratingLabel}>{qualityLabels[q].label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Timer */}
      <div style={styles.timer}>
        <Clock size={14} />
        {Math.round((Date.now() - startTime) / 1000)}s
      </div>

      {/* Keyboard shortcuts hint */}
      <div style={styles.shortcuts}>
        <span>Space: Flip</span>
        <span>1-6: Rate</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.5rem',
    padding: '1rem',
    maxWidth: '600px',
    margin: '0 auto',
  },
  progressContainer: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
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
    background: 'linear-gradient(90deg, #f59e0b, #10b981)',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  progressText: {
    fontSize: '0.875rem',
    color: '#888',
    minWidth: '60px',
    textAlign: 'right',
  },
  cardMeta: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  categoryBadge: {
    padding: '0.25rem 0.75rem',
    background: 'rgba(139, 92, 246, 0.1)',
    color: '#a78bfa',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 500,
    textTransform: 'capitalize',
  },
  statBadge: {
    padding: '0.25rem 0.75rem',
    background: 'rgba(59, 130, 246, 0.1)',
    color: '#60a5fa',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 500,
    textTransform: 'capitalize',
  },
  difficultyBadge: {
    padding: '0.25rem 0.75rem',
    background: 'rgba(245, 158, 11, 0.1)',
    color: '#f59e0b',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 500,
  },
  cardContainer: {
    width: '100%',
    maxWidth: '500px',
    height: '300px',
    perspective: '1000px',
    cursor: 'pointer',
  },
  card: {
    width: '100%',
    height: '100%',
    position: 'relative',
    transformStyle: 'preserve-3d',
    transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  cardFace: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    background: 'linear-gradient(135deg, #1a1a1a, #2a2a2a)',
    border: '2px solid #333',
    borderRadius: '1rem',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
  },
  cardBack: {
    transform: 'rotateY(180deg)',
    background: 'linear-gradient(135deg, #1e293b, #0f172a)',
    borderColor: '#10b981',
  },
  cardLabel: {
    position: 'absolute',
    top: '1rem',
    left: '1rem',
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: '#666',
  },
  cardContent: {
    fontSize: '1.25rem',
    textAlign: 'center',
    lineHeight: 1.5,
    maxHeight: '200px',
    overflow: 'auto',
  },
  flipHint: {
    position: 'absolute',
    bottom: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.75rem',
    color: '#666',
  },
  ratingSection: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
  },
  ratingPrompt: {
    fontSize: '0.9375rem',
    color: '#888',
    margin: 0,
  },
  ratingButtons: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.5rem',
    width: '100%',
    maxWidth: '400px',
  },
  ratingButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.75rem 0.5rem',
    background: 'transparent',
    border: '2px solid',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  ratingLabel: {
    fontSize: '0.75rem',
    fontWeight: 500,
  },
  timer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.875rem',
    color: '#666',
  },
  shortcuts: {
    display: 'flex',
    gap: '1.5rem',
    fontSize: '0.75rem',
    color: '#555',
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

export default FlashcardReview;
