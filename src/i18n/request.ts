import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

/**
 * Resolves the locale and message catalog for each internationalized server request.
 *
 * @remarks
 * Invalid or missing route locales fall back to `routing.defaultLocale`, keeping server-rendered labels and localized
 * MDX selection aligned with the supported locale contract.
 */
export default getRequestConfig(async ({ requestLocale }) => {
    // This typically corresponds to the `[locale]` segment
    let locale = await requestLocale;

    // Ensure that a valid locale is used
    if (!locale || !routing.locales.includes(locale as any)) {
        locale = routing.defaultLocale;
    }

    return {
        locale,
        messages: (await import(`../../messages/${locale}.json`)).default
    };
});
