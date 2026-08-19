import { MetadataRoute } from 'next'
 
/**
 * Produces the application-wide crawler policy.
 *
 * @returns A Next.js robots descriptor that disallows indexing of every route.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: '/',
    },
  }
}
