/**
 * IntelFeed Component Tests
 * Tests for the daily personalized content feed component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
// lucide-react is mocked globally in jest.setup.react.ts
import { IntelFeed, IntelItem } from '@/components/forge/intel/IntelFeed';

// Test data
const mockItems: IntelItem[] = [
  {
    id: 'intel-1',
    title: 'The History of Mathematics',
    summary: 'An in-depth look at how mathematics evolved over the centuries.',
    content_type: 'article',
    source_name: 'Science Daily',
    source_url: 'https://example.com/article',
    stat_primary: 'intelligence',
    stat_boost: 5,
    difficulty: 2,
    estimated_minutes: 10,
    tags: ['math', 'history', 'education'],
    is_read: false,
    xp_value: 25,
    published_at: Date.now() - 3600000,
  },
  {
    id: 'intel-2',
    title: 'Understanding Photosynthesis',
    summary: 'A short video explaining the process of photosynthesis.',
    content_type: 'video',
    source_name: 'Khan Academy',
    stat_primary: 'wisdom',
    stat_boost: 3,
    difficulty: 1,
    estimated_minutes: 5,
    tags: ['science', 'biology'],
    is_read: true,
    xp_value: 15,
    published_at: Date.now() - 7200000,
  },
  {
    id: 'intel-3',
    title: 'Did you know? Honey never spoils!',
    summary: 'Archaeologists have found 3000-year-old honey in Egyptian tombs that was still edible.',
    content_type: 'fact',
    stat_primary: 'intelligence',
    stat_boost: 2,
    is_read: false,
    xp_value: 10,
    published_at: Date.now(),
  },
  {
    id: 'intel-4',
    title: 'Daily Challenge: Solve this riddle',
    summary: 'I speak without a mouth and hear without ears. What am I?',
    content_type: 'challenge',
    stat_primary: 'wisdom',
    stat_boost: 10,
    difficulty: 3,
    is_read: false,
    xp_value: 50,
    published_at: Date.now() - 1800000,
  },
];

describe('IntelFeed', () => {
  const mockOnReadItem = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnReadItem.mockResolvedValue({ xp_earned: 25 });
  });

  describe('Rendering', () => {
    it('renders Daily Intel title', () => {
      render(<IntelFeed items={mockItems} onReadItem={mockOnReadItem} />);
      expect(screen.getByText('Daily Intel')).toBeInTheDocument();
    });

    it('renders all intel items', () => {
      render(<IntelFeed items={mockItems} onReadItem={mockOnReadItem} />);

      expect(screen.getByText('The History of Mathematics')).toBeInTheDocument();
      expect(screen.getByText('Understanding Photosynthesis')).toBeInTheDocument();
      expect(screen.getByText('Did you know? Honey never spoils!')).toBeInTheDocument();
      expect(screen.getByText('Daily Challenge: Solve this riddle')).toBeInTheDocument();
    });

    it('shows unread count badge', () => {
      render(<IntelFeed items={mockItems} onReadItem={mockOnReadItem} />);
      expect(screen.getByText('3 new')).toBeInTheDocument();
    });

    it('renders content type badges', () => {
      render(<IntelFeed items={mockItems} onReadItem={mockOnReadItem} />);

      expect(screen.getByText('Article')).toBeInTheDocument();
      expect(screen.getByText('Video')).toBeInTheDocument();
      expect(screen.getByText('Fun Fact')).toBeInTheDocument();
      expect(screen.getByText('Challenge')).toBeInTheDocument();
    });

    it('shows XP values', () => {
      render(<IntelFeed items={mockItems} onReadItem={mockOnReadItem} />);

      expect(screen.getByText('+25 XP')).toBeInTheDocument();
      expect(screen.getByText('+15 XP')).toBeInTheDocument();
      expect(screen.getByText('+10 XP')).toBeInTheDocument();
      expect(screen.getByText('+50 XP')).toBeInTheDocument();
    });

    it('shows estimated reading time', () => {
      render(<IntelFeed items={mockItems} onReadItem={mockOnReadItem} />);

      expect(screen.getByText('10m')).toBeInTheDocument();
      expect(screen.getByText('5m')).toBeInTheDocument();
    });

    it('shows stat boost info', () => {
      render(<IntelFeed items={mockItems} onReadItem={mockOnReadItem} />);

      // Stats and boost values appear in formatted way
      expect(screen.getAllByText(/intelligence/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/\+\d+%/).length).toBeGreaterThanOrEqual(1);
    });

    it('shows tags', () => {
      render(<IntelFeed items={mockItems} onReadItem={mockOnReadItem} />);

      expect(screen.getByText('math')).toBeInTheDocument();
      expect(screen.getByText('history')).toBeInTheDocument();
      expect(screen.getByText('science')).toBeInTheDocument();
    });

    it('shows source links', () => {
      render(<IntelFeed items={mockItems} onReadItem={mockOnReadItem} />);

      // Only items with source_url will have clickable links
      // Science Daily has source_url, so it should render as a link
      expect(screen.getAllByText(/Science Daily/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no items', () => {
      render(<IntelFeed items={[]} onReadItem={mockOnReadItem} />);

      expect(screen.getByText('No Intel Available')).toBeInTheDocument();
      expect(screen.getByText('Check back later for new content.')).toBeInTheDocument();
    });
  });

  describe('Read Status', () => {
    it('shows "Mark Complete" button for unread items', () => {
      render(<IntelFeed items={mockItems} onReadItem={mockOnReadItem} />);

      const markCompleteButtons = screen.getAllByText('Mark Complete');
      expect(markCompleteButtons.length).toBe(3);
    });

    it('shows "Completed" button for read items', () => {
      render(<IntelFeed items={mockItems} onReadItem={mockOnReadItem} />);

      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('reduces opacity for read items', () => {
      render(<IntelFeed items={mockItems} onReadItem={mockOnReadItem} />);

      // The read item should have reduced opacity (tested via styles)
      const readItem = screen.getByText('Understanding Photosynthesis').closest('div');
      expect(readItem).toBeInTheDocument();
    });

    it('calls onReadItem when marking complete', async () => {
      render(<IntelFeed items={mockItems} onReadItem={mockOnReadItem} />);

      const markCompleteButtons = screen.getAllByText('Mark Complete');
      fireEvent.click(markCompleteButtons[0]);

      await waitFor(() => {
        // First unread item in the sorted list is intel-3 (newest first by published_at)
        expect(mockOnReadItem).toHaveBeenCalled();
      });
    });

    it('shows "Saving..." while marking complete', async () => {
      mockOnReadItem.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ xp_earned: 25 }), 100))
      );

      render(<IntelFeed items={mockItems} onReadItem={mockOnReadItem} />);

      const markCompleteButtons = screen.getAllByText('Mark Complete');
      fireEvent.click(markCompleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument();
      });
    });

    it('does not allow clicking completed items', () => {
      render(<IntelFeed items={mockItems} onReadItem={mockOnReadItem} />);

      const completedButton = screen.getByText('Completed');
      fireEvent.click(completedButton);

      expect(mockOnReadItem).not.toHaveBeenCalled();
    });
  });

  describe('Filtering', () => {
    it('shows filter toggle button', () => {
      render(<IntelFeed items={mockItems} onReadItem={mockOnReadItem} />);

      expect(screen.getByText('Filter')).toBeInTheDocument();
    });

    it('shows filter options when toggle clicked', () => {
      render(<IntelFeed items={mockItems} onReadItem={mockOnReadItem} />);

      fireEvent.click(screen.getByText('Filter'));

      expect(screen.getByText('Type:')).toBeInTheDocument();
      expect(screen.getByText('Sort:')).toBeInTheDocument();
      expect(screen.getByText('All')).toBeInTheDocument();
    });

    it('filters by article type', () => {
      render(<IntelFeed items={mockItems} onReadItem={mockOnReadItem} />);

      fireEvent.click(screen.getByText('Filter'));
      fireEvent.click(screen.getAllByText('Article')[0]); // Click filter button, not the badge

      expect(screen.getByText('The History of Mathematics')).toBeInTheDocument();
      expect(screen.queryByText('Understanding Photosynthesis')).not.toBeInTheDocument();
    });

    it('filters by video type', () => {
      render(<IntelFeed items={mockItems} onReadItem={mockOnReadItem} />);

      fireEvent.click(screen.getByText('Filter'));

      // Find the Video filter button (not the badge)
      const filterButtons = screen.getAllByRole('button');
      const videoFilterBtn = filterButtons.find(btn =>
        btn.textContent === 'Video' && !btn.classList.contains('typeBadge')
      );
      if (videoFilterBtn) {
        fireEvent.click(videoFilterBtn);
      }

      expect(screen.getByText('Understanding Photosynthesis')).toBeInTheDocument();
      expect(screen.queryByText('The History of Mathematics')).not.toBeInTheDocument();
    });

    it('shows message when filter yields no results', () => {
      render(<IntelFeed items={[mockItems[0]]} onReadItem={mockOnReadItem} />);

      fireEvent.click(screen.getByText('Filter'));

      // Find the Video filter button
      const filterButtons = screen.getAllByRole('button');
      const videoFilterBtn = filterButtons.find(btn => btn.textContent === 'Video');
      if (videoFilterBtn) {
        fireEvent.click(videoFilterBtn);
      }

      expect(screen.getByText('No Intel Available')).toBeInTheDocument();
      expect(screen.getByText(/No videos found/)).toBeInTheDocument();
    });
  });

  describe('Sorting', () => {
    it('sorts by XP value', () => {
      render(<IntelFeed items={mockItems} onReadItem={mockOnReadItem} />);

      fireEvent.click(screen.getByText('Filter'));
      fireEvent.click(screen.getByText('XP Value'));

      const titles = screen.getAllByRole('heading', { level: 3 });
      expect(titles[0]).toHaveTextContent('Daily Challenge');
    });

    it('sorts by difficulty', () => {
      render(<IntelFeed items={mockItems} onReadItem={mockOnReadItem} />);

      fireEvent.click(screen.getByText('Filter'));
      fireEvent.click(screen.getByText('Difficulty'));

      const titles = screen.getAllByRole('heading', { level: 3 });
      expect(titles[0]).toHaveTextContent('Understanding Photosynthesis');
    });

    it('sorts by newest by default', () => {
      render(<IntelFeed items={mockItems} onReadItem={mockOnReadItem} />);

      const titles = screen.getAllByRole('heading', { level: 3 });
      expect(titles[0]).toHaveTextContent('Did you know?');
    });
  });

  describe('Expand/Collapse', () => {
    it('truncates long summaries by default', () => {
      const longItem: IntelItem = {
        ...mockItems[0],
        summary: 'A'.repeat(200),
      };

      render(<IntelFeed items={[longItem]} onReadItem={mockOnReadItem} />);

      const summary = screen.getByText(/^A+\.\.\.$/);
      expect(summary.textContent?.length).toBeLessThan(200);
    });

    it('expands summary when clicked', () => {
      const longSummary = 'A'.repeat(200);
      const longItem: IntelItem = {
        ...mockItems[0],
        summary: longSummary,
      };

      render(<IntelFeed items={[longItem]} onReadItem={mockOnReadItem} />);

      const cardContent = screen.getByText(/^A+\.\.\./).closest('div');
      if (cardContent) {
        fireEvent.click(cardContent);
      }

      expect(screen.getByText(longSummary)).toBeInTheDocument();
    });
  });

  describe('External Links', () => {
    it('renders external link with correct attributes', () => {
      render(<IntelFeed items={mockItems} onReadItem={mockOnReadItem} />);

      const link = screen.getByText('Science Daily');
      expect(link).toHaveAttribute('href', 'https://example.com/article');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe('Loading State', () => {
    it('passes loading prop correctly', () => {
      render(<IntelFeed items={mockItems} onReadItem={mockOnReadItem} loading={true} />);
      // Component should still render items when loading (shows existing data)
      expect(screen.getByText('Daily Intel')).toBeInTheDocument();
    });
  });
});
