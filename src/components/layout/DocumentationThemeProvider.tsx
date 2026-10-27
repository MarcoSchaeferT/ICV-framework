'use client';

import { useEffect, type ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';

let hasMountedThemeProvider = false;

/** Keeps the documentation theme across locale changes without rerunning its startup script. */
export default function DocumentationThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    hasMountedThemeProvider = true;
  }, []);

  return (
    <ThemeProvider
      attribute="data-fd-theme"
      storageKey="icv-fumadocs-theme"
      defaultTheme="dark"
      enableSystem
      enableColorScheme={false}
      disableTransitionOnChange
      // React cannot execute an inline script added during client-side locale navigation.
      scriptProps={hasMountedThemeProvider ? { type: 'application/x-icv-theme-init' } : undefined}
    >
      {children}
    </ThemeProvider>
  );
}
