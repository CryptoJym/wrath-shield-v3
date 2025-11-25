import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock ESM-only deps to avoid Jest transform issues
jest.mock('react-markdown', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));
jest.mock('remark-gfm', () => ({}));
jest.mock('framer-motion', () => ({
  __esModule: true,
  motion: new Proxy({}, {
    get: (_target, prop: string) => (props: any) => React.createElement(prop, props),
  }),
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));
jest.mock('lucide-react', () => ({
  __esModule: true,
  Copy: () => <span />, Check: () => <span />, Image: () => <span />,
  Paperclip: () => <span />, Command: () => <span />, Loader: () => <span />,
  Send: () => <span />, X: () => <span />,
}));

import { AnimatedAIChat } from '@/components/ui/animated-ai-chat';

describe('AnimatedAIChat dedupe', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_AGENTIC_GROK_URL = '';
    // Mock fetch to resolve after a short delay so we can click twice quickly
    // and ensure the in-flight guard prevents duplicates.
    // @ts-ignore
    global.fetch = jest.fn(() => new Promise(resolve => {
      setTimeout(() => {
        resolve({ ok: true, json: async () => ({ message: 'ok' }) } as any);
      }, 50);
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('prevents duplicate user message on rapid Enter + click', async () => {
    render(<AnimatedAIChat />);

    const textarea = screen.getByPlaceholderText('Ask Grok a question...');
    fireEvent.change(textarea, { target: { value: 'Hello' } });

    // Press Enter to send
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

    // Immediately click Send (simulate double-submit)
    const sendBtn = screen.getByRole('button', { name: /send/i });
    fireEvent.click(sendBtn);

    // Wait for the assistant to respond once
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    // There should be exactly one user bubble labeled "You"
    const youLabels = screen.getAllByText('You');
    expect(youLabels.length).toBe(1);
  });
});
