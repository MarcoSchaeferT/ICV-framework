import type { Metadata } from "next";
import { ReactNode } from "react";
import { Inter } from "next/font/google";
import Script from "next/script";
import "../globals.css";
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, setRequestLocale } from 'next-intl/server';
import DynamicUI from '@/components/layout/DynamicUI';
import DocumentationThemeProvider from '@/components/layout/DocumentationThemeProvider';
import NavbarLeft from '@/components/layout/NavbarLeft';
import { layoutSizes } from "@/app/const_store";
import CopyrightFooter from '@/components/layout/small_UI_elements/copyrightFooter';
import PageTracker from '@/components/PageTracker';



const inter = Inter({
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
  display: "swap",
});

/**
 * Asynchronous App Router locale parameters and nested route content.
 *
 * @example
 * ```tsx
 * const layoutProps: LocaleLayoutProps = {
 *   params: Promise.resolve({ locale: "de" }),
 *   children: <main>Dengue surveillance</main>,
 * };
 * ```
 */
interface LocaleLayoutProps {
  /** Nested route content rendered within the locale provider. */
  children?: ReactNode;
  /** Asynchronous App Router parameters containing the requested locale. */
  params: Promise<{ locale: string }>;
}

/** Global application metadata and non-indexing policy. */
export const metadata: Metadata = {
  title: "ICV",
  description: "Developed by AI-DAVis members...",
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: {
      url: "/icon.svg",
      type: "image/svg",
    },
  },
};

import { routing } from '@/i18n/routing';

/** Returns one statically generated layout parameter for every supported locale. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * Provides localized messages, persistent navigation, tracking, dialogs, and the legal footer to every route.
 *
 * @param props - Localized route content and asynchronous locale parameter.
 * @returns The root HTML document for the selected locale.
 */
export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const resolvedParams = await params;
  setRequestLocale(resolvedParams.locale);

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();
  const locale = await getLocale();



  return (
    <html lang={locale} suppressHydrationWarning={true}>
      <body className={`${inter.className} overflow-y-scroll overflow-x-clip bg-surface-default`} suppressHydrationWarning={true}>
        <DocumentationThemeProvider>
          <PageTracker />
          <NextIntlClientProvider messages={messages}>
            {/* Privacy-friendly analytics by Plausible */}
            <Script
              async
              src="http://168.119.228.102:8100/js/pa-Za_Qqqc2BILDkJGFan2I7.js"
              strategy="afterInteractive"
            />
            <Script id="plausible-init" strategy="afterInteractive">
              {`
              window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
              plausible.init();
            `}
            </Script>
            {/* Wrap all pages in the layout with the dynamicUI (navbars etc.)
            ToDo: get rid of wrapping everything into a client component "DynamicUI"
            Problem: all is now CSR and no SSR is possible
            Goal: allow SSR for "children"
           */}
            <DynamicUI layoutSizes={layoutSizes}>
              <main>
                {children}
              </main>
              <CopyrightFooter textColor="#000000" />
            </DynamicUI>
          </NextIntlClientProvider>
        </DocumentationThemeProvider>
      </body>
    </html>
  );
}
