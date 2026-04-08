import { BlogPost } from '../../components/blogPosts'
import { TabularAccordion } from '../../components/blogTabularAccordion';
import { blogVectors, blogDiseases } from '../../../../messages/vectorInfo';
import {useLocale, useTranslations} from 'next-intl';
import { t_richConfig } from '../../const_store';
import { routing, useRouter, Locale } from '@/i18n/routing';
import { ScrollToButtonUp } from '../../components/layout/small_UI_elements/ScrollToButton';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export default function BlogPage() {

  const t = useTranslations('page_domainInfo');
  const locale = useLocale() as Locale;

  return (
  <>
  <div id='scroll-anchor1' ></div>
  {/**********************************
    *** Mosquito Species - Vectors ***
    **********************************/}
    <div className="bg-slate-200 size-full mt-6">
      <h1 className="text-6xl text-center p-16">
        {t.rich('MosquitoHeading',{
          ...t_richConfig,
        })}
      </h1>
    </div>
    <section className="max-w-4xl mx-auto px-4 py-8">
      <BlogPost blogContent={blogVectors[locale]}/>
      <ScrollToButtonUp scrollToAnchor='scroll-anchor1' />
    </section>
   

  {/****************************
    *** Vector Born Diseases ***
    ****************************/}
    <div className="bg-slate-200 size-full mt-6">
      <h1 className="text-6xl  text-center p-16">
        {t.rich('VectorHeading',{
          ...t_richConfig,
        })}
      </h1>
    </div>

      {/* as TabularAccordion */}
      <section className="max-w-4xl mx-auto px-4 py-8 ">
        <div className='pb-80  overflow-hidden'>
          <TabularAccordion tabularAccordionContent={blogDiseases[locale]} />
          <ScrollToButtonUp scrollToAnchor='scroll-anchor1' />
        </div>
      
      </section>

      {/* or as BlogPost */}
      {/*
      <section className="max-w-4xl mx-auto px-4 py-8">
      <BlogPost blogContent={blogDiseases[locale]}/>
      </section>
      */}
  </>
  )
}



