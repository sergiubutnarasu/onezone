'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FolderOpen, Bot, Sun, Moon, Menu, X, Monitor, Blocks, Bell, LogOut, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/lib/theme';
import { useQuery } from '@tanstack/react-query';
import { fetchUnreadCount } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Logo } from '@/components/Logo';

const NAV_ITEMS = [
  { href: '/', label: 'Projects', icon: FolderOpen, exact: true },
  { href: '/statistics', label: 'Statistics', icon: BarChart3, exact: true },
  { href: '/agents', label: 'Agents', icon: Bot, exact: true },
  { href: '/terminals', label: 'Terminals', icon: Monitor, exact: true },
  { href: '/skills', label: 'Skills', icon: Blocks, exact: true },
  { href: '/notifications', label: 'Notifications', icon: Bell, exact: true },
];

export function AppNav() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: fetchUnreadCount,
    refetchInterval: 30_000,
  });

  const navLinks = (onNav?: () => void) =>
    NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
      const active = exact ? pathname === href : pathname.startsWith(href);
      const isNotifications = href === '/notifications';
      return (
        <Link
          key={href}
          href={href}
          onClick={onNav}
          className={cn(
            'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
            active
              ? 'bg-accent text-accent-foreground font-medium'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <Icon className="size-4 shrink-0" />
          <span className="flex-1">{label}</span>
          {isNotifications && unreadCount > 0 && (
            <span className="ml-auto flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>
      );
    });

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-border bg-sidebar h-screen sticky top-0">
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border">
          <Logo withWordmark />
        </div>
        <nav className="flex flex-col gap-1 p-2 flex-1">{navLinks()}</nav>
        <div className="px-4 py-3 border-t border-border flex items-center justify-between">
          <p className="text-xs text-muted-foreground">One zone for agents</p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="size-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            <button
              onClick={logout}
              className="size-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              aria-label="Log out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
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
        <Logo withWordmark />
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
                <Logo withWordmark />
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
              <p className="text-xs text-muted-foreground">One zone for agents</p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="size-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  aria-label="Toggle theme"
                >
                  {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
                </button>
                <button
                  onClick={logout}
                  className="size-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  aria-label="Log out"
                >
                  <LogOut className="size-4" />
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
