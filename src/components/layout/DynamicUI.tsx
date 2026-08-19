
"use client"
import NavbarTop from "./NavbarTop";
import {Nav_LINKS_LEFT, Nav_LINKS_TOP } from "./NavbarContentGetter";
import {DiseaseSidebar} from "./SidebarLeft";
import { UIContextProvider, useUIContext } from "../contexts/UIContext";
import { LayoutSizesT } from '@/app/const_store';
import { useEffect } from "react";
import NavbarLeft from "./NavbarLeft";
import FpsIndicator from "./FpsIndicator";
import DemoModeDialog from "./DemoModeDialog";
import DisclaimerDialog from "./DisclaimerDialog";

/**
 * Props for the application-wide navigation and dialog shell.
 *
 * @example
 * ```tsx
 * const props: DynamicUIProps = {
 *   children: <main>Public-health dashboard</main>,
 *   layoutSizes: {
 *     rowSpanSize: 8.5,
 *     gapSize: 20,
 *     leftSidebarWidth: 40,
 *     leftNavbarWidth: 0,
 *     topNavbarHeight: 64,
 *   },
 * };
 * ```
 */
interface DynamicUIProps {
  /** Localized application route content. */
  children: React.ReactNode;
  /** Initial layout measurements propagated through `UIContext`. */
  layoutSizes: LayoutSizesT;
}

/**
 * Composes the persistent navigation, sidebar, dialogs, and page content.
 *
 * @param props - Localized route content and initial layout measurements.
 * @returns The complete UI shell wrapped in `UIContextProvider`.
 *
 * @remarks
 * This boundary owns shell state only. Linked visualization state must remain below `InterfaceContextProvider` in the
 * dashboard that coordinates the affected widgets.
 */
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
    <DemoModeDialog />
    <DisclaimerDialog />
    </UIContextProvider>
    </>
  )

}



  /**
   * Synchronizes layout measurements from the server layout into the client UI context.
   *
   * @param props - New shared dashboard dimensions.
   * @returns No visible output.
   */
  function UpdateLayoutSizes({newSizes}: {newSizes: LayoutSizesT}) {
    const UI_contextT = useUIContext();

    useEffect(() => {
      if (UI_contextT && typeof UI_contextT.setLayoutDims === 'function') {
        UI_contextT.setLayoutDims(newSizes);
      }
    }, [newSizes, UI_contextT]);

    return null;
  }
