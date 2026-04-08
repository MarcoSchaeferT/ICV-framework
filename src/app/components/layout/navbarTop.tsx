
"use client";;
import * as React from "react";
import Image from "next/image";
import { Menu } from "lucide-react"
//import Link from "next/link"
import {Link} from '@/i18n/routing';
import { Button } from "@/components/ui/button"
import {LINKS, LINK} from '../../../../messages/navbarContent'
import { useEffect, useState, type JSX } from "react";
import LocalizationSwitcher from "./localizationSwitcher/localizationSwitcher";
import { useUIContext } from "../contexts/UIContext";
import {Group} from '../../../../messages/navbarContent'
import { layoutSizes, t_richConfig } from "@/app/const_store";
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from "next/navigation";


function LinkDirectOpen({ link }: { link: string }) {
  const router = useRouter();
  const locale = useLocale();
  const target = `/${locale}/${link}`;
  const handleClick = () => {
    console.log("Navigating to:", target);
    router.push(target);
  };

  React.useEffect(() => {
    if(locale == undefined) return;
    setTimeout(() => {
      handleClick();
    }, 100);
  }, [locale, target]);


 
}
interface nav {
    navLinks: LINK[];
    isOpen: boolean;
}

export function NavList(props: nav): JSX.Element {

  const UI_contextT = useUIContext();
  let selectedGroup = UI_contextT.sidebarSelection.group;
  if (selectedGroup === undefined || selectedGroup === "")  selectedGroup = Group.all;
  const filterednavLinks = props.navLinks.filter(link => !link.group || link.group === selectedGroup || link.group === Group.all);

  
  return (
    <ul className="flex flex-col lg:flex-row lg:items-center gap-y-1.5 lg:gap-y-0">
      {filterednavLinks.map(({ icon: Icon, title, href, group }, idx) =>
       (
           <React.Fragment key={title}>
          <li className="flex items-center">
            <Link
              href={href}
              className="flex items-center gap-x-1 px-3 py-1 hover:text-amber-500 text-sm"
              onClick={() => { UI_contextT.curDocsNameRef.current = title; }}
            >
              {Icon !== null && (
                title === "ICV-Docs"
                  ? <Icon className="h-4 w-4 outline outline-offset-2 outline-orange-600" />
                  : title === "shdcn/ui-Docs"
                    ? <Icon className="h-4 w-4 outline outline-offset-2 outline-purple-600" />
                    : <Icon className="h-6 w-6" />
              )}
              {title}
            </Link>

          </li>
          {idx < props.navLinks.length - 1 && (
            <li className="hidden lg:flex h-6 items-center">
              <span className="border-l border rounded-2xl border-white/50 h-6 mx-0"></span>
            </li>
          )}
        </React.Fragment>
       
      ))}
    </ul>
  );
}

export default function NavbarTop(props: nav): JSX.Element  {

  const UI_contextT = useUIContext();
  const t = useTranslations("navbar_top");
  const [isOpen, setIsOpen] = useState(false);
   const oldDiesease = React.useRef("");

  let selectedGroup = UI_contextT.sidebarSelection.group;
  if (selectedGroup === undefined || selectedGroup === "")  selectedGroup = Group.all;
  const filterednavLinks = props.navLinks.filter(link => !link.group || link.group === selectedGroup || link.group === Group.all);

  const RedirectHandler = () => {
  const router = useRouter();
  const locale = useLocale();
   

    useEffect(() => {

      if (oldDiesease.current === "" ) {
        oldDiesease.current = UI_contextT.sidebarSelection.disease;
        return;
      }
      if(UI_contextT.sidebarSelection.disease == "" ){
        oldDiesease.current = UI_contextT.sidebarSelection.disease;
        return;
      }
      if (oldDiesease.current === UI_contextT.sidebarSelection.disease)return;

      oldDiesease.current = UI_contextT.sidebarSelection.disease;
      
      const target = `/${locale}/${filterednavLinks[0].href}`;
      router.push(target);
    }, [filterednavLinks, UI_contextT.sidebarSelection]);
    return null;
};


  // AI powered  Views for Pandemics
  return (
    <>
     <RedirectHandler />
    <div className="sticky top-0 z-1100 float-none ">
      <nav id="navbarTop" className={`max-w-fit mx-auto min-h-[45px] bg-secondary-dark text-secondary-light transition-all duration-300 rounded-lg`}>

      <div className="flex lg:items-center items-start px-4 py-2">
<span className="mr-2 hidden items-center lg:flex text-xl hover:text-amber-500">
  <div className="flex items-center group max-lg:hidden">
    <Link
      className="group-hover"
      href="/"
      tabIndex={-1}
    >
      <Image
        src="/icon.svg"
        alt="Icon"
        width={20}
        height={25}
        className="transition-transform  group-hover:scale-110"
      />
    </Link>
    <Link
      href="/"
      className="ml-2 mr-2 block py-1 font-semibold hover:text-amber-500  text-[#279BBA]"
    >
      <span className="group-hover:text-amber-500">ICV</span>
    </Link>
  </div>
</span>
      <Button className="max-h-10 transition-all duration-350 lg:hidden " onClick={() => setIsOpen((cur) => !cur)}>
        <Menu></Menu>
      </Button>

      <hr className="ml-1 mr-1.5 hidden h-5 w-px border-l border-t-0 border-secondary-dark lg:block" />
      <div className={`lg:block items-center transition-all duration-350`}>
        <div className={`transition-all ${isOpen ? 'duration-350' : 'max-lg:duration-0'} ${isOpen ? ' h-fit opacity-100' : 'max-h-0 opacity-0 overflow-hidden'} lg:max-h-60 lg:opacity-100`}>
          <NavList {...props} />
        </div>
        <div id="appendTop"></div>
      </div>
      <LocalizationSwitcher />
      </div>
    <div className="fixed left-0 bottom-0 z-1000 bg-secondary-dark/70  px-1 py-0 shadow-lg" style={{ paddingLeft: (layoutSizes.leftNavbarWidth + layoutSizes.leftSidebarWidth) }}>
      {UI_contextT.sidebarSelection && UI_contextT.sidebarSelection.transmissionPath && (
        <div className="flex items-center">
          <span className="text-sm font-medium text-sidebar-foreground"></span>
          <span className="ml-2 text-xs text-sidebar-foreground">
            {t.rich("mode", t_richConfig)}: {UI_contextT.sidebarSelection.transmissionPath} {"-->"} {UI_contextT.sidebarSelection.disease}
          </span>
        </div>
      )}
    </div>
    </nav>
    </div>
    </>
      );
}