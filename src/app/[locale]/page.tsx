
import { layoutSizes } from "../const_store";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { t_richConfig } from "../const_store";
import { LINK } from '../../../messages/navbarContent';
import {
  TestTube,
  Axes,
  MediaImage,
  MediaImagePlus,
  Arc3d,
  Gym,
  ReportColumns,
  StatsReport,
} from "iconoir-react";
import { routing} from '@/i18n/routing';
import ShowcaseGrid from './home/ShowCases';
import Image from 'next/image';
import SettingButton from './home/SettingsButton';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}


export default function Home() {
const t = useTranslations("page_home.pageContent");
const subpage_features = useTranslations("page_home.subpage_features");


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
            <div className="bg-white min-h-[300] min-w-[300px] rounded-xl flex items-center justify-center pr-0 pl-5 shadow-lg transition-transform duration-300 hover:scale-105 hover:shadow-2xl">
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
                  src="/bmas_offic_farbe_de_wbz.png"
                  alt="BMAS Logo"
                  width={140}
                  height={106}
                  className="rounded"
                  style={{ minHeight: 96 }}
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
          className="container w-full space-y-6 rounded-xl bg-slate-50 dark:bg-transparent flex flex-col items-center"
        >
          <div className=""></div>
            <h2 className="font-heading text-4xl leading-[1.1] sm:text-3xl md:text-4xl rounded-lg px-4 pt-2 ">
            Show Cases
            </h2>
          <ShowcaseGrid />
          <div className="h-6"></div>
          {/* <Features /> */}
         {/*}
          <div className="mx-auto text-center md:max-w-232">
            <p className="leading-normal sm:text-lg sm:leading-7"></p>
            {subpage_features.rich('bottomText', {...t_richConfig})}{" "}
            <Link href='/about' className='text-cyan-700 pr-1'>
              {subpage_features.rich('bottomTextAbout', {...t_richConfig})}
            </Link>
            {subpage_features.rich('bottomTextOr', {...t_richConfig})}{" "}
            <Link href='https://marcoschaefert.github.io/davisDocu/' className='text-cyan-700'>
              AVis Docs
            </Link>
          </div>*/}
        </section>
      </div>
    </div>
  </div>
  

</>
)
}


const Features = () => {

  const subpage_features = useTranslations("page_home.subpage_features");
  const subpage_features_featureList = useTranslations("page_home.featureList");

  return (
    <>
   <div className="mx-auto flex max-w-232 flex-col items-center space-y-4 text-center pt-20">
            <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-4xl     rounded-lg px-4 py-2">
              {subpage_features.rich('heading', {...t_richConfig})}
            </h2>
            <p className="max-w-[85%] leading-normal sm:text-lg sm:leading-7">
              {subpage_features.rich('subHeading', {...t_richConfig})}
            </p>
          </div>
          <div className="mx-auto grid justify-center gap-4 sm:grid-cols-2 md:max-w-5xl md:grid-cols-3">
            {/* ...feature cards unchanged... */}
            <div className="relative overflow-hidden rounded-lg border bg-background p-2">
              <div className="flex h-[180px] flex-col justify-between rounded-md p-6">
                <Axes className="h-12 w-12" />
                <div className="space-y-2">
                  <h3 className="font-bold">
                    {subpage_features_featureList.rich('feature1.heading', {...t_richConfig})}
                  </h3>
                  <p className="text-sm">
                    {subpage_features_featureList.rich('feature1.description', {...t_richConfig})}
                  </p>
                </div>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-lg border bg-background p-2">
              <div className="flex h-[180px] flex-col justify-between rounded-md p-6">
                <ReportColumns className="h-12 w-12" />
                <div className="space-y-2">
                  <h3 className="font-bold">
                    {subpage_features_featureList.rich('feature2.heading', {...t_richConfig})}
                  </h3>
                  <p className="text-sm">
                    {subpage_features_featureList.rich('feature2.description', {...t_richConfig})}
                  </p>
                </div>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-lg border bg-background p-2">
              <div className="flex h-[180px] flex-col justify-between rounded-md p-6">
                <div className="flex space-x-2">
                  <MediaImage className="h-12 w-12" />
                  <Arc3d className="h-12 w-12" />
                  <MediaImagePlus className="h-12 w-12" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-bold">
                    {subpage_features_featureList.rich('feature3.heading', {...t_richConfig})}
                  </h3>
                  <p className="text-sm">
                    {subpage_features_featureList.rich('feature3.description', {...t_richConfig})}
                  </p>
                </div>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-lg border bg-background p-2">
              <div className="flex h-[180px] flex-col justify-between rounded-md p-6">
                <Gym className="h-12 w-12" />
                <div className="space-y-2">
                  <h3 className="font-bold">
                    {subpage_features_featureList.rich('feature4.heading', {...t_richConfig})}
                  </h3>
                  <p className="text-sm">
                    {subpage_features_featureList.rich('feature4.description', {...t_richConfig})}
                  </p>
                </div>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-lg border bg-background p-2">
              <div className="flex h-[180px] flex-col justify-between rounded-md p-6">
                <StatsReport className="h-12 w-12" />
                <div className="space-y-2">
                  <h3 className="font-bold">
                    {subpage_features_featureList.rich('feature5.heading', {...t_richConfig})}
                  </h3>
                  <p className="text-sm">
                    {subpage_features_featureList.rich('feature5.description', {...t_richConfig})}
                  </p>
                </div>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-lg border bg-background p-2">
              <div className="flex h-[180px] flex-col justify-between rounded-md p-6">
                <TestTube className="h-12 w-12" />
                <div className="space-y-2">
                  <h3 className="font-bold">
                    {subpage_features_featureList.rich('feature6.heading', {...t_richConfig})}
                  </h3>
                  <p className="text-sm">
                    {subpage_features_featureList.rich('feature6.description', {...t_richConfig})}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
  )
}
