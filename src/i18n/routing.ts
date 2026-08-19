// https://github.com/amannn/next-intl/tree/main/examples/example-app-router

import { defineRouting, LocalePrefix, Pathnames } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

/** Canonical locale list and fallback used by routing, middleware, navigation, and MDX selection. */
export const routing = defineRouting({
    // A list of all locales that are supported
    locales: ['en', 'de'],

    // Used when no locale matches
    defaultLocale: 'en'
});

// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
/** Locale-aware navigation helpers bound to {@link routing}. */
export const { Link, redirect, usePathname, useRouter, getPathname } =
    createNavigation(routing);

/**
 * Supported locale identifier inferred from the routing configuration.
 *
 * @example
 * ```ts
 * const metadataLanguage: Locale = "de";
 * ```
 */
export type Locale = (typeof routing.locales)[number];
