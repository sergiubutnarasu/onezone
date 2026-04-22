'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FolderOpen, Bot, Zap, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/lib/theme';

const NAV_ITEMS = [
  { href: '/', label: 'Projects', icon: FolderOpen, exact: true },
  { href: '/agents', label: 'Agents', icon: Bot, exact: true },
];

export function AppNav() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  return (
    <aside className="flex flex-col w-56 shrink-0 border-r border-border bg-sidebar h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border">
        <div className="flex items-center justify-center size-7 rounded-md bg-primary/15 ring-1 ring-primary/30">
          <Zap className="size-4 text-primary" />
        </div>
        <span className="font-semibold text-sm tracking-tight text-foreground">Onezone</span>
      </div>

      {/* Nav links */}
      <nav className="flex flex-col gap-1 p-2 flex-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
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
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Agent task runner</p>
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
      </div>
    </aside>
  );
}
