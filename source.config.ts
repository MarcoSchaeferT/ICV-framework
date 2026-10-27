import { defineConfig } from 'fumadocs-mdx/config';
import remarkGfm from 'remark-gfm';

/**
 * Shared compiler settings for MDX files outside the Fumadocs collection.
 *
 * The existing application documentation lives under `messages/markdown` and
 * relies on the legacy component registry for localized links and GitHub-style
 * alerts. Fumadocs pages still receive their richer component set explicitly
 * from the portal route.
 */
export default defineConfig({
  mdxOptions: {
    preset: 'minimal',
    providerImportSource: '@/mdx-components',
    remarkPlugins: [remarkGfm],
  },
});
