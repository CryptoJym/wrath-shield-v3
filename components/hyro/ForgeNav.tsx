'use client';

/**
 * HYRO FORGE: Kid-Friendly Navigation Bar
 *
 * A colorful, icon-rich navigation for HYRO Forge that's easy for any age to use.
 * Shows current location with visual feedback and fun icons.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BookOpen, Scroll, GraduationCap, Sparkles, Trophy, Settings } from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  emoji: string;
  color: string;
  description: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/hyro/forge',
    label: 'Command Center',
    shortLabel: 'Home',
    icon: <Home className="w-5 h-5" />,
    emoji: '🏠',
    color: 'from-blue-500 to-cyan-500',
    description: 'Your hero dashboard',
  },
  {
    href: '/hyro/forge/quests',
    label: 'Quest Log',
    shortLabel: 'Quests',
    icon: <Scroll className="w-5 h-5" />,
    emoji: '📜',
    color: 'from-purple-500 to-pink-500',
    description: 'Your missions',
  },
  {
    href: '/hyro/forge/tutor',
    label: 'Sage AI',
    shortLabel: 'Sage',
    icon: <Sparkles className="w-5 h-5" />,
    emoji: '🧙',
    color: 'from-amber-500 to-orange-500',
    description: 'AI companion',
  },
  {
    href: '/hyro/forge/session',
    label: 'Study Session',
    shortLabel: 'Study',
    icon: <BookOpen className="w-5 h-5" />,
    emoji: '📚',
    color: 'from-emerald-500 to-teal-500',
    description: 'Learn & level up',
  },
];

export function ForgeNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/hyro/forge') {
      return pathname === '/hyro/forge' || pathname === '/hyro/forge/';
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="bg-zinc-900/50 backdrop-blur-xl border-b border-white/5 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4">
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <Link
            href="/hyro/forge"
            className="flex items-center gap-3 group"
          >
            <span className="text-3xl group-hover:scale-110 transition-transform">⚔️</span>
            <div>
              <span className="text-lg font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                HYRO FORGE
              </span>
              <span className="hidden lg:inline text-xs text-zinc-500 ml-2">Level Up Machine</span>
            </div>
          </Link>

          {/* Nav Items */}
          <div className="flex items-center gap-2">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    relative flex items-center gap-2 px-4 py-2 rounded-xl font-medium
                    transition-all duration-300 group
                    ${active
                      ? `bg-gradient-to-r ${item.color} text-white shadow-lg shadow-purple-500/20`
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }
                  `}
                >
                  <span className="text-xl group-hover:scale-110 transition-transform">
                    {item.emoji}
                  </span>
                  <span className="hidden lg:inline">{item.label}</span>
                  <span className="lg:hidden">{item.shortLabel}</span>

                  {/* Active indicator */}
                  {active && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <Link
              href="/hyro/forge/achievements"
              className="p-2 rounded-lg text-zinc-400 hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors"
              title="Achievements"
            >
              <Trophy className="w-5 h-5" />
            </Link>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden py-2">
          {/* Mobile Header */}
          <div className="flex items-center justify-between mb-3 px-2">
            <Link href="/hyro/forge" className="flex items-center gap-2">
              <span className="text-2xl">⚔️</span>
              <span className="font-bold text-white">HYRO FORGE</span>
            </Link>
          </div>

          {/* Mobile Nav Grid */}
          <div className="grid grid-cols-4 gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-center
                    transition-all
                    ${active
                      ? `bg-gradient-to-r ${item.color} text-white`
                      : 'text-zinc-500 hover:text-white hover:bg-white/5'
                    }
                  `}
                >
                  <span className="text-xl">{item.emoji}</span>
                  <span className="text-[10px] font-medium">{item.shortLabel}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default ForgeNav;
