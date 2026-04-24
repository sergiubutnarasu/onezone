'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FolderOpen, Bot, Zap, Sun, Moon, Menu, X, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/lib/theme';

const NAV_ITEMS = [
  { href: '/', label: 'Projects', icon: FolderOpen, exact: true },
  { href: '/agents', label: 'Agents', icon: Bot, exact: true },
  { href: '/terminals', label: 'Terminals', icon: Monitor, exact: true },
];

export function AppNav() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = (onNav?: () => void) =>
    NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
      const active = exact ? pathname === href : pathname.startsWith(href);
      return (
        <Link
          key={href}
          href={href}
          onClick={onNav}
          className={cn(
            'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
            active
              ? 'bg-accent text-accent-foreground font-medium'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <Icon className="size-4 shrink-0" />
          {label}
        </Link>
      );
    });

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-border bg-sidebar h-screen sticky top-0">
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border">
          <div className="flex items-center justify-center size-7 rounded-md bg-primary/15 ring-1 ring-primary/30">
            <Zap className="size-4 text-primary" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-foreground">Onezone</span>
        </div>
        <nav className="flex flex-col gap-1 p-2 flex-1">{navLinks()}</nav>
        <div className="px-4 py-3 border-t border-border flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Terminal task runner</p>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex md:hidden items-center gap-3 px-4 h-12 border-b border-border bg-sidebar fixed top-0 left-0 right-0 z-40">
        <button
          onClick={() => setMobileOpen(true)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center size-6 rounded-md bg-primary/15 ring-1 ring-primary/30">
            <Zap className="size-3.5 text-primary" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-foreground">Onezone</span>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed top-0 left-0 h-full w-56 bg-sidebar border-r border-border z-50 flex flex-col md:hidden">
            <div className="flex items-center justify-between px-4 py-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center size-7 rounded-md bg-primary/15 ring-1 ring-primary/30">
                  <Zap className="size-4 text-primary" />
                </div>
                <span className="font-semibold text-sm tracking-tight text-foreground">Onezone</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close menu"
              >
                <X className="size-4" />
              </button>
            </div>
            <nav className="flex flex-col gap-1 p-2 flex-1">
              {navLinks(() => setMobileOpen(false))}
            </nav>
            <div className="px-4 py-3 border-t border-border flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Terminal task runner</p>
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
