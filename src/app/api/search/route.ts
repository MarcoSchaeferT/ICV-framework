import { createFromSource } from 'fumadocs-core/search/server';
import { docsSource } from '@/lib/docs-source';

/** Full-text search endpoint for the English user and developer guides. */
export const { GET } = createFromSource(docsSource);
