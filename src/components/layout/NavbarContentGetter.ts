

import { nav_LINKS_top, nav_LINKS_left } from '@messages/navbarContent';
import { getLocale } from 'next-intl/server';
import { useLocale } from 'next-intl';

/**
 * Reads the top-navigation registry for the active `next-intl` locale.
 *
 * @returns Localized top-navigation entries.
 * @remarks Must run inside a locale provider because it calls `useLocale`.
 */
const Nav_LINKS_TOP = () => {
  const locale = useLocale();
  return nav_LINKS_top[locale];
}

/**
 * Reads optional utility-navigation entries for the active locale.
 *
 * @returns Localized left-navigation entries, including development links.
 * @remarks The registry may include experimental destinations; it does not
 * define the supported visualization architecture.
 */
const Nav_LINKS_LEFT = () => {
  const locale = useLocale();
  return nav_LINKS_left[locale];
}



/** Locale-aware navigation registries for the top and optional left navigation. */
export { Nav_LINKS_TOP, Nav_LINKS_LEFT };
