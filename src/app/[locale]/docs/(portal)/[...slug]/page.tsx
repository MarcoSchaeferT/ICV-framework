import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/layouts/docs/page';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Card } from 'fumadocs-ui/components/card';
import { docsSource } from '@/lib/docs-source';
import { getMDXComponents } from '@/mdx-components';

interface DocumentationPortalPageProps {
  params: Promise<{ locale: string; slug: string[] }>;
}

/** Removes source-file extensions from legacy TypeDoc URLs. */
function normalizeDocumentationSlug(slug: string[]): string[] {
  return slug.map((segment, index) =>
    index === slug.length - 1 ? segment.replace(/\.mdx?$/i, '') : segment,
  );
}

const relocatedGuidePages: Record<string, 'user-guide' | 'developer-guide'> = {
  'getting-started': 'user-guide',
  'uploading-data': 'user-guide',
  'exploring-data': 'user-guide',
  'maps-and-linked-views': 'user-guide',
  troubleshooting: 'user-guide',
  'local-development': 'developer-guide',
  architecture: 'developer-guide',
  'usage-examples': 'developer-guide',
  'best-practices': 'developer-guide',
  'maintaining-documentation': 'developer-guide',
  api: 'developer-guide',
};

/** Keep previously emitted root-level links to guide pages usable. */
function relocatedGuideSlug(slug: string[]): string[] | null {
  if (slug.length !== 1) return null;
  const guide = Object.hasOwn(relocatedGuidePages, slug[0])
    ? relocatedGuidePages[slug[0]]
    : undefined;
  return guide ? [guide, slug[0]] : null;
}

/** Generates English routes for every portal document. */
export function generateStaticParams() {
  return docsSource.generateParams('slug', 'locale');
}

/** Maps portal frontmatter to Next.js page metadata. */
export async function generateMetadata({
  params,
}: DocumentationPortalPageProps): Promise<Metadata> {
  const { slug } = await params;
  const normalizedSlug = normalizeDocumentationSlug(slug);
  const page = docsSource.getPage(relocatedGuideSlug(normalizedSlug) ?? normalizedSlug, 'en');
  if (!page) notFound();

  return {
    title: `${page.data.title} | ICV Documentation`,
    description: page.data.description,
  };
}

/** Renders a portal page with breadcrumb, table of contents, and pagination. */
export default async function DocumentationPortalPage({
  params,
}: DocumentationPortalPageProps) {
  const { locale, slug } = await params;
  const normalizedSlug = normalizeDocumentationSlug(slug);
  const relocatedSlug = relocatedGuideSlug(normalizedSlug);
  const page = docsSource.getPage(relocatedSlug ?? normalizedSlug, 'en');
  if (!page) notFound();

  if (locale !== 'en' || normalizedSlug.join('/') !== slug.join('/') || relocatedSlug) {
    permanentRedirect(page.url);
  }

  const MDX = page.data.body;

  // MDX links refer to source files. An index.mdx page is served without a
  // trailing slash, so browser-relative links would lose its directory.
  const resolvePortalHref = (href?: string) => {
    if (!href || /^(?:[a-z][a-z\d+.-]*:|\/\/|\/|#|\?)/i.test(href)) return href;
    const [, pathname, suffix] = href.match(/^([^?#]+)(.*)$/) ?? [];
    if (!pathname) return href;
    const relativePath = pathname.startsWith('.') ? pathname : `./${pathname}`;
    const directoryLink = relativePath.endsWith('/') || /(?:^|\/)\.\.?$/.test(relativePath);
    const target = directoryLink
      ? `${relativePath}${relativePath.endsWith('/') ? '' : '/'}index`
      : relativePath;
    for (const candidate of [target, `${target}.mdx`]) {
      const resolved = docsSource.resolveHref(candidate, page);
      if (resolved !== candidate) return `${resolved}${suffix}`;
    }
    return href;
  };

  const mdxComponents = getMDXComponents({
    a: ({ href, ...props }) => (
      <defaultMdxComponents.a href={resolvePortalHref(href)} {...props} />
    ),
    Card: ({ href, ...props }) => (
      <Card href={resolvePortalHref(href)} {...props} />
    ),
  });

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      {page.data.description && (
        <DocsDescription>{page.data.description}</DocsDescription>
      )}
      <DocsBody>
        <MDX components={mdxComponents} />
      </DocsBody>
    </DocsPage>
  );
}
