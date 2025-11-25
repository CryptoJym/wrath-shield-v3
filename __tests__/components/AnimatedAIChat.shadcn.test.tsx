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
  Sparkles: () => <span />, Command: () => <span />,
}));
jest.mock('react-markdown', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));
jest.mock('remark-gfm', () => ({}));

import { AnimatedAIChat } from '@/components/ui/animated-ai-chat';

describe('AnimatedAIChat (shadcn/ui version)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Force non-streaming path and mock fetch
    // @ts-ignore
    process.env.NEXT_PUBLIC_AGENTIC_GROK_URL = '';
    // @ts-ignore
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: async () => ({ message: 'ok' }) } as any));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders and sends a message (timeout clears input)', () => {
    render(<AnimatedAIChat />);
    expect(screen.getByText(/How can I help today\?/i)).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/Ask Grok a question/i);
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    const sendBtn = screen.getByRole('button', { name: /send/i });
    fireEvent.click(sendBtn);

    act(() => {
      jest.advanceTimersByTime(3500);
      jest.runOnlyPendingTimers();
    });

    const textareaAfter = screen.getByPlaceholderText(/Ask Grok a question/i) as HTMLTextAreaElement;
    expect(textareaAfter.value).toBe('');
  });
});
