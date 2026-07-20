"use client";

import MdxLayout from '@/mdx-layout'
import { useLocale } from 'next-intl'
import { MDXContentProvider } from '@messages/markdown/MDXContentProvider'

export default function ImpressumPage() {
  const locale = useLocale();
  
  const Content = MDXContentProvider[locale].pages.Impressum.content;
  if (!Content) return null;

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="bg-white dark:bg-gray-900/90 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 p-8 md:p-12 transition-all duration-300">
        <MdxLayout>
          <Content />
        </MdxLayout>
      </div>
    </div>
  );
}
