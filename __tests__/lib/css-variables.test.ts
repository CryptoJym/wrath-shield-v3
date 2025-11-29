/**
 * CSS Variables Structure Tests
 *
 * Validates that globals.css contains all required CSS variables
 * and follows the expected structure for the dark theme.
 */

import * as fs from 'fs';
import * as path from 'path';

describe('CSS Variables Definition', () => {
  let globalsCss: string;

  beforeAll(() => {
    const cssPath = path.join(process.cwd(), 'app', 'globals.css');
    globalsCss = fs.readFileSync(cssPath, 'utf-8');
  });

  describe('Tailwind Directives', () => {
    it('should include @tailwind base directive', () => {
      expect(globalsCss).toContain('@tailwind base');
    });

    it('should include @tailwind components directive', () => {
      expect(globalsCss).toContain('@tailwind components');
    });

    it('should include @tailwind utilities directive', () => {
      expect(globalsCss).toContain('@tailwind utilities');
    });
  });

  describe(':root CSS Variables', () => {
    it('should contain :root block', () => {
      expect(globalsCss).toMatch(/:root\s*\{/);
    });

    describe('Color Palette Variables', () => {
      it('should define --color-bg-primary', () => {
        expect(globalsCss).toMatch(/--color-bg-primary:\s*#[0-9a-fA-F]+/);
      });

      it('should define --color-bg-secondary', () => {
        expect(globalsCss).toMatch(/--color-bg-secondary:\s*#[0-9a-fA-F]+/);
      });

      it('should define --color-bg-card', () => {
        expect(globalsCss).toMatch(/--color-bg-card:\s*#[0-9a-fA-F]+/);
      });

      it('should define --color-border', () => {
        expect(globalsCss).toMatch(/--color-border:\s*#[0-9a-fA-F]+/);
      });

      it('should define --color-text-primary', () => {
        expect(globalsCss).toMatch(/--color-text-primary:\s*#[0-9a-fA-F]+/);
      });

      it('should define --color-text-secondary', () => {
        expect(globalsCss).toMatch(/--color-text-secondary:\s*#[0-9a-fA-F]+/);
      });

      it('should define --color-text-muted', () => {
        expect(globalsCss).toMatch(/--color-text-muted:\s*#[0-9a-fA-F]+/);
      });
    });

    describe('Status Color Variables', () => {
      it('should define --color-success (green)', () => {
        expect(globalsCss).toMatch(/--color-success:\s*#[0-9a-fA-F]+/);
      });

      it('should define --color-warning (amber)', () => {
        expect(globalsCss).toMatch(/--color-warning:\s*#[0-9a-fA-F]+/);
      });

      it('should define --color-danger (red)', () => {
        expect(globalsCss).toMatch(/--color-danger:\s*#[0-9a-fA-F]+/);
      });

      it('should define --color-info (blue)', () => {
        expect(globalsCss).toMatch(/--color-info:\s*#[0-9a-fA-F]+/);
      });
    });

    describe('Spacing Variables', () => {
      it('should define --spacing-xs', () => {
        expect(globalsCss).toMatch(/--spacing-xs:\s*[\d.]+rem/);
      });

      it('should define --spacing-sm', () => {
        expect(globalsCss).toMatch(/--spacing-sm:\s*[\d.]+rem/);
      });

      it('should define --spacing-md', () => {
        expect(globalsCss).toMatch(/--spacing-md:\s*[\d.]+rem/);
      });

      it('should define --spacing-lg', () => {
        expect(globalsCss).toMatch(/--spacing-lg:\s*[\d.]+rem/);
      });

      it('should define --spacing-xl', () => {
        expect(globalsCss).toMatch(/--spacing-xl:\s*[\d.]+rem/);
      });
    });

    describe('Border Radius Variables', () => {
      it('should define --radius-sm', () => {
        expect(globalsCss).toMatch(/--radius-sm:\s*[\d.]+rem/);
      });

      it('should define --radius-md', () => {
        expect(globalsCss).toMatch(/--radius-md:\s*[\d.]+rem/);
      });

      it('should define --radius-lg', () => {
        expect(globalsCss).toMatch(/--radius-lg:\s*[\d.]+rem/);
      });
    });

    describe('ShadCN Variables', () => {
      it('should define --background', () => {
        expect(globalsCss).toMatch(/--background:/);
      });

      it('should define --foreground', () => {
        expect(globalsCss).toMatch(/--foreground:/);
      });

      it('should define --muted', () => {
        expect(globalsCss).toMatch(/--muted:/);
      });

      it('should define --muted-foreground', () => {
        expect(globalsCss).toMatch(/--muted-foreground:/);
      });

      it('should define --border', () => {
        expect(globalsCss).toMatch(/--border:/);
      });

      it('should define --input', () => {
        expect(globalsCss).toMatch(/--input:/);
      });

      it('should define --ring', () => {
        expect(globalsCss).toMatch(/--ring:/);
      });
    });
  });

  describe('Base Styles', () => {
    it('should define body styles', () => {
      expect(globalsCss).toMatch(/body\s*\{/);
    });

    it('should define font-family on body', () => {
      expect(globalsCss).toMatch(/font-family:/);
    });

    it('should set background-color on body', () => {
      expect(globalsCss).toMatch(/background(-color)?:/);
    });
  });

  describe('Custom Component Classes', () => {
    it('should define .card class', () => {
      expect(globalsCss).toMatch(/\.card\s*\{/);
    });

    it('should define .loading class', () => {
      expect(globalsCss).toMatch(/\.loading\s*\{/);
    });

    it('should define .error class', () => {
      expect(globalsCss).toMatch(/\.error\s*\{/);
    });

    it('should define .btn class', () => {
      expect(globalsCss).toMatch(/\.btn\s*\{/);
    });
  });

  describe('Custom Animations', () => {
    it('should define @keyframes float', () => {
      expect(globalsCss).toMatch(/@keyframes\s+float/);
    });

    it('should define .animate-float class', () => {
      expect(globalsCss).toMatch(/\.animate-float\s*\{/);
    });

    it('should define @keyframes slide-up', () => {
      expect(globalsCss).toMatch(/@keyframes\s+slide-up/);
    });

    it('should define .animate-slide-up class', () => {
      expect(globalsCss).toMatch(/\.animate-slide-up\s*\{/);
    });

    it('should define @keyframes pulse-ring', () => {
      expect(globalsCss).toMatch(/@keyframes\s+pulse-ring/);
    });

    it('should define .animate-pulse-ring class', () => {
      expect(globalsCss).toMatch(/\.animate-pulse-ring\s*\{/);
    });
  });

  describe('Utility Classes', () => {
    it('should define .text-secondary class', () => {
      expect(globalsCss).toMatch(/\.text-secondary\s*\{/);
    });

    it('should define .text-green class', () => {
      expect(globalsCss).toMatch(/\.text-green\s*\{/);
    });

    it('should define .text-muted class', () => {
      expect(globalsCss).toMatch(/\.text-muted\s*\{/);
    });

    it('should define .text-success class', () => {
      expect(globalsCss).toMatch(/\.text-success\s*\{/);
    });
  });

  describe('Layout Utilities', () => {
    it('should define .flex class', () => {
      expect(globalsCss).toMatch(/\.flex\s*\{/);
    });

    it('should define .grid class', () => {
      expect(globalsCss).toMatch(/\.grid\s*\{/);
    });

    it('should define .items-center class', () => {
      expect(globalsCss).toMatch(/\.items-center\s*\{/);
    });

    it('should define .justify-between class', () => {
      expect(globalsCss).toMatch(/\.justify-between\s*\{/);
    });
  });

  describe('Dark Theme Consistency', () => {
    it('should use dark background colors (low lightness hex values)', () => {
      // Extract background colors and verify they are dark
      const bgPrimary = globalsCss.match(/--color-bg-primary:\s*(#[0-9a-fA-F]+)/);
      const bgSecondary = globalsCss.match(/--color-bg-secondary:\s*(#[0-9a-fA-F]+)/);

      expect(bgPrimary).not.toBeNull();
      expect(bgSecondary).not.toBeNull();

      // Dark colors typically start with #0, #1, or #2 for RGB components
      if (bgPrimary) {
        expect(bgPrimary[1]).toMatch(/^#[0-2]/);
      }
      if (bgSecondary) {
        expect(bgSecondary[1]).toMatch(/^#[0-2]/);
      }
    });

    it('should use light text colors (high lightness hex values)', () => {
      const textPrimary = globalsCss.match(/--color-text-primary:\s*(#[0-9a-fA-F]+)/);

      expect(textPrimary).not.toBeNull();

      // Light colors for text, typically white or near-white
      if (textPrimary) {
        // #ffffff, #f... or #e... are light colors
        expect(textPrimary[1]).toMatch(/^#[ef]/i);
      }
    });
  });

  describe('@layer Directives', () => {
    it('should use @layer base for base styles', () => {
      expect(globalsCss).toMatch(/@layer\s+base/);
    });
  });
});

describe('Tailwind Config Integration', () => {
  let tailwindConfig: string;

  beforeAll(() => {
    const configPath = path.join(process.cwd(), 'tailwind.config.ts');
    tailwindConfig = fs.readFileSync(configPath, 'utf-8');
  });

  it('should export a valid config', () => {
    expect(tailwindConfig).toMatch(/export\s+default/);
  });

  it('should include content paths for app directory', () => {
    expect(tailwindConfig).toMatch(/app\/\*\*\/\*\.\{/);
  });

  it('should include content paths for components', () => {
    expect(tailwindConfig).toMatch(/components\/\*\*\/\*\.\{/);
  });

  it('should define theme extensions', () => {
    expect(tailwindConfig).toMatch(/theme:\s*\{/);
  });
});
