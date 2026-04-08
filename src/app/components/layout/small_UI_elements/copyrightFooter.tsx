import React from "react";
import {Link, routing} from '@/i18n/routing';
import Image from "next/image";
import { useTranslations } from "next-intl";
import { t_richConfig } from "@/app/const_store";


export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

const CopyrightFooter = ({ textColor = "#000000" }: { textColor?: string }) => {
  const t = useTranslations("component_copyrightFooter");
  return (
     <footer className="border-t mt-16 max-w-full mx-auto">
        <div className="container mx-auto px-4 py-8">
          <div className={`flex flex-col md:flex-row justify-around items-start gap-6 md:items-start text-sm text-gray-300`} style={{ color: textColor }}>
   
              <p>
              &copy; {new Date().getFullYear()} ICV - {t.rich('copyright', { ...t_richConfig })}
              
              {/*. Open source under following  <br />Licenses:
              &nbsp;
              <Link href="https://creativecommons.org/licenses/by/3.0/" className="underline" target="_blank" rel="noopener noreferrer">
                CC BY 3.0
              </Link>
              ,&nbsp;
              <Link href="https://creativecommons.org/licenses/by/4.0/" className="underline" target="_blank" rel="noopener noreferrer">
                CC BY 4.0
              </Link> 
              ,&nbsp; 
              <Link href="https://github.com/atisawd/boxicons/blob/master/LICENSE" className="underline" target="_blank" rel="noopener noreferrer">
                MIT
              </Link>*/}
              
              </p>
              <div className="flex items-start gap-3 ">
                <Image
                  src="/bmas_offic_farbe_de_wbz.png"
                  alt="BMAS Logo"
                  width={150}
                  height={106}
                  className="rounded"
                  style={{ minHeight: 96 }}
                />
                 <p className="text-sm max-w-[240px] pt-1">
                                              {t.rich('funding', { ...t_richConfig })}: <a className="underline hover:font-semibold" href="https://www.bundesgesundheitsministerium.de/ministerium/ressortforschung/handlungsfelder/digitalisierung/ai-davis-pandemics.html">{t.rich('projectName', { ...t_richConfig })}</a>
                  </p>
              </div>
            
            <div className="flex items-center gap-4">
              <Link href="/about" className="text-md hover:underline">
                {t.rich('furtherInfo', { ...t_richConfig })}
              </Link>
              <br></br>
              
               <Link href="https://github.com/MarcoSchaeferT/ICV-framework" className="flex items-center gap-2">
                    {/*<GitHubIcon  />*/}
                  GitHub
                  </Link>
            </div>
          </div>
        </div>
      </footer>
  );
}

export default CopyrightFooter;
