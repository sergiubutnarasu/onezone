import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { AppNav } from '@/components/AppNav';
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
      className={cn('dark font-sans', geistSans.variable, geistMono.variable)}
      suppressHydrationWarning
    >
      <head>
        {/* Apply theme before first paint to avoid flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme');if(t==='light'){document.documentElement.classList.remove('dark')}else{document.documentElement.classList.add('dark')}})()`,
          }}
        />
      </head>
      <body className="bg-background text-foreground antialiased" suppressHydrationWarning>
        <Providers>
          <div className="flex h-dvh overflow-hidden">
            <AppNav />
            <main className="flex-1 min-w-0 overflow-y-auto pt-12 md:pt-0">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
