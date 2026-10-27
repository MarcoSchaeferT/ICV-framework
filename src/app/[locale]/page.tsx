
import { layoutSizes, t_richConfig } from "@/app/const_store";
import { routing } from "@/i18n/routing";
import ShowcaseGrid from './home/ShowCases';
import LayoutTemplatesGrid from './home/LayoutTemplates';
import Image from 'next/image';
import SettingButton from './home/SettingsButton';

/** Returns one statically generated landing-page parameter for every supported locale. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}


import { setRequestLocale, getTranslations } from 'next-intl/server';

/**
 * Renders the localized ICV landing page and Vis. Interface showcase navigation.
 *
 * @param props - Asynchronous locale route parameter.
 * @returns The server-rendered localized home page.
 */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = await params;
  setRequestLocale(resolvedParams.locale);
  const t = await getTranslations("page_home.pageContent");


return (
  <>
  <div
    className={`min-h-[165vh] relative bg-[#003f97]  overflow-hidden`}
    style={{
      marginTop: `-${layoutSizes.topNavbarHeight}px`,
     
    }}
  >
    <div className='flex justify-center'>
      
      <section className="space-y-6 pb-8 pt-6 md:pb-12 md:pt-10 lg:pt-28" style={{ paddingBottom: `calc(7rem - ${layoutSizes.topNavbarHeight}px)` }}>
        <div className="container flex max-w-6xl flex-col items-center gap-4 text-center pt-20 pb-6">
          <div className="flex flex-row items-center gap-8">
            <div className="bg-white min-h-[300px] min-w-[300px] rounded-xl flex items-center justify-center pr-0 pl-5 shadow-lg transition-transform duration-300 hover:scale-105 hover:shadow-2xl">
              <Image src="/iconHighDetail.svg" alt="Icon" width={300} height={300} className="" />
            </div>
            <h1 className="font-heading text-neutral-50 text-3xl sm:text-5xl md:text-7xl lg:text-6xl pt-4 text-left leading-tight font-bold ">
              {t.rich('heading', { ...t_richConfig })}
            </h1>
          </div>
        </div>
        
            <div className="flex items-start gap-3 mt-4">
              <div className="max-w-2xl text-neutral-200 leading-normal sm:text-xl sm:leading-8 text-left ">
              {t.rich('subHeading', { ...t_richConfig })} 
               <SettingButton />
              </div>
               <Image
                  src="/BMG_Logo.svg"
                  alt="BMG Logo"
                  width={140}
                  height={106}
                  className="rounded"
                  style={{ minHeight: 96, backgroundColor: "white", padding: "0px", borderRadius: "4px" }}
                />
                <p className="text-sm text-neutral-200 max-w-[240px] pt-1">
                  {t.rich('funding', { ...t_richConfig })}: <a className="underline hover:font-semibold" href="https://www.bundesgesundheitsministerium.de/ministerium/ressortforschung/handlungsfelder/digitalisierung/ai-davis-pandemics.html">{t.rich('projectName', { ...t_richConfig })}</a>)
                </p>
              </div>
                        
      </section>
    </div>

    <div className='flex justify-center'>
      <div className="flex justify-center w-full">
        <section
          id="features"
          className="container w-[80%] space-y-6 rounded-xl bg-slate-50 dark:bg-transparent flex flex-col items-center pb-12"
        >
          <div className=""></div>
            <h2 className="font-heading text-4xl leading-[1.1] sm:text-3xl md:text-4xl rounded-lg px-4 pt-2 ">
            {t("ShowCases")}
          </h2>
          <ShowcaseGrid />
          <div className="h-6"></div>
          <LayoutTemplatesGrid />
        </section>
      </div>
    </div>
  </div>
  

</>
)
}

