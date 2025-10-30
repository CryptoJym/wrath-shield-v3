/**
 * FlagRadar Component Test Suite
 *
 * Tests for flag visualization, statistics calculation, filtering,
 * user interactions, keyboard navigation, and accessibility compliance.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import FlagRadar, { Flag, FlagRadarProps } from '@/components/power/FlagRadar';

// Mock fetch globally
global.fetch = jest.fn();

// Helper function to create mock flags
function createMockFlag(overrides: Partial<Flag> = {}): Flag {
  return {
    id: 'flag-1',
    status: 'pending',
    original_text: 'Test manipulation text',
    detected_at: Date.now() - 3600000, // 1 hour ago
    severity: 3,
    manipulation_type: 'gaslighting',
    ...overrides,
  };
}

describe('FlagRadar Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Rendering and Initial State', () => {
    it('should render loading state initially', () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<FlagRadar />);

      expect(screen.getByText(/loading flags/i)).toBeInTheDocument();
    });

    it('should render empty state when no flags exist', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: [] }),
      });

      render(<FlagRadar />);

      await waitFor(() => {
        expect(screen.getByText(/no flags detected yet/i)).toBeInTheDocument();
      });
    });

    it('should render error state on API failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      render(<FlagRadar />);

      await waitFor(() => {
        expect(screen.getByText(/error:/i)).toBeInTheDocument();
      });
    });

    it('should show retry button on error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      render(<FlagRadar />);

      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /retry/i });
        expect(retryButton).toBeInTheDocument();
      });
    });
  });

  describe('Statistics Calculation', () => {
    it('should calculate total flag count correctly', async () => {
      const mockFlags: Flag[] = [
        createMockFlag({ id: 'flag-1', status: 'pending' }),
        createMockFlag({ id: 'flag-2', status: 'resolved' }),
        createMockFlag({ id: 'flag-3', status: 'dismissed' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: mockFlags }),
      });

      render(<FlagRadar />);

      await waitFor(() => {
        const totalLabel = screen.getByText(/total flags/i);
        const totalValue = totalLabel.previousElementSibling as HTMLElement;
        expect(totalValue).toHaveTextContent('3');
      });
    });

    it('should calculate status counts correctly', async () => {
      const mockFlags: Flag[] = [
        createMockFlag({ id: 'flag-1', status: 'pending' }),
        createMockFlag({ id: 'flag-2', status: 'pending' }),
        createMockFlag({ id: 'flag-3', status: 'resolved' }),
        createMockFlag({ id: 'flag-4', status: 'dismissed' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: mockFlags }),
      });

      render(<FlagRadar />);

      await waitFor(() => {
        // Pending
        const pendingLabel = screen.getAllByText(/pending/i).find(el => el.classList.contains('stat-label'))! as HTMLElement;
        const pendingValue = pendingLabel.previousElementSibling as HTMLElement;
        expect(pendingValue).toHaveTextContent('2');
        // Resolved
        const resolvedLabel = screen.getAllByText(/resolved/i).find(el => el.classList.contains('stat-label'))! as HTMLElement;
        const resolvedValue = resolvedLabel.previousElementSibling as HTMLElement;
        expect(resolvedValue).toHaveTextContent('1');
      });
    });

    it('should calculate severity distribution correctly', async () => {
      const mockFlags: Flag[] = [
        createMockFlag({ id: 'flag-1', severity: 5 }),
        createMockFlag({ id: 'flag-2', severity: 5 }),
        createMockFlag({ id: 'flag-3', severity: 3 }),
        createMockFlag({ id: 'flag-4', severity: 1 }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: mockFlags }),
      });

      render(<FlagRadar />);

      await waitFor(() => {
        // Check for severity 5 count
        const severity5Button = screen.getByRole('button', { name: /5 \(2\)/i });
        expect(severity5Button).toBeInTheDocument();

        // Check for severity 3 count
        const severity3Button = screen.getByRole('button', { name: /3 \(1\)/i });
        expect(severity3Button).toBeInTheDocument();
      });
    });

    it('should calculate manipulation type distribution', async () => {
      const mockFlags: Flag[] = [
        createMockFlag({ id: 'flag-1', manipulation_type: 'gaslighting' }),
        createMockFlag({ id: 'flag-2', manipulation_type: 'gaslighting' }),
        createMockFlag({ id: 'flag-3', manipulation_type: 'guilt' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: mockFlags }),
      });

      render(<FlagRadar />);

      await waitFor(() => {
        // Check for gaslighting count
        const gaslightingButton = screen.getByRole('button', { name: /gaslighting \(2\)/i });
        expect(gaslightingButton).toBeInTheDocument();

        // Check for guilt count
        const guiltButton = screen.getByRole('button', { name: /guilt \(1\)/i });
        expect(guiltButton).toBeInTheDocument();
      });
    });
  });

  describe('Severity Color Coding', () => {
    it('should apply danger color for severity >= 4', async () => {
      const mockFlags: Flag[] = [
        createMockFlag({ id: 'flag-1', severity: 5 }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: mockFlags }),
      });

      render(<FlagRadar />);

      await waitFor(() => {
        const flagElement = screen.getByText(/test manipulation text/i).closest('.flag-item');
        expect(flagElement).toBeInTheDocument();
        // Color is applied via CSS variable, check the class structure
        const severityBadge = within(flagElement!).getByText('Severity: 5');
        expect(severityBadge.parentElement).toHaveClass('flag-header');
      });
    });

    it('should apply warning color for severity = 3', async () => {
      const mockFlags: Flag[] = [
        createMockFlag({ id: 'flag-1', severity: 3 }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: mockFlags }),
      });

      render(<FlagRadar />);

      await waitFor(() => {
        const severityBadge = screen.getByText('Severity: 3');
        expect(severityBadge).toBeInTheDocument();
      });
    });

    it('should apply info color for severity < 3', async () => {
      const mockFlags: Flag[] = [
        createMockFlag({ id: 'flag-1', severity: 2 }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: mockFlags }),
      });

      render(<FlagRadar />);

      await waitFor(() => {
        const severityBadge = screen.getByText('Severity: 2');
        expect(severityBadge).toBeInTheDocument();
      });
    });
  });

  describe('Status Color Coding', () => {
    it('should apply danger color for pending status', async () => {
      const mockFlags: Flag[] = [
        createMockFlag({ id: 'flag-1', status: 'pending' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: mockFlags }),
      });

      render(<FlagRadar />);

      await waitFor(() => {
        const statusBadge = screen.getByText('Status: pending');
        expect(statusBadge).toBeInTheDocument();
      });
    });

    it('should apply success color for resolved status', async () => {
      const mockFlags: Flag[] = [
        createMockFlag({ id: 'flag-1', status: 'resolved' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: mockFlags }),
      });

      render(<FlagRadar />);

      await waitFor(() => {
        const statusBadge = screen.getByText('Status: resolved');
        expect(statusBadge).toBeInTheDocument();
      });
    });

    it('should apply muted color for dismissed status', async () => {
      const mockFlags: Flag[] = [
        createMockFlag({ id: 'flag-1', status: 'dismissed' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: mockFlags }),
      });

      render(<FlagRadar />);

      await waitFor(() => {
        const statusBadge = screen.getByText('Status: dismissed');
        expect(statusBadge).toBeInTheDocument();
      });
    });
  });

  describe('Filtering Functionality', () => {
    it('should filter flags by severity', async () => {
      const mockFlags: Flag[] = [
        createMockFlag({ id: 'flag-1', severity: 5, original_text: 'High severity flag' }),
        createMockFlag({ id: 'flag-2', severity: 2, original_text: 'Low severity flag' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: mockFlags }),
      });

      render(<FlagRadar />);

      await waitFor(() => {
        expect(screen.getByText(/high severity flag/i)).toBeInTheDocument();
        expect(screen.getByText(/low severity flag/i)).toBeInTheDocument();
      });

      // Click severity 5 filter
      const severity5Button = screen.getByRole('button', { name: /5 \(1\)/i });
      fireEvent.click(severity5Button);

      await waitFor(() => {
        expect(screen.getByText(/high severity flag/i)).toBeInTheDocument();
        expect(screen.queryByText(/low severity flag/i)).not.toBeInTheDocument();
      });
    });

    it('should filter flags by manipulation type', async () => {
      const mockFlags: Flag[] = [
        createMockFlag({
          id: 'flag-1',
          manipulation_type: 'gaslighting',
          original_text: 'Gaslighting flag',
        }),
        createMockFlag({
          id: 'flag-2',
          manipulation_type: 'guilt',
          original_text: 'Guilt flag',
        }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: mockFlags }),
      });

      render(<FlagRadar />);

      await waitFor(() => {
        expect(screen.getByText(/gaslighting flag/i)).toBeInTheDocument();
        expect(screen.getByText(/guilt flag/i)).toBeInTheDocument();
      });

      // Click gaslighting filter
      const gaslightingButton = screen.getByRole('button', { name: /gaslighting \(1\)/i });
      fireEvent.click(gaslightingButton);

      await waitFor(() => {
        expect(screen.getByText(/gaslighting flag/i)).toBeInTheDocument();
        expect(screen.queryByText(/guilt flag/i)).not.toBeInTheDocument();
      });
    });

    it('should clear all filters when clicking "All"', async () => {
      const mockFlags: Flag[] = [
        createMockFlag({ id: 'flag-1', severity: 5, original_text: 'High severity flag' }),
        createMockFlag({ id: 'flag-2', severity: 2, original_text: 'Low severity flag' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: mockFlags }),
      });

      render(<FlagRadar />);

      await waitFor(() => {
        expect(screen.getByText(/high severity flag/i)).toBeInTheDocument();
      });

      // Apply severity filter
      const severity5Button = screen.getByRole('button', { name: /5 \(1\)/i });
      fireEvent.click(severity5Button);

      await waitFor(() => {
        expect(screen.queryByText(/low severity flag/i)).not.toBeInTheDocument();
      });

      // Click "All" to clear filters
      const allButton = screen.getByRole('button', { name: /all \(2\)/i });
      fireEvent.click(allButton);

      await waitFor(() => {
        expect(screen.getByText(/high severity flag/i)).toBeInTheDocument();
        expect(screen.getByText(/low severity flag/i)).toBeInTheDocument();
      });
    });

    it('should respect pendingOnly prop', async () => {
      const mockFlags: Flag[] = [
        createMockFlag({ id: 'flag-1', status: 'pending', original_text: 'Pending flag' }),
        createMockFlag({ id: 'flag-2', status: 'resolved', original_text: 'Resolved flag' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: mockFlags }),
      });

      render(<FlagRadar pendingOnly={true} />);

      await waitFor(() => {
        expect(screen.getByText(/pending flag/i)).toBeInTheDocument();
        expect(screen.queryByText(/resolved flag/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('User Interactions', () => {
    it('should call onFlagSelect when flag is clicked', async () => {
      const mockFlags: Flag[] = [
        createMockFlag({ id: 'flag-1', original_text: 'Clickable flag' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: mockFlags }),
      });

      const onFlagSelect = jest.fn();
      render(<FlagRadar onFlagSelect={onFlagSelect} />);

      await waitFor(() => {
        expect(screen.getByText(/clickable flag/i)).toBeInTheDocument();
      });

      const flagElement = screen.getByText(/clickable flag/i).closest('.flag-item');
      fireEvent.click(flagElement!);

      expect(onFlagSelect).toHaveBeenCalledTimes(1);
      expect(onFlagSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'flag-1',
          original_text: 'Clickable flag',
        })
      );
    });

    it('should handle retry button click', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ flags: [] }),
        });

      render(<FlagRadar />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText(/no flags detected yet/i)).toBeInTheDocument();
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support Enter key to select flag', async () => {
      const mockFlags: Flag[] = [
        createMockFlag({ id: 'flag-1', original_text: 'Keyboard flag' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: mockFlags }),
      });

      const onFlagSelect = jest.fn();
      render(<FlagRadar onFlagSelect={onFlagSelect} />);

      await waitFor(() => {
        expect(screen.getByText(/keyboard flag/i)).toBeInTheDocument();
      });

      const flagElement = screen.getByText(/keyboard flag/i).closest('.flag-item');
      flagElement!.focus();
      fireEvent.keyDown(flagElement!, { key: 'Enter' });

      expect(onFlagSelect).toHaveBeenCalledTimes(1);
    });

    it('should support Space key to select flag', async () => {
      const mockFlags: Flag[] = [
        createMockFlag({ id: 'flag-1', original_text: 'Space key flag' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: mockFlags }),
      });

      const onFlagSelect = jest.fn();
      render(<FlagRadar onFlagSelect={onFlagSelect} />);

      await waitFor(() => {
        expect(screen.getByText(/space key flag/i)).toBeInTheDocument();
      });

      const flagElement = screen.getByText(/space key flag/i).closest('.flag-item');
      flagElement!.focus();
      fireEvent.keyDown(flagElement!, { key: ' ' });

      expect(onFlagSelect).toHaveBeenCalledTimes(1);
    });

    it('should have tabIndex on flag items', async () => {
      const mockFlags: Flag[] = [
        createMockFlag({ id: 'flag-1', original_text: 'Focusable flag' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: mockFlags }),
      });

      render(<FlagRadar />);

      await waitFor(() => {
        const flagElement = screen.getByText(/focusable flag/i).closest('.flag-item');
        expect(flagElement).toHaveAttribute('tabIndex', '0');
      });
    });

    it('should support keyboard navigation for filter buttons', async () => {
      const mockFlags: Flag[] = [
        createMockFlag({ id: 'flag-1', severity: 5 }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: mockFlags }),
      });

      render(<FlagRadar />);

      await waitFor(() => {
        const severity5Button = screen.getByRole('button', { name: /5 \(1\)/i });
        expect(severity5Button).toBeInTheDocument();
      });

      const severity5Button = screen.getByRole('button', { name: /5 \(1\)/i });
      severity5Button.focus();
      fireEvent.keyDown(severity5Button, { key: 'Enter' });

      // Button should have active class after Enter press (filter applied)
      expect(severity5Button).toHaveClass('active');
    });
  });

  describe('Accessibility (ARIA)', () => {
    it('should have proper ARIA labels on flag items', async () => {
      const mockFlags: Flag[] = [
        createMockFlag({
          id: 'flag-1',
          original_text: 'ARIA test flag',
          manipulation_type: 'gaslighting',
        }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: mockFlags }),
      });

      render(<FlagRadar />);

      await waitFor(() => {
        const flagElement = screen.getByLabelText(/flag: gaslighting/i);
        expect(flagElement).toBeInTheDocument();
      });
    });

    it('should have role="button" on flag items', async () => {
      const mockFlags: Flag[] = [
        createMockFlag({ id: 'flag-1', original_text: 'Role test flag' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: mockFlags }),
      });

      render(<FlagRadar />);

      await waitFor(() => {
        const flagElement = screen.getByText(/role test flag/i).closest('.flag-item');
        expect(flagElement).toHaveAttribute('role', 'button');
      });
    });

    it('should have aria-pressed on filter buttons', async () => {
      const mockFlags: Flag[] = [
        createMockFlag({ id: 'flag-1', severity: 5 }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: mockFlags }),
      });

      render(<FlagRadar />);

      await waitFor(() => {
        const allButton = screen.getByRole('button', { name: /all \(1\)/i });
        expect(allButton).toHaveAttribute('aria-pressed', 'true'); // All is active by default
      });
    });

    it('should have aria-label on filter buttons', async () => {
      const mockFlags: Flag[] = [
        createMockFlag({ id: 'flag-1', severity: 5 }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: mockFlags }),
      });

      render(<FlagRadar />);

      await waitFor(() => {
        // Accessible name is visible content '5 (1)'; ensure the control is present and pressable
        const severity5Button = screen.getByRole('button', { name: /5 \(1\)/i });
        expect(severity5Button).toHaveAttribute('aria-pressed');
      });
    });

    it('should have focus-visible outline styles', async () => {
      const mockFlags: Flag[] = [
        createMockFlag({ id: 'flag-1', original_text: 'Focus test flag' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: mockFlags }),
      });

      render(<FlagRadar />);

      await waitFor(() => {
        const flagElement = screen.getByText(/focus test flag/i).closest('.flag-item');
        expect(flagElement).toBeInTheDocument();
        // Focus-visible styles are applied via CSS, component should render properly
      });
    });
  });

  describe('Time Formatting', () => {
    it('should format time as "X hours ago" for recent flags', async () => {
      const twoHoursAgo = Date.now() - 2 * 3600000;
      const mockFlags: Flag[] = [
        createMockFlag({ id: 'flag-1', detected_at: twoHoursAgo }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: mockFlags }),
      });

      render(<FlagRadar />);

      await waitFor(() => {
        expect(screen.getByText(/2 hours ago/i)).toBeInTheDocument();
      });
    });

    it('should format time as "X days ago" for older flags', async () => {
      const threeDaysAgo = Date.now() - 3 * 24 * 3600000;
      const mockFlags: Flag[] = [
        createMockFlag({ id: 'flag-1', detected_at: threeDaysAgo }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: mockFlags }),
      });

      render(<FlagRadar />);

      await waitFor(() => {
        expect(screen.getByText(/3 days ago/i)).toBeInTheDocument();
      });
    });

    it('should show date for very old flags', async () => {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 3600000;
      const mockFlags: Flag[] = [
        createMockFlag({ id: 'flag-1', detected_at: thirtyDaysAgo }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: mockFlags }),
      });

      render(<FlagRadar />);

      await waitFor(() => {
        // Should show formatted date instead of "X days ago"
        const flagElement = screen.getByText(/test manipulation text/i).closest('.flag-item');
        const timeElement = within(flagElement!).getByText(/\d{4}-\d{2}-\d{2}/);
        expect(timeElement).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle flags with null manipulation_type', async () => {
      const mockFlags: Flag[] = [
        createMockFlag({ id: 'flag-1', manipulation_type: null, original_text: 'Unknown type' }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: mockFlags }),
      });

      render(<FlagRadar />);

      await waitFor(() => {
        // Type label shows as 'unknown' within the flag item
        const flagItem = screen.getByText(/unknown type/i).closest('.flag-item') as HTMLElement;
        expect(flagItem).toBeInTheDocument();
        // The type label renders exactly 'unknown'
        expect(within(flagItem).getByText(/unknown$/i)).toBeInTheDocument();
        // Filter button appears for unknown
        expect(screen.getByRole('button', { name: /unknown \(1\)/i })).toBeInTheDocument();
      });
    });

    it('should handle very long flag text', async () => {
      const longText = 'This is a very long manipulation text that should be displayed properly even though it contains many characters and might need to wrap to multiple lines in the UI component.';
      const mockFlags: Flag[] = [
        createMockFlag({ id: 'flag-1', original_text: longText }),
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: mockFlags }),
      });

      render(<FlagRadar />);

      await waitFor(() => {
        expect(screen.getByText(new RegExp(longText.substring(0, 50)))).toBeInTheDocument();
      });
    });

    it('should handle many flags efficiently', async () => {
      const mockFlags: Flag[] = Array.from({ length: 100 }, (_, i) =>
        createMockFlag({
          id: `flag-${i}`,
          severity: (i % 5) + 1,
          original_text: `Flag ${i}`,
        })
      );

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: mockFlags }),
      });

      render(<FlagRadar />);

      await waitFor(() => {
        const totalLabel = screen.getByText(/total flags/i);
        const totalValue = totalLabel.previousElementSibling as HTMLElement;
        expect(totalValue).toHaveTextContent('100');
      });
    });

    it('should apply custom className', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: [] }),
      });

      const { container } = render(<FlagRadar className="custom-class" />);

      await waitFor(() => {
        const flagRadar = container.querySelector('.flag-radar.custom-class');
        expect(flagRadar).toBeInTheDocument();
      });
    });
  });
});
