import Welcome from './hello.mdx'
import MdxLayout from '@/mdx-layout'
import {MDXContentProvider} from '../../../../messages/markdown/MDXContentProvider'
import { routing, useRouter, Locale } from '@/i18n/routing';
import { useLocale } from 'next-intl';
import { InfoIcon } from 'lucide-react';
import { OpenInBrowser } from 'iconoir-react';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

 
export default function Page() {
  const locale = useLocale() as Locale;
  const MDXContent = MDXContentProvider[locale].pages.PredictionView.detailView;
  
  return (
    <>
<div className="flex flex-row gap-6">
  <span>Map Interaction
  <div className="max-w-[450px] min-w-[450] max-h-[80vh] overflow-y-auto z-1000 rounded-lg shadow-lg bg-white border-4 border-gray-200 p-4">
    <div className="flex items-start gap-3">
      {/*<div className="shrink-0 mt-[-4px] bg-amber-200 rounded-full p-3 shadow">
        <OpenInBrowser className="h-4 w-4 text-amber-700" />
      </div>
      <div className="flex-1 space-y-2 pb-4 pt-1 ">
        <div className="text-md text-amber-700">Info</div>
      </div>*/}
    </div>
    <div className="flex flex-row gap-4 ml-6 mr-6">
      <MdxLayout>
        <MDXContent.Interaction />
      </MdxLayout>
    </div>
  </div>
  </span>

<span>Map Info
  <div className="max-w-[450px] min-w-[450] max-h-[80vh] overflow-y-auto z-1000 rounded-lg shadow-lg bg-white border-4 border-gray-200 p-4">
    <div className="flex items-start gap-3">
      {/*<div className="shrink-0 mt-[-4px] bg-amber-200 rounded-full p-3 shadow">
        <OpenInBrowser className="h-4 w-4 text-amber-700" />
      </div>
      <div className="flex-1 space-y-2 pb-4 pt-1 ">
        <div className="text-md text-amber-700">Info</div>
      </div>*/}
    </div>
    <div className="flex flex-row gap-4 ml-6 mr-6">
      <MdxLayout>
        <MDXContent.Info />
      </MdxLayout>
    </div>
  </div>
  </span>
  </div>
  


    </>
  )
}