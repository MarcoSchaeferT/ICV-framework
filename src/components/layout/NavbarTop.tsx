
"use client";;
import * as React from "react";
import Image from "next/image";
import { ChevronDown, Menu, Home } from "lucide-react";
//import Link from "next/link"
import {Link, useRouter} from '@/i18n/routing';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LINKS, LINK, Group } from '@messages/navbarContent';
import { useEffect, useState, type JSX } from "react";
import LocalizationSwitcher from "./localizationSwitcher/localizationSwitcher";
import { useUIContext } from "../contexts/UIContext";
import { layoutSizes, t_richConfig } from "@/app/const_store";
import { useTranslations } from 'next-intl';


/**
 * Localized navigation links and initial expanded-state hint.
 *
 * @example
 * ```ts
 * const dengueNav: nav = {
 *   navLinks: [{ icon: null, title: "Dengue Vis. Interface", href: "/worldView", group: "dengue" }],
 *   isOpen: true,
 * };
 * ```
 */
interface nav {
    /** Entries available to the top navigation. */
    navLinks: LINK[];
    /** Initial expanded-state hint. */
    isOpen: boolean;
    /** Optional callback used when the navigation closes. */
    onClose?: () => void;
}

/**
 * Filters and renders top-navigation links for the currently selected disease group.
 *
 * @param props - Localized navigation links, layout state, and optional close callback.
 * @returns A responsive list of locale-aware route links.
 */
export function NavList(props: nav): JSX.Element {

  const UI_contextT = useUIContext();
  const t = useTranslations("navbar_top");
  let selectedGroup = UI_contextT.sidebarSelection.group;
  if (selectedGroup === undefined || selectedGroup === "")  selectedGroup = Group.all;
  const filterednavLinks = props.navLinks.filter(link => !link.group || link.group === selectedGroup || link.group === Group.all);

  return (
    <ul className="flex flex-col lg:flex-row lg:items-center gap-y-1.5 lg:gap-y-0">
      {/* Mobile-only Home Link at top of collapsed menu */}
      <li className="flex items-center lg:hidden">
        <Link
          href="/"
          className="flex items-center gap-x-2 px-3 py-1.5 hover:text-amber-500 text-sm font-semibold text-[#279BBA] rounded-md transition-colors w-full"
          onClick={() => {
            UI_contextT.setCurDocsName("Home");
            props.onClose?.();
          }}
        >
          <Home className="h-5 w-5" />
          <span>{t("home")}</span>
        </Link>
      </li>
      {/* Mobile-only divider */}
      <li className="flex lg:hidden h-px w-full bg-white/20 my-1" />

      {filterednavLinks.map(({ icon: Icon, title, href, menu }, idx) =>
       (
           <React.Fragment key={title}>
          <li className="flex items-center">
            {menu === "help" ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center gap-x-1 rounded-md px-3 py-1 text-sm hover:text-amber-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                  >
                    {Icon && <Icon className="h-6 w-6" aria-hidden="true" />}
                    {title}
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[1500] min-w-60">
                  <DropdownMenuItem asChild>
                    <Link
                      href={href}
                      onClick={() => {
                        UI_contextT.setCurDocsName(title);
                        props.onClose?.();
                      }}
                    >
                      {t("helpMenu.quickHelp")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/docs/user-guide" locale="en" onClick={props.onClose}>
                      {t("helpMenu.userGuide")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/docs/developer-guide" locale="en" onClick={props.onClose}>
                      {t("helpMenu.developerGuide")}
                    </Link>
                  </DropdownMenuItem>
                  {process.env.NODE_ENV === "development" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/apiDocs" onClick={props.onClose}>
                          {t("helpMenu.swaggerUi")}
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                href={href}
                className="flex items-center gap-x-1 px-3 py-1 hover:text-amber-500 text-sm"
                onClick={() => {
                  UI_contextT.setCurDocsName(title);
                  props.onClose?.();
                }}
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
            )}

          </li>
          {idx < filterednavLinks.length - 1 && (
            <li className="hidden lg:flex h-6 items-center">
              <span className="border-l border rounded-2xl border-white/50 h-6 mx-0"></span>
            </li>
          )}
        </React.Fragment>
       
      ))}
    </ul>
  );
}

/**
 * Renders the primary localized navigation and redirects when the active disease family changes.
 *
 * @param props - Localized navigation links and initial open-state hint.
 * @returns The sticky application top bar.
 */
export default function NavbarTop(props: nav): JSX.Element  {

  const UI_contextT = useUIContext();
  const t = useTranslations("navbar_top");
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
   const oldDiesease = React.useRef("");

  let selectedGroup = UI_contextT.sidebarSelection.group;
  if (selectedGroup === undefined || selectedGroup === "")  selectedGroup = Group.all;
  const filterednavLinks = props.navLinks.filter(link => !link.group || link.group === selectedGroup || link.group === Group.all);
  const disease = UI_contextT.sidebarSelection.disease;
  const redirectHref = filterednavLinks[0]?.href;

  useEffect(() => {
    if (oldDiesease.current === "" || disease === "") {
      oldDiesease.current = disease;
      return;
    }
    if (oldDiesease.current === disease) return;

    oldDiesease.current = disease;
    if (redirectHref) router.push(redirectHref);
  }, [disease, redirectHref, router]);


  // AI powered  Views for Pandemics
  return (
    <>
    <div id="app-topbar" className="sticky top-0 z-1100 float-none ">
      <nav id="navbarTop" className={`max-w-fit mx-auto min-h-[45px] bg-secondary-dark text-secondary-light transition-all duration-300 rounded-lg`}>

      <div className="flex lg:items-center items-start px-4 py-2 flex-wrap lg:flex-nowrap gap-y-2">
        {/* Brand / Home Link - visible on all screen sizes */}
        <div className="mr-2 flex items-center group text-xl hover:text-amber-500">
          <Link
            className="flex items-center"
            href="/"
            tabIndex={-1}
            onClick={() => setIsOpen(false)}
          >
            <Image
              src="/icon.svg"
              alt="Icon"
              width={20}
              height={25}
              className="transition-transform group-hover:scale-110"
            />
          </Link>
          <Link
            href="/"
            className="ml-2 mr-2 block py-1 font-semibold hover:text-amber-500 text-[#279BBA]"
            onClick={() => setIsOpen(false)}
          >
            <span className="group-hover:text-amber-500">ICV</span>
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="max-h-10 transition-all duration-350 lg:hidden p-2 mr-1 hover:bg-white/10"
          onClick={() => setIsOpen((cur) => !cur)}
          aria-label="Toggle navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <hr className="ml-1 mr-1.5 hidden h-5 w-px border-l border-t-0 border-secondary-dark lg:block" />
        
        {/* Nav links container */}
        <div className="w-full lg:w-auto lg:block items-center transition-all duration-350">
          <div className={`transition-all ${isOpen ? 'duration-350 max-h-96 opacity-100 mt-2 lg:mt-0' : 'max-lg:duration-0 max-h-0 opacity-0 overflow-hidden'} lg:max-h-60 lg:opacity-100`}>
            <NavList {...props} onClose={() => setIsOpen(false)} />
          </div>
          <div id="appendTop"></div>
        </div>

        {/* Localization switcher */}
        <div className="ml-auto lg:ml-0 flex items-center">
          <LocalizationSwitcher />
        </div>
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
