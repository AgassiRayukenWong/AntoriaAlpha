import Link from 'next/link';

import { navigationLabels, siteLabels } from '@/lib/labels';

export function MainNavigation() {
  return (
    <nav
      className="main-navigation"
      aria-label={navigationLabels.mainNavigation}
    >
      <Link className="main-navigation__brand" href="/">
        {siteLabels.applicationName}
      </Link>
    </nav>
  );
}
