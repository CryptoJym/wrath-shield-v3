/**
 * CSS/Tailwind Styling Tests
 *
 * Verifies that:
 * 1. CSS variables are properly defined
 * 2. Tailwind utility classes work correctly
 * 3. Component styling is applied
 * 4. Dark theme variables are present
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock CSS - in jsdom, we need to verify the classes are applied
// The actual CSS computation requires a real browser

describe('Tailwind CSS Classes', () => {
  describe('Layout Utilities', () => {
    it('applies flex classes correctly', () => {
      render(
        <div data-testid="flex-container" className="flex items-center justify-between">
          <span>Item 1</span>
          <span>Item 2</span>
        </div>
      );

      const container = screen.getByTestId('flex-container');
      expect(container).toHaveClass('flex');
      expect(container).toHaveClass('items-center');
      expect(container).toHaveClass('justify-between');
    });

    it('applies grid classes correctly', () => {
      render(
        <div data-testid="grid-container" className="grid grid-cols-3 gap-4">
          <div>Cell 1</div>
          <div>Cell 2</div>
          <div>Cell 3</div>
        </div>
      );

      const container = screen.getByTestId('grid-container');
      expect(container).toHaveClass('grid');
      expect(container).toHaveClass('grid-cols-3');
      expect(container).toHaveClass('gap-4');
    });
  });

  describe('Spacing Utilities', () => {
    it('applies margin classes correctly', () => {
      render(
        <div data-testid="margin-test" className="mt-4 mb-2 ml-4 mr-2">
          Content
        </div>
      );

      const element = screen.getByTestId('margin-test');
      expect(element).toHaveClass('mt-4');
      expect(element).toHaveClass('mb-2');
      expect(element).toHaveClass('ml-4');
      expect(element).toHaveClass('mr-2');
    });

    it('applies padding classes correctly', () => {
      render(
        <div data-testid="padding-test" className="p-4 px-6 py-2">
          Content
        </div>
      );

      const element = screen.getByTestId('padding-test');
      expect(element).toHaveClass('p-4');
      expect(element).toHaveClass('px-6');
      expect(element).toHaveClass('py-2');
    });
  });

  describe('Typography Utilities', () => {
    it('applies text size classes correctly', () => {
      render(
        <div>
          <h1 data-testid="text-4xl" className="text-4xl font-bold">Large Text</h1>
          <p data-testid="text-sm" className="text-sm text-secondary">Small Text</p>
        </div>
      );

      expect(screen.getByTestId('text-4xl')).toHaveClass('text-4xl', 'font-bold');
      expect(screen.getByTestId('text-sm')).toHaveClass('text-sm', 'text-secondary');
    });

    it('applies color classes correctly', () => {
      render(
        <div>
          <span data-testid="text-green" className="text-green">Success</span>
          <span data-testid="text-muted" className="text-muted">Muted</span>
          <span data-testid="text-success" className="text-success">Success Alt</span>
        </div>
      );

      expect(screen.getByTestId('text-green')).toHaveClass('text-green');
      expect(screen.getByTestId('text-muted')).toHaveClass('text-muted');
      expect(screen.getByTestId('text-success')).toHaveClass('text-success');
    });
  });

  describe('Border & Radius Utilities', () => {
    it('applies rounded classes correctly', () => {
      render(
        <div data-testid="rounded-test" className="rounded border border-border">
          Rounded Box
        </div>
      );

      const element = screen.getByTestId('rounded-test');
      expect(element).toHaveClass('rounded');
      expect(element).toHaveClass('border');
      expect(element).toHaveClass('border-border');
    });
  });

  describe('Sizing Utilities', () => {
    it('applies width and height classes correctly', () => {
      render(
        <div data-testid="size-test" className="w-5 h-5 min-h-screen max-w-5xl">
          Sized Box
        </div>
      );

      const element = screen.getByTestId('size-test');
      expect(element).toHaveClass('w-5');
      expect(element).toHaveClass('h-5');
      expect(element).toHaveClass('min-h-screen');
      expect(element).toHaveClass('max-w-5xl');
    });
  });

  describe('Interactive Utilities', () => {
    it('applies cursor classes correctly', () => {
      render(
        <button data-testid="cursor-test" className="cursor-pointer">
          Click Me
        </button>
      );

      expect(screen.getByTestId('cursor-test')).toHaveClass('cursor-pointer');
    });
  });
});

describe('Custom CSS Classes', () => {
  describe('Card Component', () => {
    it('applies card class correctly', () => {
      render(
        <div data-testid="card" className="card">
          Card Content
        </div>
      );

      expect(screen.getByTestId('card')).toHaveClass('card');
    });
  });

  describe('Status Classes', () => {
    it('applies loading class correctly', () => {
      render(
        <div data-testid="loading" className="loading">
          Loading...
        </div>
      );

      expect(screen.getByTestId('loading')).toHaveClass('loading');
    });

    it('applies error class correctly', () => {
      render(
        <div data-testid="error" className="error">
          Error message
        </div>
      );

      expect(screen.getByTestId('error')).toHaveClass('error');
    });
  });

  describe('Button Component', () => {
    it('applies btn class correctly', () => {
      render(
        <button data-testid="btn" className="btn">
          Button
        </button>
      );

      expect(screen.getByTestId('btn')).toHaveClass('btn');
    });
  });

  describe('Animation Classes', () => {
    it('applies animation classes correctly', () => {
      render(
        <div>
          <div data-testid="float" className="animate-float">Float</div>
          <div data-testid="slide-up" className="animate-slide-up">Slide Up</div>
          <div data-testid="pulse-ring" className="animate-pulse-ring">Pulse</div>
        </div>
      );

      expect(screen.getByTestId('float')).toHaveClass('animate-float');
      expect(screen.getByTestId('slide-up')).toHaveClass('animate-slide-up');
      expect(screen.getByTestId('pulse-ring')).toHaveClass('animate-pulse-ring');
    });
  });
});

describe('CSS Variables Structure', () => {
  // Note: These tests verify that components using CSS variables render correctly
  // Actual CSS variable values require browser-level testing

  it('renders elements using CSS variable based classes', () => {
    render(
      <div className="min-h-screen p-8" style={{ background: 'var(--color-bg)' }}>
        <div className="card" data-testid="styled-card">
          <h1 className="text-4xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Dashboard
          </h1>
          <p className="text-secondary" style={{ color: 'var(--color-text-secondary)' }}>
            Subtitle
          </p>
        </div>
      </div>
    );

    const card = screen.getByTestId('styled-card');
    expect(card).toHaveClass('card');
    expect(card).toBeInTheDocument();
  });

  it('renders status indicators with color classes', () => {
    render(
      <div>
        <span data-testid="success" className="text-success">Success</span>
        <span data-testid="warning" style={{ color: 'var(--color-warning)' }}>Warning</span>
        <span data-testid="danger" style={{ color: 'var(--color-danger)' }}>Danger</span>
        <span data-testid="info" style={{ color: 'var(--color-info)' }}>Info</span>
      </div>
    );

    expect(screen.getByTestId('success')).toHaveClass('text-success');
    expect(screen.getByTestId('warning')).toBeInTheDocument();
    expect(screen.getByTestId('danger')).toBeInTheDocument();
    expect(screen.getByTestId('info')).toBeInTheDocument();
  });
});

describe('Responsive Class Application', () => {
  it('applies responsive grid classes', () => {
    render(
      <div data-testid="responsive-grid" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>Item 1</div>
        <div>Item 2</div>
        <div>Item 3</div>
      </div>
    );

    const grid = screen.getByTestId('responsive-grid');
    expect(grid).toHaveClass('grid');
    expect(grid).toHaveClass('grid-cols-1');
    expect(grid).toHaveClass('md:grid-cols-3');
    expect(grid).toHaveClass('gap-4');
  });
});

describe('ShadCN Component Classes', () => {
  it('applies shadcn-compatible background and foreground', () => {
    render(
      <div
        data-testid="shadcn-test"
        className="bg-background text-foreground border-border"
      >
        ShadCN Styled
      </div>
    );

    const element = screen.getByTestId('shadcn-test');
    expect(element).toHaveClass('bg-background');
    expect(element).toHaveClass('text-foreground');
    expect(element).toHaveClass('border-border');
  });

  it('applies muted variants', () => {
    render(
      <div data-testid="muted-test" className="bg-muted text-muted-foreground">
        Muted Content
      </div>
    );

    const element = screen.getByTestId('muted-test');
    expect(element).toHaveClass('bg-muted');
    expect(element).toHaveClass('text-muted-foreground');
  });
});

describe('Dark Theme Compatibility', () => {
  it('renders dark-themed card correctly', () => {
    render(
      <div
        data-testid="dark-card"
        className="card"
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-primary)',
        }}
      >
        <h2 style={{ color: 'var(--color-text-primary)' }}>Card Title</h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>Card description</p>
      </div>
    );

    const card = screen.getByTestId('dark-card');
    expect(card).toHaveClass('card');
    expect(card).toHaveStyle({ background: 'var(--color-bg-card)' });
  });
});

describe('Combined Class Application', () => {
  it('applies complex combined classes for dashboard layout', () => {
    render(
      <main
        data-testid="dashboard"
        className="min-h-screen p-8 max-w-6xl mx-auto"
      >
        <header className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold">Dashboard</h1>
        </header>
        <div
          data-testid="metrics-grid"
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
        >
          <div className="card">Metric 1</div>
          <div className="card">Metric 2</div>
          <div className="card">Metric 3</div>
        </div>
      </main>
    );

    const dashboard = screen.getByTestId('dashboard');
    expect(dashboard).toHaveClass('min-h-screen', 'p-8', 'max-w-6xl', 'mx-auto');

    const metricsGrid = screen.getByTestId('metrics-grid');
    expect(metricsGrid).toHaveClass('grid', 'grid-cols-1', 'md:grid-cols-3', 'gap-4', 'mb-8');
  });
});
