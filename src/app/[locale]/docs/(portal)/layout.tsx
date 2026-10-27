import type { ReactNode } from 'react';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { docsLayoutOptions } from '@/lib/docs-layout';
import { docsSource } from '@/lib/docs-source';
import PortalTheme from './PortalTheme';

interface DocumentationPortalLayoutProps {
  children: ReactNode;
}

/** Provides English navigation and search for the documentation portal. */
export default async function DocumentationPortalLayout({
  children,
}: DocumentationPortalLayoutProps) {
  const tree = docsSource.pageTree.en;

  return (
    <RootProvider theme={{ enabled: false }}>
      <PortalTheme>
        <DocsLayout tree={tree} {...docsLayoutOptions()}>
          {children}
        </DocsLayout>
      </PortalTheme>
    </RootProvider>
  );
}
