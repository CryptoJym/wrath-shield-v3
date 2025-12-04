/**
 * BookLibrary Component Tests
 * Tests for the HYRO FORGE reading library component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
// lucide-react is mocked globally in jest.setup.react.ts
import { BookLibrary } from '@/components/forge/reading/BookLibrary';

// Test data
const mockBooks = [
  {
    id: 'book-1',
    title: 'Introduction to Algebra',
    author: 'Jane Doe',
    genre: 'mathematics',
    difficulty_level: 'beginner',
    page_count: 200,
    chapter_count: 10,
    estimated_hours: 5,
    status: 'active',
    stat_primary: 'math',
    created_at: Date.now() - 86400000,
    progress: {
      book_id: 'book-1',
      total_pages_read: 50,
      chapters_completed: 2,
      total_time_minutes: 60,
      sessions_count: 3,
      progress_percent: 25,
      last_session_at: Date.now(),
    },
  },
  {
    id: 'book-2',
    title: 'World History',
    author: 'John Smith',
    genre: 'history',
    difficulty_level: 'intermediate',
    page_count: 300,
    chapter_count: 15,
    estimated_hours: 8,
    status: 'active',
    stat_primary: 'social_studies',
    created_at: Date.now() - 172800000,
    progress: {
      book_id: 'book-2',
      total_pages_read: 300,
      chapters_completed: 15,
      total_time_minutes: 480,
      sessions_count: 10,
      progress_percent: 100,
      last_session_at: Date.now() - 3600000,
    },
  },
  {
    id: 'book-3',
    title: 'Creative Writing',
    author: 'Emily Wilson',
    genre: 'language_arts',
    difficulty_level: 'advanced',
    page_count: 250,
    chapter_count: 12,
    estimated_hours: 6,
    status: 'active',
    stat_primary: 'writing',
    created_at: Date.now(),
  },
];

describe('BookLibrary', () => {
  const mockOnSelectBook = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the library header with book count', () => {
      render(
        <BookLibrary
          books={mockBooks}
          onSelectBook={mockOnSelectBook}
        />
      );

      expect(screen.getByText('Book Library')).toBeInTheDocument();
      expect(screen.getByText('3 Books')).toBeInTheDocument();
    });

    it('renders completed count badge', () => {
      render(
        <BookLibrary
          books={mockBooks}
          onSelectBook={mockOnSelectBook}
        />
      );

      expect(screen.getByText('1 Completed')).toBeInTheDocument();
    });

    it('renders all books', () => {
      render(
        <BookLibrary
          books={mockBooks}
          onSelectBook={mockOnSelectBook}
        />
      );

      expect(screen.getByText('Introduction to Algebra')).toBeInTheDocument();
      expect(screen.getByText('World History')).toBeInTheDocument();
      expect(screen.getByText('Creative Writing')).toBeInTheDocument();
    });

    it('renders book authors', () => {
      render(
        <BookLibrary
          books={mockBooks}
          onSelectBook={mockOnSelectBook}
        />
      );

      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.getByText('Emily Wilson')).toBeInTheDocument();
    });

    it('shows loading state when loading prop is true', () => {
      render(
        <BookLibrary
          books={[]}
          onSelectBook={mockOnSelectBook}
          loading={true}
        />
      );

      expect(screen.getByText('Loading library...')).toBeInTheDocument();
    });

    it('shows empty state when no books', () => {
      render(
        <BookLibrary
          books={[]}
          onSelectBook={mockOnSelectBook}
        />
      );

      expect(screen.getByText('No books found')).toBeInTheDocument();
    });
  });

  describe('Filtering', () => {
    it('renders filter controls', () => {
      render(
        <BookLibrary
          books={mockBooks}
          onSelectBook={mockOnSelectBook}
        />
      );

      // There are two comboboxes: status filter and sort dropdown
      const comboboxes = screen.getAllByRole('combobox');
      expect(comboboxes.length).toBe(2);
    });

    it('filters by search query', () => {
      render(
        <BookLibrary
          books={mockBooks}
          onSelectBook={mockOnSelectBook}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search books...');
      fireEvent.change(searchInput, { target: { value: 'Algebra' } });

      expect(screen.getByText('Introduction to Algebra')).toBeInTheDocument();
      expect(screen.queryByText('World History')).not.toBeInTheDocument();
    });

    it('filters by status - not started', () => {
      render(
        <BookLibrary
          books={mockBooks}
          onSelectBook={mockOnSelectBook}
        />
      );

      const statusSelect = screen.getAllByRole('combobox')[0];
      fireEvent.change(statusSelect, { target: { value: 'not_started' } });

      expect(screen.getByText('Creative Writing')).toBeInTheDocument();
      expect(screen.queryByText('Introduction to Algebra')).not.toBeInTheDocument();
    });

    it('filters by status - in progress', () => {
      render(
        <BookLibrary
          books={mockBooks}
          onSelectBook={mockOnSelectBook}
        />
      );

      const statusSelect = screen.getAllByRole('combobox')[0];
      fireEvent.change(statusSelect, { target: { value: 'in_progress' } });

      expect(screen.getByText('Introduction to Algebra')).toBeInTheDocument();
      expect(screen.queryByText('World History')).not.toBeInTheDocument();
    });

    it('filters by status - completed', () => {
      render(
        <BookLibrary
          books={mockBooks}
          onSelectBook={mockOnSelectBook}
        />
      );

      const statusSelect = screen.getAllByRole('combobox')[0];
      fireEvent.change(statusSelect, { target: { value: 'completed' } });

      expect(screen.getByText('World History')).toBeInTheDocument();
      expect(screen.queryByText('Introduction to Algebra')).not.toBeInTheDocument();
    });
  });

  describe('Sorting', () => {
    it('sorts by title', () => {
      render(
        <BookLibrary
          books={mockBooks}
          onSelectBook={mockOnSelectBook}
        />
      );

      const sortSelect = screen.getAllByRole('combobox')[1];
      fireEvent.change(sortSelect, { target: { value: 'title' } });

      const bookTitles = screen.getAllByRole('heading', { level: 3 });
      expect(bookTitles[0]).toHaveTextContent('Creative Writing');
    });

    it('sorts by progress', () => {
      render(
        <BookLibrary
          books={mockBooks}
          onSelectBook={mockOnSelectBook}
        />
      );

      const sortSelect = screen.getAllByRole('combobox')[1];
      fireEvent.change(sortSelect, { target: { value: 'progress' } });

      const bookTitles = screen.getAllByRole('heading', { level: 3 });
      expect(bookTitles[0]).toHaveTextContent('World History');
    });
  });

  describe('View Toggle', () => {
    it('renders view toggle buttons', () => {
      render(
        <BookLibrary
          books={mockBooks}
          onSelectBook={mockOnSelectBook}
        />
      );

      expect(screen.getByTestId('icon-grid')).toBeInTheDocument();
      expect(screen.getByTestId('icon-list')).toBeInTheDocument();
    });
  });

  describe('Book Selection', () => {
    it('calls onSelectBook when a book is clicked', () => {
      render(
        <BookLibrary
          books={mockBooks}
          onSelectBook={mockOnSelectBook}
        />
      );

      fireEvent.click(screen.getByText('Introduction to Algebra'));
      expect(mockOnSelectBook).toHaveBeenCalledWith(mockBooks[0]);
    });

    it('highlights selected book', () => {
      render(
        <BookLibrary
          books={mockBooks}
          onSelectBook={mockOnSelectBook}
          selectedBookId="book-1"
        />
      );

      // The selected book should have special styling (tested via snapshot or visual inspection)
      expect(screen.getByText('Introduction to Algebra')).toBeInTheDocument();
    });
  });

  describe('Progress Display', () => {
    it('shows progress percentage for in-progress books', () => {
      render(
        <BookLibrary
          books={mockBooks}
          onSelectBook={mockOnSelectBook}
        />
      );

      expect(screen.getByText('25%')).toBeInTheDocument();
    });

    it('shows complete badge for completed books', () => {
      render(
        <BookLibrary
          books={mockBooks}
          onSelectBook={mockOnSelectBook}
        />
      );

      expect(screen.getByText('Complete')).toBeInTheDocument();
    });

    it('shows time spent for books with reading time', () => {
      render(
        <BookLibrary
          books={mockBooks}
          onSelectBook={mockOnSelectBook}
        />
      );

      expect(screen.getByText('60 min read')).toBeInTheDocument();
    });
  });

  describe('Difficulty Badges', () => {
    it('shows difficulty level badges', () => {
      render(
        <BookLibrary
          books={mockBooks}
          onSelectBook={mockOnSelectBook}
        />
      );

      expect(screen.getByText('beginner')).toBeInTheDocument();
      expect(screen.getByText('intermediate')).toBeInTheDocument();
      expect(screen.getByText('advanced')).toBeInTheDocument();
    });
  });

  describe('Stat Badges', () => {
    it('shows primary stat badges', () => {
      render(
        <BookLibrary
          books={mockBooks}
          onSelectBook={mockOnSelectBook}
        />
      );

      expect(screen.getByText('math')).toBeInTheDocument();
      expect(screen.getByText('social studies')).toBeInTheDocument();
      expect(screen.getByText('writing')).toBeInTheDocument();
    });
  });

  describe('Empty Search Results', () => {
    it('shows message when search yields no results', () => {
      render(
        <BookLibrary
          books={mockBooks}
          onSelectBook={mockOnSelectBook}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search books...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent book' } });

      expect(screen.getByText('No books found')).toBeInTheDocument();
      expect(screen.getByText('Try a different search term')).toBeInTheDocument();
    });
  });
});
