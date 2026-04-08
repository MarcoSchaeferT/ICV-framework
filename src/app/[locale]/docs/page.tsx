"use client"
import MdxLayout from '@/mdx-layout'
import { Locale } from '@/i18n/routing';
import { useLocale, useTranslations } from 'next-intl';
import { useUIContext } from '@/app/components/contexts/UIContext';
 
export default function Page() {
  const locale = useLocale() as Locale;
  const UI_contextT = useUIContext();

  const t = useTranslations("page_docs");

  return (
    <>
      <div className="flex items-center justify-center  mt-6">
        <div className=" min-w-4xl max-w-7xl justify-center">
          <div className="overflow-y-auto z-1000 rounded-lg shadow-lg bg-white border-4 border-gray-200 p-4">
            <div className="flex flex-row gap-4 ml-6 mr-6">
              <MdxLayout>
                <h1 className="text-2xl font-bold mb-4">{t.rich("heading")}</h1>
                  {UI_contextT.curDocsMDXContent}
              </MdxLayout>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}