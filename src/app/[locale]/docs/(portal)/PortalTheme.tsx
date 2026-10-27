'use client';

import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { useTheme } from 'next-themes';

const subscribe = () => () => { };

/** Limits FumaDocs' dark palette to the portal instead of the application shell. */
export default function PortalTheme({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const portalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const portal = portalRef.current;
    const topbar = document.getElementById('app-topbar');
    if (!portal || !topbar) return;

    const updateOffset = () => {
      const gap = Number.parseFloat(window.getComputedStyle(portal).marginTop) || 0;
      const offset = Math.ceil(topbar.getBoundingClientRect().height + gap);
      portal.style.setProperty('--fd-banner-height', `${offset}px`);
    };

    const observer = new ResizeObserver(updateOffset);
    observer.observe(topbar);
    updateOffset();
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!mounted) return;
    const portal = portalRef.current;
    const topbar = document.getElementById('app-topbar');
    if (!portal || !topbar) return;

    topbar.style.setProperty('--fd-portal-surface', window.getComputedStyle(portal).backgroundColor);
    return () => {
      topbar.style.removeProperty('--fd-portal-surface');
    };
  }, [mounted, resolvedTheme]);

  return (
    <div
      ref={portalRef}
      className={`fumadocs-portal bg-fd-background text-fd-foreground transition-colors${mounted && resolvedTheme === 'dark' ? ' dark' : ''}`}
    >
      {children}
    </div>
  );
}
