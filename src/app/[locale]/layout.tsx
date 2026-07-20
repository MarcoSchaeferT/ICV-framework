import type { Metadata } from "next";
import { ReactNode } from "react";
import { Inter } from "next/font/google";
import "../globals.css";
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import DynamicUI from '@/components/layout/DynamicUI';
import NavbarLeft from '@/components/layout/NavbarLeft';
import { layoutSizes } from "@/app/const_store";
import CopyrightFooter from '@/components/layout/small_UI_elements/copyrightFooter';
import PageTracker from '@/components/PageTracker';
import Script from "next/script";



const inter = Inter({
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
  display: "swap",
});

interface LocaleLayoutProps {
  children?: ReactNode;
  params: Promise<{ locale: string }>;
}

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

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

import { setRequestLocale } from 'next-intl/server';

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
        <Script
          /* Privacy-friendly analytics by Plausible */
          async
          src="http://89.168.106.64:8081/js/pa-jQs1es8fnfS85prcB9WUR.js"
          strategy="afterInteractive"
        />
          <Script id="plausible-init" strategy="afterInteractive">
            {`
              window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
              plausible.init();
            `}
        </Script>
        
        <PageTracker />
        <NextIntlClientProvider messages={messages}>

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
      </body>
    </html>
  );
}