import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

jest.mock('framer-motion', () => ({
  __esModule: true,
  motion: new Proxy({}, {
    get: (_target, prop: string) => (props: any) => React.createElement(prop, props),
  }),
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));
jest.mock('lucide-react', () => ({
  __esModule: true,
  Image: () => <span />, FileUp: () => <span />, Figma: () => <span />, Monitor: () => <span />,
  CircleUserRound: () => <span />, ArrowUp: () => <span />, Paperclip: () => <span />,
  Plus: () => <span />, Send: () => <span />, X: () => <span />, Loader: () => <span />,
  Sparkles: () => <span />, Command: () => <span />, Copy: () => <span />, Check: () => <span />,
}));
jest.mock('react-markdown', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));
jest.mock('remark-gfm', () => ({}));

import { AnimatedAIChat } from '@/components/ui/animated-ai-chat';

describe('AnimatedAIChat toast on error', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Force proxy (non-streaming)
    // @ts-ignore
    process.env.NEXT_PUBLIC_AGENTIC_GROK_URL = '';
    // Mock fetch to reject
    // @ts-ignore
    global.fetch = jest.fn(() => Promise.reject(new Error('boom')));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows a minimal error toast and hides it', async () => {
    render(<AnimatedAIChat />);
    const textarea = screen.getByPlaceholderText(/Ask Grok a question/i);
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    const sendBtn = screen.getByRole('button', { name: /send/i });
    fireEvent.click(sendBtn);

    // Toast should appear
    expect(await screen.findByText(/Network error:/i)).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(2600);
    });

    // It should auto-disappear
    expect(screen.queryByText(/Network error:/i)).toBeNull();
  });
});

