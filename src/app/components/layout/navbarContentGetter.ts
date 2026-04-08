

import { nav_LINKS_top, nav_LINKS_left } from '../../../../messages/navbarContent';
import { getLocale } from 'next-intl/server';
import { useLocale } from 'next-intl';

const Nav_LINKS_TOP = () => {
  const locale = useLocale();
  return nav_LINKS_top[locale];
}

const Nav_LINKS_LEFT = () => {
  const locale = useLocale();
  return nav_LINKS_left[locale];
}



export { Nav_LINKS_TOP, Nav_LINKS_LEFT };