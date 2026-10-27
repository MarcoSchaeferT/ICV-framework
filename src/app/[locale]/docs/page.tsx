"use client";

import MdxLayout from '@/mdx-layout';
import { useTranslations } from 'next-intl';
import { useUIContext } from '@/components/contexts/UIContext';

/**
 * Renders the localized MDX document currently selected through `UIContext`.
 *
 * @returns The original ICV documentation reading surface and active MDX content.
 */
export default function DocumentationPage() {
  const uiContext = useUIContext();
  const t = useTranslations('page_docs');

  return (
    <div className="mt-6 flex items-center justify-center">
      <div className="min-w-4xl max-w-7xl justify-center">
        <div className="z-1000 overflow-y-auto rounded-lg border-4 border-gray-200 bg-white p-4 shadow-lg">
          <div className="mx-6 flex flex-row gap-4">
            <MdxLayout>
              <h1 className="mb-4 text-2xl font-bold">{t.rich('heading')}</h1>
              {uiContext.curDocsMDXContent}
            </MdxLayout>
          </div>
        </div>
      </div>
    </div>
  );
}
