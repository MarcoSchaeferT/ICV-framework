// https://github.com/amannn/next-intl/tree/main/examples/example-app-router
import {routing} from '@/i18n/routing';
import { useLocale, useTranslations } from 'next-intl';
import LocalizationSwitcherSelect from "./localizationSwitcherSelect"



export default function LocalizationSwitcher() {
  const t = useTranslations("localeSwitcher");
  const locale = useLocale();
  //const locale = routing.defaultLocale;
  const locales = routing.locales;

    return (
        <LocalizationSwitcherSelect defaultValue={locale} label={t('label')} style='chip'>
            {locales.map((entry) => (
                <option key={entry} value={entry}>
                    {t("locale", { locale: entry })}
                </option>
            ))}
           
        </LocalizationSwitcherSelect>
    );
}