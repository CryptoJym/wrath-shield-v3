/**
 * Jest setup for React component tests
 */

import '@testing-library/jest-dom';

// Mock lucide-react icons globally for all tests
// Using require('react') inside the factory since jest.mock is hoisted
jest.mock('lucide-react', () => {
  const React = require('react');
  const createMockIcon = (name: string) => {
    return function MockIcon(props: any) {
      return React.createElement('span', { 'data-testid': `icon-${name}`, ...props });
    };
  };

  return {
    __esModule: true,
    // Common icons used across Forge components
    TrendingUp: createMockIcon('trending-up'),
    TrendingDown: createMockIcon('trending-down'),
    Clock: createMockIcon('clock'),
    Target: createMockIcon('target'),
    Calendar: createMockIcon('calendar'),
    Brain: createMockIcon('brain'),
    Zap: createMockIcon('zap'),
    Award: createMockIcon('award'),
    BarChart3: createMockIcon('bar-chart'),
    Activity: createMockIcon('activity'),
    ChevronRight: createMockIcon('chevron-right'),
    ChevronDown: createMockIcon('chevron-down'),
    ChevronUp: createMockIcon('chevron-up'),
    ChevronLeft: createMockIcon('chevron-left'),
    BookOpen: createMockIcon('book-open'),
    Search: createMockIcon('search'),
    Filter: createMockIcon('filter'),
    Grid: createMockIcon('grid'),
    List: createMockIcon('list'),
    CheckCircle: createMockIcon('check-circle'),
    Star: createMockIcon('star'),
    Minus: createMockIcon('minus'),
    Trophy: createMockIcon('trophy'),
    Lock: createMockIcon('lock'),
    Unlock: createMockIcon('unlock'),
    RotateCcw: createMockIcon('rotate'),
    XCircle: createMockIcon('x-circle'),
    Send: createMockIcon('send'),
    Bot: createMockIcon('bot'),
    User: createMockIcon('user'),
    Lightbulb: createMockIcon('lightbulb'),
    MessageCircle: createMockIcon('message'),
    Loader2: createMockIcon('loader'),
    Sparkles: createMockIcon('sparkles'),
    Newspaper: createMockIcon('newspaper'),
    Video: createMockIcon('video'),
    ExternalLink: createMockIcon('external'),
    Copy: createMockIcon('copy'),
    Check: createMockIcon('check'),
    Image: createMockIcon('image'),
    Paperclip: createMockIcon('paperclip'),
    Command: createMockIcon('command'),
    Loader: createMockIcon('loader'),
    X: createMockIcon('x'),
    // ReadingSession icons
    Play: createMockIcon('play'),
    Pause: createMockIcon('pause'),
    Square: createMockIcon('square'),
    AlertCircle: createMockIcon('alert-circle'),
    // Systems page icons
    Database: createMockIcon('database'),
    GitBranch: createMockIcon('git-branch'),
    MessageSquare: createMockIcon('message-square'),
    RefreshCw: createMockIcon('refresh-cw'),
    CheckCircle2: createMockIcon('check-circle-2'),
    AlertTriangle: createMockIcon('alert-triangle'),
    Timer: createMockIcon('timer'),
    Cpu: createMockIcon('cpu'),
    Network: createMockIcon('network'),
    ArrowRight: createMockIcon('arrow-right'),
    Radio: createMockIcon('radio'),
  };
});

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    };
  },
  useSearchParams() {
    return {
      get: jest.fn(),
    };
  },
  usePathname() {
    return '';
  },
}));

// Suppress console errors in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};

// Mock scrollIntoView for jsdom (not implemented in jsdom)
Element.prototype.scrollIntoView = jest.fn();

// Mock ResizeObserver (not implemented in jsdom)
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver (not implemented in jsdom)
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));
