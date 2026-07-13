import { MainNavigation } from '@/components/layout/main-navigation';
import { siteLabels } from '@/lib/labels';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: siteLabels.applicationName,
  description: siteLabels.applicationDescription,
};

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#171c14',
  width: 'device-width',
  initialScale: 1,
};

interface RootLayoutProps {
  readonly children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="fr">
      <body>
        <div className="site-shell">
          <MainNavigation />
          <main className="site-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
