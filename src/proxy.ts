import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

/** Locale-aware Next.js middleware configured with the canonical application routing contract. */
export default createMiddleware(routing);

/** Restricts locale negotiation to the root and supported English/German routes. */
export const config = {
    // Match only internationalized pathnames
    matcher: ['/', '/(de|en)/:path*']
};
