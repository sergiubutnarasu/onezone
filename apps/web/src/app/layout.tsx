import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { AppShell } from '@/components/AppShell';
import { cn } from '@/lib/utils';

const geistSans = Geist({ subsets: ['latin'], variable: '--font-sans' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Onezone',
  description: 'Agent task runner',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={cn('font-sans', geistSans.variable, geistMono.variable)}
      suppressHydrationWarning
    >
      <head>
        {/* Resolve theme before first paint to avoid flash.
            Stored value wins; otherwise follow the OS preference. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var dark=t==='dark'||(t!=='light'&&m);if(dark){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="bg-background text-foreground antialiased" suppressHydrationWarning>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
