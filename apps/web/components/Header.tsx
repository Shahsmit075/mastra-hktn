'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Moon, Sun, LayoutDashboard, ShieldAlert } from 'lucide-react';

export function Header() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold tracking-tight">
            <ShieldAlert className="w-5 h-5 text-amber" />
            <span>Runbook Sentinel</span>
          </Link>
          <nav className="hidden md:flex items-center gap-4 text-sm font-medium text-muted-foreground">
            <Link href="/dashboard" className="hover:text-foreground transition-colors flex items-center gap-1">
              <LayoutDashboard className="w-4 h-4" />
              War Room
            </Link>
            <Link href="/analytics" className="hover:text-foreground transition-colors">
              Analytics
            </Link>
            <div className="w-px h-4 bg-border mx-2"></div>
            <Link href="/showcase" className="hover:text-amber transition-colors flex items-center gap-1 font-semibold text-amber">
              <span className="text-lg leading-none">✨</span>
              Demo Showcase
            </Link>
          </nav>
        </div>
        
        <div className="flex items-center gap-4">
          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-md hover:bg-surface border border-transparent hover:border-border transition-colors text-muted-foreground hover:text-foreground"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
