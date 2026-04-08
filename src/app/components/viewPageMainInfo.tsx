
/**
 * Displays a main information panel with a heading and content.
 *
 * This component renders a styled container with an info icon, a heading, and a description.
 * It uses layout sizes from the `layoutSizes` constant for spacing and sizing.
 * If no `heading` or `content` is provided, default values are used.
 *
 * @param props.heading - The heading text to display at the top of the panel.
 * @param props.content - The main content or description to display below the heading.
 * @returns A React functional component rendering the main info view.
 */
import { layoutSizes } from "../const_store";
import { Info, SquareChevronDown, CircleX, MessageSquareShare } from "lucide-react"
import { Button } from "@/components/ui/button";
import { useEffect, useState} from "react";
import { Link } from "@/i18n/routing";
import { OpenInBrowser} from "iconoir-react";
import { InfoIcon } from "lucide-react"
import { useLocale ,useTranslations } from "next-intl";
import { t_richConfig} from "../const_store";



import MdxLayout from '@/mdx-layout';

import { ReactNode } from "react";

export const ViewMainInfoComponent: React.FC<{heading?: ReactNode, content?: ReactNode, mdxContent?: React.FC}> = ({ heading, content, mdxContent }) => {
  if (!heading) heading = <>Test Heading</>;
  if (!content) content = <>This is a test description of something important. It can be a long text that describes the content of this view.</>;
  const [isSpacerVisible, setIsSpacerVisible] = useState(false);
  const [isClosed, setIsClosed] = useState(false);

  const t = useTranslations("component_mainInfo");

useEffect(() => {
  const mapElem = document.getElementById('map1-scroll-anchor');
  if (mapElem && isSpacerVisible) {
    const y = mapElem.getBoundingClientRect().top + window.scrollY - layoutSizes.topNavbarHeight + 5;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }
    const handleScroll = () => {
      if (!isClosed) {
        window.requestAnimationFrame(() => {
          setTimeout(() => {
          }, 10);
          // Show content only when scrolled to the very top
          if (window.scrollY > layoutSizes.topNavbarHeight) {
            setIsSpacerVisible(true);
          } else {
            setIsSpacerVisible(false);
          }
        });
      }
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
}, [isSpacerVisible]);

if (isClosed) {
    return null; // Do not render anything if closed
  }


  return (
    <>
      <div className={`w-full  transition-all duration-500 ${!isSpacerVisible ? 'opacity-100 visible' : 'opacity-0 invisible'}`} 
      style={{  marginBottom: `${layoutSizes.gapSize/2}px`,
               paddingRight: `${layoutSizes.gapSize}px`,
             paddingLeft: `${layoutSizes.gapSize}px`,

               }}>
        <div
          className="relative p-2  bg-linear-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200 overflow-auto"
          style={{
            maxHeight: `${layoutSizes.rowSpanSize * 3.5}vh`,
            minHeight: `${layoutSizes.rowSpanSize * 2}vh`,
          }}
        >
          {/* Close button in top right */}
          <Button
            className="absolute top-2 right-2 shrink-0 p-2 rounded-3xl bg-gray-100 text-sm hover:bg-red-200 transition-colors duration-200"
            aria-label="Close"
            onClick={() => setIsClosed(true)}
          >
            <CircleX className="w-5 h-5 text-gray-500" />
          </Button>
          <div className="flex items-start gap-3">
            <div className="shrink-0 p-2 bg-gray-200 rounded-lg">
              <Info className="w-4 h-4 text-gray-600" />
            </div>
            <div className="flex-1 space-y-1">
               <h3 className="mt-1 font-semibold text-gray-600 text-base">{heading}</h3>
              <div className={` gap-10 pb-2`} style={{ columns: '500px', columnGap: '2rem' }}>
              <div>
                {mdxContent ? (
                  <MdxLayout>{(() => { const MdxComp = mdxContent; return <MdxComp />; })()}</MdxLayout>
                ) : (
                  content
                )}
              </div>
              </div>
               <div className="w-full border-t-2 text-sm text-gray-400 my-2 " >
                  <div className="">
                   {t("additionalInfo")}: <InfoIcon className="w-4 h-4 text-gray-600 inline" /> {t("componentInfo")}, <OpenInBrowser className="w-4 h-4 text-gray-600 inline" /> {t("interactions")}.
                  </div>
                  </div>
              {/* Scroll to view button */}
              <span>
              <Button
                variant="outline"
                className="shrink-0 p-2 bg-gray-100 text-sm rounded-lg hover:bg-gray-300 transition-colors duration-200"
                onClick={() => {
                  setIsSpacerVisible(true);
                  const mapElem = document.getElementById('map1-scroll-anchor');
                  if (mapElem) {
                    const y = mapElem.getBoundingClientRect().top + window.scrollY - layoutSizes.topNavbarHeight + 5;
                    window.scrollTo({ top: y, behavior: 'smooth' });
                  }
                }}
              >
                <SquareChevronDown className="w-4 h-4 text-gray-600 mr-1" /> {t.rich("button_scroll")}
              </Button>
              <Button
                asChild
                 variant="outline"
                className="ml-2 shrink-0 p-2 rounded-lg bg-yellow-400 text-gray-800 text-sm hover:bg-yellow-500 transition-colors duration-200"
              >
                <Link href="/about">
                  <MessageSquareShare className="w-4 h-4 text-gray-600 mr-1" /> {t.rich("button_giveFeedback")}
                </Link>
              </Button>
              </span>
            </div>
          </div>
        </div>
     
      </div>
      
         <div id="map1-scroll-anchor" />
            <div style={{height: `${layoutSizes.gapSize/2}px`}}></div>
      {/* Anchor for scrolling */}
    </>
  );
};