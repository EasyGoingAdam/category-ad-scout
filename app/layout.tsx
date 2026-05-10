import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Category Ad Scout',
  description: 'Find brands in any category, score them as outreach targets.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="max-w-6xl mx-auto px-6 py-6">
          <header className="flex items-center justify-between mb-6">
            <a href="/" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-accent text-ink font-bold flex items-center justify-center">
                C
              </div>
              <div>
                <div className="text-sm uppercase tracking-widest text-muted">Category</div>
                <div className="font-semibold leading-tight">Ad Scout</div>
              </div>
            </a>
            <nav className="flex gap-2 text-sm">
              <a className="btn-ghost" href="/">Home</a>
              <a className="btn-ghost" href="/scans">Scans</a>
              <a className="btn-ghost" href="/schedules">Schedules</a>
            </nav>
          </header>
          {children}
          <footer className="mt-12 text-xs text-muted">
            Built for outreach &amp; competitive research. Not affiliated with Meta, Amazon, SEMrush, or Hunter.
          </footer>
        </div>
      </body>
    </html>
  );
}
