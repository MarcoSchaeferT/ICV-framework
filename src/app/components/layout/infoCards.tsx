
import { InfoIcon, } from "lucide-react"
import { OpenInBrowser,GoogleDocs} from "iconoir-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import MdxLayout, {MdxLayoutTooltip} from "../../../mdx-layout";
import { MDXContentProvider } from "../../../../messages/markdown/MDXContentProvider";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";



export const HoverCardComponentInfo: React.FC<{ MDXContent?: React.FC; Footer?: React.FC, color?: string }> = ({
  MDXContent = "",
  Footer = "",
  color = "white",
}) => {

  const locale = useLocale();
  const MDXContext = MDXContentProvider[locale];
  if (!MDXContent) MDXContent = MDXContext.DummyContent;
  if (!Footer) Footer = MDXContext.FooterContent;
  
  const t = useTranslations("component_infoCard");
  return (
    <div>
    <HoverCard openDelay={50} closeDelay={400}>
      <HoverCardTrigger asChild defaultChecked={true}>
        <InfoIcon className={`h-5 w-5 cursor-pointer text-${color} transition-colors duration-200 hover:text-blue-500 hover:scale-110`} />
      </HoverCardTrigger>
      <HoverCardContent className="max-w-[30vw] min-w-[400px] max-h-[80vh] overflow-y-auto z-1000 rounded-lg shadow-lg bg-white border-4 border-gray-200 p-4">
       
       <div className="flex items-start gap-3 pb-5">
        <div className="flex items-center gap-3 w-full">
          <div className="shrink-0 mt-1 bg-blue-200 rounded-full p-3 shadow">
            <InfoIcon className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1 flex items-center justify-between pb-2 pt-4">
            <div className="text-md text-blue-600 pb-0">{t.rich("headingComponentInfo")}</div>
            <Button
              asChild
              variant="outline"
              className="px-4 py-1  pb-1 rounded-lg shadow hover:bg-blue-50 hover:text-blue-600 transition-colors duration-200 flex items-center gap-2 mb-0"
            >
              <Link href={`/docs`} target="" rel="noopener noreferrer">
                <GoogleDocs className="h-4 w-4  text-blue-600" />
                <span className="font-medium">{t.rich("openFullDocs")}</span>
              </Link>
            </Button>
          </div>
        </div>
          </div>
     
        <div className=" ml-6 mr-6">
         <MdxLayout >
                <MDXContent />
              </MdxLayout>
              </div>
          <div className="flex items-center justify-between mt-10 border-t border-slate-200 dark:border-slate-700">
            <div className="text-xs text-gray-400 px-2 pt-2  rounded">
              <Footer />
            </div>
          </div>
      </HoverCardContent>
    </HoverCard>
    </div>
  );
};

export const HoverCardInteractionInfo: React.FC<{ MDXContent?: React.FC; Footer?: React.FC; }> = ({
  MDXContent = "",
  Footer = "",
}) => {
    const t = useTranslations("component_infoCard");

  const locale = useLocale();
  const MDXContext = MDXContentProvider[locale];
  if (!MDXContent) MDXContent = MDXContext.DummyContent;
  if (!Footer) Footer = MDXContext.FooterContent;

  return (
    <>
    <HoverCard openDelay={50} closeDelay={400}>
      <HoverCardTrigger asChild>
        <OpenInBrowser className="h-5 w-5 cursor-pointer text-white transition-colors duration-200 hover:text-amber-500 hover:scale-110" />
      </HoverCardTrigger>
      <HoverCardContent className=" max-w-[30vw] min-w-[400px] max-h-[80vh] overflow-y-auto z-1000 rounded-lg shadow-lg bg-white border-4 border-gray-200 p-4">
         
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-[12px] bg-amber-200 rounded-full p-3 shadow">
            <OpenInBrowser className="h-4 w-4 text-amber-700" />
          </div>
        <div className="flex-1 flex items-center justify-between pb-2 pt-4">
            <div className="text-md text-amber-700 pb-4">{t.rich("headingInteractions")}</div>
            <Button
          asChild
          variant="outline"
          className="px-4 py-2 rounded-lg shadow hover:bg-amber-50 hover:text-amber-700 transition-colors duration-200 flex items-center gap-2 mb-4"
        >
          <Link href={`/docs#MapInteractions`}  target="" rel="noopener noreferrer">
            <GoogleDocs className="h-4 w-4 text-amber-700" />
            <span className="font-medium">{t.rich("openFullDocs")}</span>
          </Link>
        </Button>
          </div>
        </div>
        <div className=" ml-6 mr-6">
         <MdxLayout >
                <MDXContent />
              </MdxLayout>
              </div>
          <div className="flex items-center justify-between mt-10 border-t border-slate-200 dark:border-slate-700">
            <div className="text-xs text-gray-400 px-2 pt-2  rounded">
              <Footer />
            </div>
          </div>
      </HoverCardContent>
    </HoverCard>
    </>
  )
};


export const HoverCardTooltip: React.FC<{ MDXContent?: React.FC; color?: string }> = ({
  MDXContent = "",
  color = "#b1b1b1",
}) => {
  const locale = useLocale();
  const MDXContext = MDXContentProvider[locale];
  if (!MDXContent) MDXContent = MDXContext.DummyContent;
  
  return (
   
    <HoverCard openDelay={5} closeDelay={5} >
      <HoverCardTrigger asChild>
        <InfoIcon
          className="h-5 w-5 cursor-pointer transition-colors duration-200 hover:text-blue-500 hover:scale-110"
          style={{ color }}
        />
      </HoverCardTrigger>
      <HoverCardContent sideOffset={0} className="max-w-[30vw] min-w-[400px] max-h-[80vh] overflow-y-auto bg-transparent z-1000 border-0 ">
        <MdxLayoutTooltip  >
          <MDXContent />
        </MdxLayoutTooltip>
      </HoverCardContent>
    </HoverCard>

  );
};