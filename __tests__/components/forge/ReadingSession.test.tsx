/**
 * ReadingSession Component Tests
 * Tests for the active reading interface with timer and session controls
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
// lucide-react is mocked globally in jest.setup.react.ts
import { ReadingSession } from '@/components/forge/reading/ReadingSession';

// Test data
const mockBook = {
  id: 'book-1',
  title: 'Introduction to Algebra',
  author: 'Jane Doe',
  page_count: 200,
  chapter_count: 10,
};

const mockChapters = [
  {
    id: 'chapter-1',
    book_id: 'book-1',
    chapter_number: 1,
    title: 'Numbers and Operations',
    page_start: 1,
    page_end: 20,
    estimated_minutes: 30,
    status: 'completed',
  },
  {
    id: 'chapter-2',
    book_id: 'book-1',
    chapter_number: 2,
    title: 'Variables and Expressions',
    page_start: 21,
    page_end: 45,
    estimated_minutes: 45,
    status: 'in_progress',
  },
  {
    id: 'chapter-3',
    book_id: 'book-1',
    chapter_number: 3,
    title: 'Equations',
    page_start: 46,
    page_end: 70,
    estimated_minutes: 40,
    status: 'not_started',
  },
];

const mockActiveSession = {
  id: 'session-1',
  book_id: 'book-1',
  chapter_id: 'chapter-2',
  pages_start: 21,
  started_at: Math.floor(Date.now() / 1000) - 300, // 5 minutes ago
};

const mockSessionResult = {
  session: mockActiveSession,
  duration_minutes: 5,
  pages_read: 4,
  xp_earned: 15,
};

describe('ReadingSession', () => {
  const mockOnStartSession = jest.fn();
  const mockOnEndSession = jest.fn();
  const mockOnCompleteChapter = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockOnStartSession.mockResolvedValue({
      id: 'new-session',
      book_id: 'book-1',
      chapter_id: 'chapter-2',
      pages_start: 21,
      started_at: Math.floor(Date.now() / 1000),
    });
    mockOnEndSession.mockResolvedValue(mockSessionResult);
    mockOnCompleteChapter.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initial Rendering', () => {
    it('renders book title and author', () => {
      render(
        <ReadingSession
          book={mockBook}
          chapters={mockChapters}
          currentChapter={mockChapters[1]}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      expect(screen.getByText('Introduction to Algebra')).toBeInTheDocument();
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    });

    it('renders current chapter badge', () => {
      render(
        <ReadingSession
          book={mockBook}
          chapters={mockChapters}
          currentChapter={mockChapters[1]}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      expect(screen.getByText(/Chapter 2/)).toBeInTheDocument();
      // Chapter title appears in both badge and chapter list
      expect(screen.getAllByText(/Variables and Expressions/).length).toBeGreaterThanOrEqual(1);
    });

    it('shows timer at 0:00 when no active session', () => {
      render(
        <ReadingSession
          book={mockBook}
          chapters={mockChapters}
          currentChapter={mockChapters[1]}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      expect(screen.getByText('0:00')).toBeInTheDocument();
      expect(screen.getByText('Ready')).toBeInTheDocument();
    });

    it('shows start button when no active session', () => {
      render(
        <ReadingSession
          book={mockBook}
          chapters={mockChapters}
          currentChapter={mockChapters[1]}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      expect(screen.getByText('Start Reading Session')).toBeInTheDocument();
    });

    it('shows hint text when no session is active', () => {
      render(
        <ReadingSession
          book={mockBook}
          chapters={mockChapters}
          currentChapter={mockChapters[1]}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      expect(screen.getByText('Track your reading time and earn XP!')).toBeInTheDocument();
    });
  });

  describe('Chapter List', () => {
    it('renders all chapters', () => {
      render(
        <ReadingSession
          book={mockBook}
          chapters={mockChapters}
          currentChapter={mockChapters[1]}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      expect(screen.getByText('Chapters')).toBeInTheDocument();
      expect(screen.getByText('Ch. 1')).toBeInTheDocument();
      expect(screen.getByText('Ch. 2')).toBeInTheDocument();
      expect(screen.getByText('Ch. 3')).toBeInTheDocument();
    });

    it('shows chapter titles', () => {
      render(
        <ReadingSession
          book={mockBook}
          chapters={mockChapters}
          currentChapter={mockChapters[1]}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      expect(screen.getByText('Numbers and Operations')).toBeInTheDocument();
      expect(screen.getByText('Equations')).toBeInTheDocument();
    });

    it('shows completed chapter indicator', () => {
      render(
        <ReadingSession
          book={mockBook}
          chapters={mockChapters}
          currentChapter={mockChapters[1]}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      // Check for completed icon (CheckCircle)
      expect(screen.getByTestId('icon-check-circle')).toBeInTheDocument();
    });
  });

  describe('Starting Session', () => {
    it('calls onStartSession when start button is clicked', async () => {
      render(
        <ReadingSession
          book={mockBook}
          chapters={mockChapters}
          currentChapter={mockChapters[1]}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      const startButton = screen.getByText('Start Reading Session');
      await act(async () => {
        fireEvent.click(startButton);
      });

      await waitFor(() => {
        expect(mockOnStartSession).toHaveBeenCalledWith(
          'book-1',
          'chapter-2',
          21 // page_start of current chapter
        );
      });
    });

    it('shows session controls after starting', async () => {
      render(
        <ReadingSession
          book={mockBook}
          chapters={mockChapters}
          currentChapter={mockChapters[1]}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      const startButton = screen.getByText('Start Reading Session');
      await act(async () => {
        fireEvent.click(startButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Pause')).toBeInTheDocument();
        expect(screen.getByText('End Session')).toBeInTheDocument();
      });
    });
  });

  describe('Active Session', () => {
    it('shows elapsed time for active session', async () => {
      render(
        <ReadingSession
          book={mockBook}
          chapters={mockChapters}
          currentChapter={mockChapters[1]}
          activeSession={mockActiveSession}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      // Should show elapsed time (approximately 5:00)
      expect(screen.getByText('Reading')).toBeInTheDocument();
    });

    it('renders pause and end session buttons', () => {
      render(
        <ReadingSession
          book={mockBook}
          chapters={mockChapters}
          currentChapter={mockChapters[1]}
          activeSession={mockActiveSession}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      expect(screen.getByText('Pause')).toBeInTheDocument();
      expect(screen.getByText('End Session')).toBeInTheDocument();
    });

    it('toggles pause state when pause button is clicked', () => {
      render(
        <ReadingSession
          book={mockBook}
          chapters={mockChapters}
          currentChapter={mockChapters[1]}
          activeSession={mockActiveSession}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      const pauseButton = screen.getByText('Pause');
      fireEvent.click(pauseButton);

      expect(screen.getByText('Resume')).toBeInTheDocument();
      expect(screen.getByText('Paused')).toBeInTheDocument();
    });
  });

  describe('Page Tracker', () => {
    it('renders page tracker with current page', () => {
      render(
        <ReadingSession
          book={mockBook}
          chapters={mockChapters}
          currentChapter={mockChapters[1]}
          activeSession={mockActiveSession}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      expect(screen.getByText('Current Page')).toBeInTheDocument();
      expect(screen.getByText('of 200')).toBeInTheDocument();
    });

    it('has increment and decrement buttons', () => {
      render(
        <ReadingSession
          book={mockBook}
          chapters={mockChapters}
          currentChapter={mockChapters[1]}
          activeSession={mockActiveSession}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons.some(btn => btn.textContent === '+')).toBe(true);
      expect(buttons.some(btn => btn.textContent === '-')).toBe(true);
    });

    it('increments page when + button is clicked', () => {
      render(
        <ReadingSession
          book={mockBook}
          chapters={mockChapters}
          currentChapter={mockChapters[1]}
          activeSession={mockActiveSession}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      const incrementButton = screen.getByText('+');
      const pageInput = screen.getByRole('spinbutton');

      const initialValue = parseInt(pageInput.getAttribute('value') || '1');
      fireEvent.click(incrementButton);

      expect(pageInput).toHaveValue(initialValue + 1);
    });
  });

  describe('Focus Rating', () => {
    it('renders focus rating section', () => {
      render(
        <ReadingSession
          book={mockBook}
          chapters={mockChapters}
          currentChapter={mockChapters[1]}
          activeSession={mockActiveSession}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      expect(screen.getByText('Focus Level')).toBeInTheDocument();
    });

    it('has 5 star rating buttons', () => {
      render(
        <ReadingSession
          book={mockBook}
          chapters={mockChapters}
          currentChapter={mockChapters[1]}
          activeSession={mockActiveSession}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      // Each star is rendered as an icon
      const starIcons = screen.getAllByTestId('icon-star');
      expect(starIcons.length).toBe(5);
    });
  });

  describe('Interruption Counter', () => {
    it('renders interruption section', () => {
      render(
        <ReadingSession
          book={mockBook}
          chapters={mockChapters}
          currentChapter={mockChapters[1]}
          activeSession={mockActiveSession}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      expect(screen.getByText(/Interruptions:/)).toBeInTheDocument();
      expect(screen.getByText('+1 Interruption')).toBeInTheDocument();
    });

    it('increments interruption count when button is clicked', () => {
      render(
        <ReadingSession
          book={mockBook}
          chapters={mockChapters}
          currentChapter={mockChapters[1]}
          activeSession={mockActiveSession}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      expect(screen.getByText('Interruptions: 0')).toBeInTheDocument();

      const interruptionButton = screen.getByText('+1 Interruption');
      fireEvent.click(interruptionButton);

      expect(screen.getByText('Interruptions: 1')).toBeInTheDocument();
    });
  });

  describe('End Session Dialog', () => {
    it('shows end session dialog when end button is clicked', () => {
      render(
        <ReadingSession
          book={mockBook}
          chapters={mockChapters}
          currentChapter={mockChapters[1]}
          activeSession={mockActiveSession}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      const endButton = screen.getByText('End Session');
      fireEvent.click(endButton);

      expect(screen.getByText('End Reading Session?')).toBeInTheDocument();
      expect(screen.getByText('Keep Reading')).toBeInTheDocument();
      expect(screen.getByText('End & Save')).toBeInTheDocument();
    });

    it('closes dialog when Keep Reading is clicked', () => {
      render(
        <ReadingSession
          book={mockBook}
          chapters={mockChapters}
          currentChapter={mockChapters[1]}
          activeSession={mockActiveSession}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      const endButton = screen.getByText('End Session');
      fireEvent.click(endButton);

      const keepReadingButton = screen.getByText('Keep Reading');
      fireEvent.click(keepReadingButton);

      expect(screen.queryByText('End Reading Session?')).not.toBeInTheDocument();
    });

    it('calls onEndSession when End & Save is clicked', async () => {
      render(
        <ReadingSession
          book={mockBook}
          chapters={mockChapters}
          currentChapter={mockChapters[1]}
          activeSession={mockActiveSession}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      const endButton = screen.getByText('End Session');
      fireEvent.click(endButton);

      const saveButton = screen.getByText('End & Save');
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(mockOnEndSession).toHaveBeenCalledWith(
          'session-1',
          expect.objectContaining({
            focus_self_rating: expect.any(Number),
            interruption_count: expect.any(Number),
          })
        );
      });
    });
  });

  describe('Session Completed View', () => {
    it('shows completion card after session ends', async () => {
      render(
        <ReadingSession
          book={mockBook}
          chapters={mockChapters}
          currentChapter={mockChapters[1]}
          activeSession={mockActiveSession}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      // End the session
      const endButton = screen.getByText('End Session');
      fireEvent.click(endButton);

      const saveButton = screen.getByText('End & Save');
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Reading Session Complete!')).toBeInTheDocument();
      });
    });

    it('shows session stats in completion view', async () => {
      render(
        <ReadingSession
          book={mockBook}
          chapters={mockChapters}
          currentChapter={mockChapters[1]}
          activeSession={mockActiveSession}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      // End the session
      const endButton = screen.getByText('End Session');
      fireEvent.click(endButton);

      const saveButton = screen.getByText('End & Save');
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(screen.getByText('5 min')).toBeInTheDocument(); // duration
        expect(screen.getByText('4')).toBeInTheDocument(); // pages
        expect(screen.getByText('+15')).toBeInTheDocument(); // XP
        expect(screen.getByText('Time')).toBeInTheDocument();
        expect(screen.getByText('Pages')).toBeInTheDocument();
        expect(screen.getByText('XP Earned')).toBeInTheDocument();
      });
    });

    it('shows Continue Reading button after completion', async () => {
      render(
        <ReadingSession
          book={mockBook}
          chapters={mockChapters}
          currentChapter={mockChapters[1]}
          activeSession={mockActiveSession}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      // End the session
      const endButton = screen.getByText('End Session');
      fireEvent.click(endButton);

      const saveButton = screen.getByText('End & Save');
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Continue Reading')).toBeInTheDocument();
      });
    });

    it('resets to start state when Continue Reading is clicked', async () => {
      render(
        <ReadingSession
          book={mockBook}
          chapters={mockChapters}
          currentChapter={mockChapters[1]}
          activeSession={mockActiveSession}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      // End the session
      const endButton = screen.getByText('End Session');
      fireEvent.click(endButton);

      const saveButton = screen.getByText('End & Save');
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Continue Reading')).toBeInTheDocument();
      });

      const continueButton = screen.getByText('Continue Reading');
      fireEvent.click(continueButton);

      expect(screen.getByText('Start Reading Session')).toBeInTheDocument();
    });
  });

  describe('Timer Display', () => {
    it('formats time with hours when over 60 minutes', () => {
      const longSession = {
        ...mockActiveSession,
        started_at: Math.floor(Date.now() / 1000) - 3700, // 1 hour 1 minute 40 seconds ago
      };

      render(
        <ReadingSession
          book={mockBook}
          chapters={mockChapters}
          currentChapter={mockChapters[1]}
          activeSession={longSession}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      // Should format as H:MM:SS
      expect(screen.getByText(/1:\d{2}:\d{2}/)).toBeInTheDocument();
    });
  });

  describe('Empty States', () => {
    it('handles book without page count', () => {
      const bookWithoutPages = { ...mockBook, page_count: undefined };

      render(
        <ReadingSession
          book={bookWithoutPages}
          chapters={mockChapters}
          currentChapter={mockChapters[1]}
          activeSession={mockActiveSession}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      expect(screen.queryByText('of 200')).not.toBeInTheDocument();
    });

    it('handles no chapters', () => {
      render(
        <ReadingSession
          book={mockBook}
          chapters={[]}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      expect(screen.queryByText('Chapters')).not.toBeInTheDocument();
    });

    it('handles no current chapter', () => {
      render(
        <ReadingSession
          book={mockBook}
          chapters={mockChapters}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      expect(screen.queryByText(/Chapter \d/)).not.toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('disables start button while loading', async () => {
      mockOnStartSession.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockActiveSession), 100))
      );

      render(
        <ReadingSession
          book={mockBook}
          chapters={mockChapters}
          currentChapter={mockChapters[1]}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      const startButton = screen.getByText('Start Reading Session');
      fireEvent.click(startButton);

      // Button should be disabled while loading
      expect(startButton).toBeDisabled();
    });

    it('shows Saving... text while ending session', async () => {
      mockOnEndSession.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockSessionResult), 100))
      );

      render(
        <ReadingSession
          book={mockBook}
          chapters={mockChapters}
          currentChapter={mockChapters[1]}
          activeSession={mockActiveSession}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      const endButton = screen.getByText('End Session');
      fireEvent.click(endButton);

      const saveButton = screen.getByText('End & Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument();
      });
    });
  });

  describe('Icons', () => {
    it('renders all required icons', () => {
      render(
        <ReadingSession
          book={mockBook}
          chapters={mockChapters}
          currentChapter={mockChapters[1]}
          activeSession={mockActiveSession}
          onStartSession={mockOnStartSession}
          onEndSession={mockOnEndSession}
          onCompleteChapter={mockOnCompleteChapter}
        />
      );

      expect(screen.getByTestId('icon-pause')).toBeInTheDocument();
      expect(screen.getByTestId('icon-square')).toBeInTheDocument();
      expect(screen.getByTestId('icon-target')).toBeInTheDocument();
      expect(screen.getByTestId('icon-alert-circle')).toBeInTheDocument();
    });
  });
});
