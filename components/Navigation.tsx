'use client';

/**
 * Navigation Component - Wrath Shield v3
 *
 * Categorical mega-menu with active page highlighting and mobile responsiveness.
 * Uses CLICK-BASED dropdowns for reliable interaction.
 * Groups 12+ navigation items into logical categories for better UX.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

// Navigation categories with their items
const NAV_CATEGORIES = {
  command: {
    label: 'Command',
    icon: '🎯',
    items: [
      { href: '/chat', label: 'Orchestrator', description: 'AI command center' },
      { href: '/agents/roster', label: 'Team Roster', description: 'Agent management' },
      { href: '/agents/graph', label: 'Agent Graph', description: 'Network topology' },
    ],
  },
  operations: {
    label: 'Operations',
    icon: '⚡',
    items: [
      { href: '/inbox', label: 'Inbox', description: 'Communications hub' },
      { href: '/pm', label: 'PM', description: 'Project management' },
      { href: '/tasks', label: 'Tasks', description: 'Task tracking' },
    ],
  },
  intel: {
    label: 'Intel',
    icon: '🔍',
    items: [
      { href: '/finance', label: 'Finance', description: 'Financial insights' },
      { href: '/hyro', label: 'Education', description: 'Learning & skills' },
      { href: '/feed', label: 'Feed', description: 'Information stream' },
    ],
  },
  systems: {
    label: 'Systems',
    icon: '🛡️',
    items: [
      { href: '/eeg', label: 'EEG', description: 'Neural monitoring' },
      { href: '/legal', label: 'Legal Advisor', description: 'Legal guidance' },
      { href: '/privacy', label: 'Privacy', description: 'Privacy controls' },
    ],
  },
};

// Flatten items for quick lookup
const ALL_NAV_ITEMS = Object.values(NAV_CATEGORIES).flatMap(cat => cat.items);

export function Navigation() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Close dropdowns on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setOpenDropdown(null);
  }, [pathname]);

  // Click outside handler - close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };

    // Escape key handler
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Toggle dropdown on click
  const toggleDropdown = useCallback((key: string) => {
    setOpenDropdown(prev => prev === key ? null : key);
  }, []);

  // Check if a path is active (exact match or starts with for nested routes)
  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  // Get the currently active category based on pathname
  const getCurrentCategory = () => {
    for (const [key, category] of Object.entries(NAV_CATEGORIES)) {
      if (category.items.some(item => isActive(item.href))) {
        return key;
      }
    }
    return null;
  };

  const currentCategory = getCurrentCategory();

  return (
    <header className="sticky top-0 z-50 bg-[var(--color-bg)] border-b border-[var(--color-border)]">
      <nav ref={navRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold text-[var(--color-text)] hover:text-nano-green transition-colors"
          >
            <span className="text-xl">⚔️</span>
            <span className="hidden sm:inline">Wrath Shield v3</span>
            <span className="sm:hidden">WS3</span>
          </Link>

          {/* Desktop Navigation - CLICK-BASED DROPDOWNS */}
          <div className="hidden lg:flex items-center gap-1">
            {Object.entries(NAV_CATEGORIES).map(([key, category]) => (
              <div key={key} className="relative">
                {/* Category Button - CLICK TO TOGGLE */}
                <button
                  type="button"
                  onClick={() => toggleDropdown(key)}
                  aria-expanded={openDropdown === key}
                  aria-haspopup="true"
                  className={`
                    flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium
                    transition-all duration-200 cursor-pointer select-none
                    ${currentCategory === key
                      ? 'text-nano-green bg-nano-green/10'
                      : openDropdown === key
                        ? 'text-[var(--color-text)] bg-[var(--color-bg-secondary)]'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)]'
                    }
                  `}
                >
                  <span>{category.icon}</span>
                  <span>{category.label}</span>
                  <svg
                    className={`w-3 h-3 transition-transform duration-200 ${openDropdown === key ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown Menu - Shown when open */}
                {openDropdown === key && (
                  <div
                    className="absolute top-full left-0 mt-1 z-[100] animate-dropdown"
                    role="menu"
                    aria-orientation="vertical"
                  >
                    <div className="w-56 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl shadow-black/60 overflow-hidden">
                      {category.items.map((item, index) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          role="menuitem"
                          tabIndex={0}
                          onClick={() => setOpenDropdown(null)}
                          className={`
                            block px-4 py-3 transition-colors
                            ${isActive(item.href)
                              ? 'bg-nano-green/10 border-l-2 border-nano-green'
                              : 'hover:bg-[var(--color-bg-card)] border-l-2 border-transparent'
                            }
                            ${index === 0 ? 'rounded-t-lg' : ''}
                            ${index === category.items.length - 1 ? 'rounded-b-lg' : ''}
                          `}
                        >
                          <div className={`font-medium ${isActive(item.href) ? 'text-nano-green' : 'text-[var(--color-text)]'}`}>
                            {item.label}
                          </div>
                          <div className="text-xs text-[var(--color-text-muted)]">
                            {item.description}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Quick Access Pills (desktop) */}
          <div className="hidden lg:flex items-center gap-2">
            {/* Keyboard shortcut hint */}
            <kbd className="hidden xl:inline-flex items-center gap-1 px-2 py-1 text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded">
              <span>⌘</span><span>K</span>
            </kbd>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)]"
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && isMounted && (
          <div className="lg:hidden py-4 border-t border-[var(--color-border)] animate-slide-down overflow-hidden">
            {Object.entries(NAV_CATEGORIES).map(([key, category]) => (
              <div key={key} className="mb-4">
                <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                  <span>{category.icon}</span>
                  <span>{category.label}</span>
                </div>
                <div className="space-y-1">
                  {category.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`
                        block px-4 py-2 rounded-md text-sm
                        ${isActive(item.href)
                          ? 'bg-nano-green/10 text-nano-green font-medium'
                          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text)]'
                        }
                      `}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </nav>
    </header>
  );
}

export default Navigation;
