import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

/** Shared navigation and repository links for the documentation shell. */
export function docsLayoutOptions(): BaseLayoutProps {
  return {
    nav: {
      title: 'ICV Documentation',
      url: '/en/docs/overview',
    },
    links: [
      { text: 'Back to ICV', url: '/en', active: 'none' },
      { text: 'Help & datasets', url: '/en/docs', active: 'none' },
    ],
    githubUrl: 'https://github.com/MarcoSchaeferT/ICV-framework',
    i18n: false,
    themeSwitch: {
      enabled: true,
    },
  };
}
