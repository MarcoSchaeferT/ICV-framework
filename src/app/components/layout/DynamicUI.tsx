
"use client"
import NavbarTop from "./navbarTop";
import {Nav_LINKS_LEFT, Nav_LINKS_TOP } from "./navbarContentGetter";
import {DiseaseSidebar} from "./sidebarLeft";
import { UIContextProvider, useUIContext } from "../contexts/UIContext";
import { LayoutSizesT } from '../../const_store';
import { useEffect } from "react";
import NavbarLeft from "./navbarLeft";
import FpsIndicator from "./fpsIndicator";

interface DynamicUIProps {
  children: React.ReactNode;
  layoutSizes: LayoutSizesT;
}

export default function DynamicUI({children, layoutSizes}: DynamicUIProps) {
  const isLeftNavbar = false;
  const isPerformanceIndicator = false;

  if(!isLeftNavbar) layoutSizes.leftNavbarWidth = 0;
  if(isLeftNavbar) layoutSizes.leftSidebarWidth  = 20;

  return(
    <>
    <UIContextProvider>
      <UpdateLayoutSizes newSizes={layoutSizes} />
    <div className="flex h-screen" style={{ paddingLeft: layoutSizes.leftNavbarWidth }}>
      {<DiseaseSidebar/>}
      <div className="flex-1 ">
        <NavbarTop navLinks={Nav_LINKS_TOP()} isOpen={true} />
        {isLeftNavbar && (<NavbarLeft navLinks={Nav_LINKS_LEFT()} isOpen={false}/> )}
        {children}
      </div>
    </div>
    {isPerformanceIndicator && <FpsIndicator />}
    </UIContextProvider>
    </>
  )

}



  function UpdateLayoutSizes({newSizes}: {newSizes: LayoutSizesT}) {
    const UI_contextT = useUIContext();

    useEffect(() => {
      if (UI_contextT && typeof UI_contextT.setLayoutDims === 'function') {
        UI_contextT.setLayoutDims(newSizes);
      }
    }, [newSizes, UI_contextT]);

    return null;
  }