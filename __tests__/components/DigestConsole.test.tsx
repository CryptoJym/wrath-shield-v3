import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DigestConsole from '@/components/DigestConsole';

describe('DigestConsole', () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    global.fetch = jest.fn();
  });
  afterEach(() => {
    global.fetch = originalFetch as any;
  });

  function mockSequence(responses: Array<any>) {
    (global.fetch as jest.Mock).mockImplementation(() => {
      const next = responses.shift() ?? { ok: true, json: async () => ({}) };
      return Promise.resolve(next);
    });
  }

  it('renders phrases and updates toggle', async () => {
    // Initial phrases + sensitivity
    mockSequence([
      { ok: true, json: async () => ({ success: true, sensitivity: 0.5, phrases: [
        { canonical: 'hedge_maybe', phrase: 'maybe', category: 'hedges', assured_alt: 'I will', options: ['I will'], lift_score: 0.1, enabled: true, context_tags: [] },
      ] }) },
      // initial status
      { ok: true, json: async () => ({ success: true, status: { status: 'idle' } }) },
      // toggle save
      { ok: true, json: async () => ({ success: true }) },
    ]);

    render(<DigestConsole />);

    await waitFor(() => expect(screen.getByText('Phrases (1)')).toBeInTheDocument());
    const checkbox = screen.getByLabelText('Toggle maybe') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    fireEvent.click(checkbox);

    await waitFor(() => expect((global.fetch as jest.Mock).mock.calls[2][0]).toContain('/api/digest/phrases'));
  });

  it('shows empty state and progress details', async () => {
    mockSequence([
      // empty phrases
      { ok: true, json: async () => ({ success: true, sensitivity: 0.5, phrases: [] }) },
      // status idle
      { ok: true, json: async () => ({ success: true, status: { status: 'idle' } }) },
    ]);

    render(<DigestConsole />);

    await waitFor(() => expect(screen.getByText('Phrases (0)')).toBeInTheDocument());
    // Allow loading to settle, then check empty-state text
    await waitFor(() => expect(screen.queryByText('Loading phrases…')).not.toBeInTheDocument());
    expect(screen.getByText((t) => t.includes('No phrases available yet'))).toBeInTheDocument();
    // Should display Idle progress details
    await waitFor(() => expect(screen.getByText('Idle')).toBeInTheDocument());
  });
});
