/**
 * Wrath Shield v3 - AnchorArsenal Component Tests
 *
 * Comprehensive test suite for the AnchorArsenal component covering:
 * - Rendering states (loading, empty, error)
 * - Statistics calculation (total, recent, by category)
 * - Category filtering functionality
 * - Add anchor form functionality
 * - User interactions (anchor selection, form submission)
 * - Keyboard navigation (Enter, Space keys)
 * - Accessibility (ARIA labels, roles, focus management)
 * - Edge cases (null values, long text, many anchors)
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AnchorArsenal, { AnchorMemory } from '@/components/power/AnchorArsenal';

// Mock global fetch
global.fetch = jest.fn();

// Helper function to create mock anchors
function createMockAnchor(overrides: Partial<AnchorMemory> = {}): AnchorMemory {
  return {
    id: 'anchor-1',
    text: 'Test anchor text',
    category: 'truth',
    date: new Date().toISOString().split('T')[0],
    metadata: {},
    ...overrides,
  };
}

// Helper to get date N days ago
function getDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

describe('AnchorArsenal Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering and Initial State', () => {
    it('should render loading state initially', () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<AnchorArsenal />);

      expect(screen.getByText(/loading anchors/i)).toBeInTheDocument();
    });

    it('should render empty state when no anchors exist', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: [] }),
      });

      render(<AnchorArsenal />);

      await waitFor(() => {
        expect(screen.getByText(/no anchors yet/i)).toBeInTheDocument();
      });
    });

    it('should render error state when fetch fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
      });

      render(<AnchorArsenal />);

      await waitFor(() => {
        expect(screen.getByText(/error:/i)).toBeInTheDocument();
      });
    });

    it('should display retry button in error state', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
      });

      render(<AnchorArsenal />);

      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /retry/i });
        expect(retryButton).toBeInTheDocument();
      });
    });

    it('should refetch anchors when retry button is clicked', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ anchors: [createMockAnchor()] }),
        });

      render(<AnchorArsenal />);

      await waitFor(() => {
        expect(screen.getByText(/error:/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText(/test anchor text/i)).toBeInTheDocument();
      });
    });
  });

  describe('Statistics Calculation', () => {
    it('should calculate total anchor count correctly', async () => {
      const mockAnchors: AnchorMemory[] = [
        createMockAnchor({ id: 'anchor-1' }),
        createMockAnchor({ id: 'anchor-2' }),
        createMockAnchor({ id: 'anchor-3' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: mockAnchors }),
      });

      render(<AnchorArsenal />);

      await waitFor(() => {
        const statLabels = screen.getAllByText(/total anchors/i);
        expect(statLabels.length).toBeGreaterThan(0);
        // Find the stat value "3" that's a sibling of "Total Anchors"
        const totalSection = screen.getByText(/total anchors/i).closest('.stat-item');
        expect(totalSection).toHaveTextContent('3');
      });
    });

    it('should calculate recent anchor count (last 7 days)', async () => {
      const mockAnchors: AnchorMemory[] = [
        createMockAnchor({ id: 'anchor-1', date: getDaysAgo(2) }), // Recent
        createMockAnchor({ id: 'anchor-2', date: getDaysAgo(5) }), // Recent
        createMockAnchor({ id: 'anchor-3', date: getDaysAgo(10) }), // Old
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: mockAnchors }),
      });

      render(<AnchorArsenal />);

      await waitFor(() => {
        const statItems = screen.getAllByText(/recent \(7 days\)/i);
        expect(statItems.length).toBeGreaterThan(0);
        
        // Look for the stat value "2" near the "Recent" label
        const recentStatValue = screen.getAllByText('2').find(el => 
          el.classList.contains('stat-value')
        );
        expect(recentStatValue).toBeInTheDocument();
      });
    });

    it('should calculate category distribution correctly', async () => {
      const mockAnchors: AnchorMemory[] = [
        createMockAnchor({ id: 'anchor-1', category: 'truth' }),
        createMockAnchor({ id: 'anchor-2', category: 'truth' }),
        createMockAnchor({ id: 'anchor-3', category: 'boundary' }),
        createMockAnchor({ id: 'anchor-4', category: 'strength' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: mockAnchors }),
      });

      render(<AnchorArsenal />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /show truth anchors/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /show boundary anchors/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /show strength anchors/i })).toBeInTheDocument();
      });
    });

    it('should not show category buttons with zero count', async () => {
      const mockAnchors: AnchorMemory[] = [
        createMockAnchor({ id: 'anchor-1', category: 'truth' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: mockAnchors }),
      });

      render(<AnchorArsenal />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /show truth anchors/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /show boundary anchors/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /show strength anchors/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('Category Filtering', () => {
    it('should filter anchors by category', async () => {
      const mockAnchors: AnchorMemory[] = [
        createMockAnchor({ id: 'anchor-1', category: 'truth', text: 'Truth anchor' }),
        createMockAnchor({ id: 'anchor-2', category: 'boundary', text: 'Boundary anchor' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: mockAnchors }),
      });

      render(<AnchorArsenal />);

      await waitFor(() => {
        expect(screen.getByText(/truth anchor/i)).toBeInTheDocument();
        expect(screen.getByText(/boundary anchor/i)).toBeInTheDocument();
      });

      // Click truth filter
      const truthButton = screen.getByRole('button', { name: /show truth anchors/i });
      fireEvent.click(truthButton);

      await waitFor(() => {
        expect(screen.getByText(/truth anchor/i)).toBeInTheDocument();
        expect(screen.queryByText(/boundary anchor/i)).not.toBeInTheDocument();
      });
    });

    it('should clear filters when "All" button is clicked', async () => {
      const mockAnchors: AnchorMemory[] = [
        createMockAnchor({ id: 'anchor-1', category: 'truth', text: 'Truth anchor' }),
        createMockAnchor({ id: 'anchor-2', category: 'boundary', text: 'Boundary anchor' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: mockAnchors }),
      });

      render(<AnchorArsenal />);

      await waitFor(() => {
        expect(screen.getByText(/truth anchor/i)).toBeInTheDocument();
      });

      // Filter by truth
      const truthButton = screen.getByRole('button', { name: /show truth anchors/i });
      fireEvent.click(truthButton);

      await waitFor(() => {
        expect(screen.queryByText(/boundary anchor/i)).not.toBeInTheDocument();
      });

      // Clear filter
      const allButton = screen.getByRole('button', { name: /show all categories/i });
      fireEvent.click(allButton);

      await waitFor(() => {
        expect(screen.getByText(/truth anchor/i)).toBeInTheDocument();
        expect(screen.getByText(/boundary anchor/i)).toBeInTheDocument();
      });
    });

    it('should respect categoryFilter prop', async () => {
      const mockAnchors: AnchorMemory[] = [
        createMockAnchor({ id: 'anchor-1', category: 'truth', text: 'Truth anchor' }),
        createMockAnchor({ id: 'anchor-2', category: 'boundary', text: 'Boundary anchor' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: mockAnchors }),
      });

      render(<AnchorArsenal categoryFilter="truth" />);

      await waitFor(() => {
        expect(screen.getByText(/truth anchor/i)).toBeInTheDocument();
        expect(screen.queryByText(/boundary anchor/i)).not.toBeInTheDocument();
      });
    });

    it('should show empty state when filtered category has no results', async () => {
      const mockAnchors: AnchorMemory[] = [
        createMockAnchor({ id: 'anchor-1', category: 'truth', text: 'Truth anchor' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: mockAnchors }),
      });

      render(<AnchorArsenal categoryFilter="boundary" />);

      await waitFor(() => {
        expect(screen.getByText(/no boundary anchors found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Add Anchor Functionality', () => {
    it('should show add anchor form when button is clicked', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: [] }),
      });

      render(<AnchorArsenal />);

      await waitFor(() => {
        expect(screen.getByText(/no anchors yet/i)).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add new anchor/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /anchor category/i })).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: /anchor text/i })).toBeInTheDocument();
      });
    });

    it('should allow category selection in form', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: [] }),
      });

      render(<AnchorArsenal />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add new anchor/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /add new anchor/i }));

      await waitFor(() => {
        const categorySelect = screen.getByRole('combobox', { name: /anchor category/i });
        expect(categorySelect).toBeInTheDocument();

        fireEvent.change(categorySelect, { target: { value: 'boundary' } });
        expect(categorySelect).toHaveValue('boundary');
      });
    });

    it('should allow text input in form', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: [] }),
      });

      render(<AnchorArsenal />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /add new anchor/i }));
      });

      await waitFor(() => {
        const textInput = screen.getByRole('textbox', { name: /anchor text/i });
        fireEvent.change(textInput, { target: { value: 'My new anchor text' } });
        expect(textInput).toHaveValue('My new anchor text');
      });
    });

    it('should submit anchor when save button is clicked', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ anchors: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            anchors: [
              createMockAnchor({ text: 'My new anchor text', category: 'truth' }),
            ],
          }),
        });

      render(<AnchorArsenal />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /add new anchor/i }));
      });

      await waitFor(() => {
        const textInput = screen.getByRole('textbox', { name: /anchor text/i });
        fireEvent.change(textInput, { target: { value: 'My new anchor text' } });
      });

      const saveButton = screen.getByRole('button', { name: /save anchor/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/my new anchor text/i)).toBeInTheDocument();
      });
    });

    it('should cancel form when cancel button is clicked', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: [] }),
      });

      render(<AnchorArsenal />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /add new anchor/i }));
      });

      await waitFor(() => {
        const textInput = screen.getByRole('textbox', { name: /anchor text/i });
        fireEvent.change(textInput, { target: { value: 'Test text' } });
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByRole('textbox', { name: /anchor text/i })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /add new anchor/i })).toBeInTheDocument();
      });
    });

    it('should disable save button when text is empty', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: [] }),
      });

      render(<AnchorArsenal />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /add new anchor/i }));
      });

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /save anchor/i });
        expect(saveButton).toBeDisabled();
      });
    });

    it('should enable save button when text is entered', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: [] }),
      });

      render(<AnchorArsenal />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /add new anchor/i }));
      });

      await waitFor(() => {
        const textInput = screen.getByRole('textbox', { name: /anchor text/i });
        fireEvent.change(textInput, { target: { value: 'Valid text' } });

        const saveButton = screen.getByRole('button', { name: /save anchor/i });
        expect(saveButton).not.toBeDisabled();
      });
    });
  });

  describe('User Interactions', () => {
    it('should call onAnchorSelect when anchor is clicked', async () => {
      const mockAnchors: AnchorMemory[] = [
        createMockAnchor({ id: 'anchor-1', text: 'Test anchor' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: mockAnchors }),
      });

      const onAnchorSelect = jest.fn();
      render(<AnchorArsenal onAnchorSelect={onAnchorSelect} />);

      await waitFor(() => {
        expect(screen.getByText(/test anchor/i)).toBeInTheDocument();
      });

      const anchorElement = screen.getByText(/test anchor/i).closest('.anchor-item');
      fireEvent.click(anchorElement!);

      expect(onAnchorSelect).toHaveBeenCalledTimes(1);
      expect(onAnchorSelect).toHaveBeenCalledWith(mockAnchors[0]);
    });

    it('should not call onAnchorSelect when prop is undefined', async () => {
      const mockAnchors: AnchorMemory[] = [
        createMockAnchor({ id: 'anchor-1', text: 'Test anchor' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: mockAnchors }),
      });

      render(<AnchorArsenal />);

      await waitFor(() => {
        expect(screen.getByText(/test anchor/i)).toBeInTheDocument();
      });

      const anchorElement = screen.getByText(/test anchor/i).closest('.anchor-item');

      // Should not throw error
      expect(() => {
        fireEvent.click(anchorElement!);
      }).not.toThrow();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support Enter key to select anchor', async () => {
      const mockAnchors: AnchorMemory[] = [
        createMockAnchor({ id: 'anchor-1', text: 'Keyboard anchor' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: mockAnchors }),
      });

      const onAnchorSelect = jest.fn();
      render(<AnchorArsenal onAnchorSelect={onAnchorSelect} />);

      await waitFor(() => {
        expect(screen.getByText(/keyboard anchor/i)).toBeInTheDocument();
      });

      const anchorElement = screen.getByText(/keyboard anchor/i).closest('.anchor-item');
      anchorElement!.focus();
      fireEvent.keyDown(anchorElement!, { key: 'Enter' });

      expect(onAnchorSelect).toHaveBeenCalledTimes(1);
    });

    it('should support Space key to select anchor', async () => {
      const mockAnchors: AnchorMemory[] = [
        createMockAnchor({ id: 'anchor-1', text: 'Keyboard anchor' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: mockAnchors }),
      });

      const onAnchorSelect = jest.fn();
      render(<AnchorArsenal onAnchorSelect={onAnchorSelect} />);

      await waitFor(() => {
        expect(screen.getByText(/keyboard anchor/i)).toBeInTheDocument();
      });

      const anchorElement = screen.getByText(/keyboard anchor/i).closest('.anchor-item');
      anchorElement!.focus();
      fireEvent.keyDown(anchorElement!, { key: ' ' });

      expect(onAnchorSelect).toHaveBeenCalledTimes(1);
    });

    it('should prevent default behavior for Space key', async () => {
      const mockAnchors: AnchorMemory[] = [
        createMockAnchor({ id: 'anchor-1', text: 'Keyboard anchor' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: mockAnchors }),
      });

      const onAnchorSelect = jest.fn();
      render(<AnchorArsenal onAnchorSelect={onAnchorSelect} />);

      await waitFor(() => {
        expect(screen.getByText(/keyboard anchor/i)).toBeInTheDocument();
      });

      const anchorElement = screen.getByText(/keyboard anchor/i).closest('.anchor-item');
      const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault');

      anchorElement!.focus();
      anchorElement!.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should have tabIndex=0 on anchor items for keyboard navigation', async () => {
      const mockAnchors: AnchorMemory[] = [
        createMockAnchor({ id: 'anchor-1', text: 'Tab anchor' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: mockAnchors }),
      });

      render(<AnchorArsenal />);

      await waitFor(() => {
        const anchorElement = screen.getByText(/tab anchor/i).closest('.anchor-item');
        expect(anchorElement).toHaveAttribute('tabIndex', '0');
      });
    });

    it('should support keyboard navigation on category filter buttons', async () => {
      const mockAnchors: AnchorMemory[] = [
        createMockAnchor({ id: 'anchor-1', category: 'truth' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: mockAnchors }),
      });

      render(<AnchorArsenal />);

      await waitFor(() => {
        const truthButton = screen.getByRole('button', { name: /show truth anchors/i });
        truthButton.focus();
        fireEvent.click(truthButton);

        expect(truthButton).toHaveClass('active');
      });
    });
  });

  describe('Accessibility (ARIA)', () => {
    it('should have aria-label on anchor items', async () => {
      const mockAnchors: AnchorMemory[] = [
        createMockAnchor({ id: 'anchor-1', text: 'Accessible anchor' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: mockAnchors }),
      });

      render(<AnchorArsenal />);

      await waitFor(() => {
        const anchorElement = screen.getByText(/accessible anchor/i).closest('.anchor-item');
        expect(anchorElement).toHaveAttribute('aria-label', 'Anchor: Accessible anchor');
      });
    });

    it('should have role="button" on anchor items', async () => {
      const mockAnchors: AnchorMemory[] = [
        createMockAnchor({ id: 'anchor-1', text: 'Button anchor' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: mockAnchors }),
      });

      render(<AnchorArsenal />);

      await waitFor(() => {
        const anchorElement = screen.getByText(/button anchor/i).closest('.anchor-item');
        expect(anchorElement).toHaveAttribute('role', 'button');
      });
    });

    it('should have aria-pressed on category filter buttons', async () => {
      const mockAnchors: AnchorMemory[] = [
        createMockAnchor({ id: 'anchor-1', category: 'truth' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: mockAnchors }),
      });

      render(<AnchorArsenal />);

      await waitFor(() => {
        const allButton = screen.getByRole('button', { name: /show all categories/i });
        expect(allButton).toHaveAttribute('aria-pressed', 'true');

        const truthButton = screen.getByRole('button', { name: /show truth anchors/i });
        expect(truthButton).toHaveAttribute('aria-pressed', 'false');
      });
    });

    it('should have aria-label on add anchor button', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: [] }),
      });

      render(<AnchorArsenal />);

      await waitFor(() => {
        const addButton = screen.getByRole('button', { name: /add new anchor/i });
        expect(addButton).toHaveAttribute('aria-label', 'Add new anchor');
      });
    });

    it('should have aria-label on form inputs', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: [] }),
      });

      render(<AnchorArsenal />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /add new anchor/i }));
      });

      await waitFor(() => {
        const categorySelect = screen.getByRole('combobox', { name: /anchor category/i });
        expect(categorySelect).toHaveAttribute('aria-label', 'Anchor category');

        const textInput = screen.getByRole('textbox', { name: /anchor text/i });
        expect(textInput).toHaveAttribute('aria-label', 'Anchor text');
      });
    });

    it('should have aria-label on save and cancel buttons', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: [] }),
      });

      render(<AnchorArsenal />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /add new anchor/i }));
      });

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /save anchor/i });
        expect(saveButton).toHaveAttribute('aria-label', 'Save anchor');

        const cancelButton = screen.getByRole('button', { name: /cancel/i });
        expect(cancelButton).toHaveAttribute('aria-label', 'Cancel');
      });
    });

    it('should have aria-label on category filter buttons', async () => {
      const mockAnchors: AnchorMemory[] = [
        createMockAnchor({ id: 'anchor-1', category: 'truth' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: mockAnchors }),
      });

      render(<AnchorArsenal />);

      await waitFor(() => {
        const allButton = screen.getByRole('button', { name: /show all categories/i });
        expect(allButton).toHaveAttribute('aria-label', 'Show all categories');

        const truthButton = screen.getByRole('button', { name: /show truth anchors/i });
        expect(truthButton).toHaveAttribute('aria-label', 'Show truth anchors');
      });
    });
  });

  describe('Sorting and Display Order', () => {
    it('should sort anchors by date descending (newest first)', async () => {
      const mockAnchors: AnchorMemory[] = [
        createMockAnchor({ id: 'anchor-1', text: 'Old anchor', date: '2024-01-01' }),
        createMockAnchor({ id: 'anchor-2', text: 'New anchor', date: '2024-06-01' }),
        createMockAnchor({ id: 'anchor-3', text: 'Medium anchor', date: '2024-03-01' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: mockAnchors }),
      });

      render(<AnchorArsenal />);

      await waitFor(() => {
        // Get anchor texts in order
        const anchorTexts = Array.from(document.querySelectorAll('.anchor-text')).map(
          el => el.textContent
        );

        expect(anchorTexts[0]).toBe('New anchor');
        expect(anchorTexts[1]).toBe('Medium anchor');
        expect(anchorTexts[2]).toBe('Old anchor');
      });
    });
  });

  describe('Category Icons and Colors', () => {
    it('should display correct icon for truth category', async () => {
      const mockAnchors: AnchorMemory[] = [
        createMockAnchor({ id: 'anchor-1', category: 'truth', text: 'Truth anchor' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: mockAnchors }),
      });

      render(<AnchorArsenal />);

      await waitFor(() => {
        // Query for the button specifically to avoid matching anchor items
        const truthButton = screen.getByRole('button', { name: /show truth anchors/i });
        expect(truthButton).toHaveTextContent('✓');
      });
    });

    it('should display correct icon for boundary category', async () => {
      const mockAnchors: AnchorMemory[] = [
        createMockAnchor({ id: 'anchor-1', category: 'boundary', text: 'Boundary anchor' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: mockAnchors }),
      });

      render(<AnchorArsenal />);

      await waitFor(() => {
        // Query for the button specifically to avoid matching anchor items
        const boundaryButton = screen.getByRole('button', { name: /show boundary anchors/i });
        expect(boundaryButton).toHaveTextContent('⚔');
      });
    });

    it('should apply correct color class for strength category', async () => {
      const mockAnchors: AnchorMemory[] = [
        createMockAnchor({ id: 'anchor-1', category: 'strength', text: 'Strength anchor' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: mockAnchors }),
      });

      render(<AnchorArsenal />);

      await waitFor(() => {
        // Query for the button specifically to avoid matching anchor items
        const strengthButton = screen.getByRole('button', { name: /show strength anchors/i });
        expect(strengthButton).toHaveTextContent('⬢');
        expect(strengthButton).toHaveClass('text-purple-500');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle anchors with very long text', async () => {
      const longText = 'A'.repeat(1000);
      const mockAnchors: AnchorMemory[] = [
        createMockAnchor({ id: 'anchor-1', text: longText }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: mockAnchors }),
      });

      render(<AnchorArsenal />);

      await waitFor(() => {
        expect(screen.getByText(new RegExp(longText.substring(0, 50)))).toBeInTheDocument();
      });
    });

    it('should handle many anchors (100+)', async () => {
      const mockAnchors: AnchorMemory[] = Array.from({ length: 100 }, (_, i) =>
        createMockAnchor({ id: `anchor-${i}`, text: `Anchor ${i}` })
      );

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: mockAnchors }),
      });

      render(<AnchorArsenal />);

      await waitFor(() => {
        // Query for all instances of "100" text and check that at least one exists
        // This avoids the "Found multiple elements" error
        const statValues = screen.getAllByText('100');
        expect(statValues.length).toBeGreaterThan(0);
        expect(statValues[0]).toBeInTheDocument();
      });
    });

    it('should handle custom className prop', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: [] }),
      });

      const { container } = render(<AnchorArsenal className="custom-class" />);

      await waitFor(() => {
        const arsenalElement = container.querySelector('.anchor-arsenal');
        expect(arsenalElement).toHaveClass('custom-class');
      });
    });

    it('should handle anchors with missing category (defaults to "other")', async () => {
      const mockAnchors: AnchorMemory[] = [
        { ...createMockAnchor({ id: 'anchor-1' }), category: '' as any },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: mockAnchors }),
      });

      render(<AnchorArsenal />);

      await waitFor(() => {
        // Should still display without error
        expect(screen.getByText(/test anchor text/i)).toBeInTheDocument();
      });
    });

    it('should handle form submission error gracefully', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ anchors: [] }),
        })
        .mockResolvedValueOnce({
          ok: false,
        });

      render(<AnchorArsenal />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /add new anchor/i }));
      });

      await waitFor(() => {
        const textInput = screen.getByRole('textbox', { name: /anchor text/i });
        fireEvent.change(textInput, { target: { value: 'Test anchor' } });
      });

      const saveButton = screen.getByRole('button', { name: /save anchor/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/error:/i)).toBeInTheDocument();
      });
    });

    it('should trim whitespace from anchor text before submission', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ anchors: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            anchors: [createMockAnchor({ text: 'Trimmed text' })],
          }),
        });

      render(<AnchorArsenal />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /add new anchor/i }));
      });

      await waitFor(() => {
        const textInput = screen.getByRole('textbox', { name: /anchor text/i });
        fireEvent.change(textInput, { target: { value: '  Trimmed text  ' } });
      });

      const saveButton = screen.getByRole('button', { name: /save anchor/i });
      fireEvent.click(saveButton);

      // Verify fetch was called with trimmed text
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/anchors',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"text":"Trimmed text"'),
          })
        );
      });
    });
  });
});
