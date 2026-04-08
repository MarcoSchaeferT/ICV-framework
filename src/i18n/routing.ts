// https://github.com/amannn/next-intl/tree/main/examples/example-app-router

import { defineRouting, LocalePrefix, Pathnames } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
    // A list of all locales that are supported
    locales: ['en', 'de'],

    // Used when no locale matches
    defaultLocale: 'en'
});

// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
export const { Link, redirect, usePathname, useRouter, getPathname } =
    createNavigation(routing);

export type Locale = (typeof routing.locales)[number];