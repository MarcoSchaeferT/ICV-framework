import { defineDocs } from 'fumadocs-mdx/macro';
import { applyMdxPreset } from 'fumadocs-mdx/config';
import { loader } from 'fumadocs-core/source';
import { docsI18n } from '@/lib/docs-i18n';

const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    // Keep the Fumadocs transformations local to the new portal. Legacy MDX
    // files use the minimal compiler configured in `source.config.ts`.
    mdxOptions: (environment) => applyMdxPreset()(environment),
  },
});

/** File-backed source for user and developer documentation. */
export const docsSource = loader({
  baseUrl: '/docs',
  i18n: docsI18n,
  source: docs.toFumadocsSource(),
});
