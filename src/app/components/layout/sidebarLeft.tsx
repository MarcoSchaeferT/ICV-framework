"use client"

import { use, useEffect, useState } from "react"
import { X, ArrowDown, Bookmark} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useUIContext, SidebarSelectionI } from "../contexts/UIContext";
import { transmissionData,TransmissionDataT } from "../../../../messages/sidebarContent"
import { useLocale, useTranslations } from "next-intl"
import { t_richConfig } from "../../const_store";
import {Link} from '@/i18n/routing';
import Image from "next/image";
import Checkbox_isSwapy from './isSwapyHandle'
interface DiseaseSidebarProps {
  isOpen?: boolean
  onToggle?: () => void
  className?: string
}

export function DiseaseSidebar({ className }: DiseaseSidebarProps) {

  const locale = useLocale();
  const t = useTranslations("sidebarLeft")
  const UI_contextT = useUIContext();
  const layoutSizes = UI_contextT.layoutDims;
  const sideBarWidthOpen = "20rem"; // in px, corresponds to layoutSizes.leftSidebarWidth
  const sideBarWidthClosed = layoutSizes.leftSidebarWidth + layoutSizes.leftNavbarWidth; // in px, corresponds to layoutSizes.leftSidebarWidth

  const defaultTransmissionKey = "vector"
  let transmissionDataLocal: TransmissionDataT = transmissionData[locale]
  const defaultDisease = transmissionDataLocal[defaultTransmissionKey].diseases.find(d => d.enabled)?.name || "";
  const defaultTransmission = transmissionDataLocal[defaultTransmissionKey].transmissionPath;

  const [selectedTransmission, setSelectedTransmission] = useState<string>(defaultTransmissionKey)
  const [selectedDisease, setSelectedDisease] = useState<string>(defaultDisease)

  const [isOpen, setSidebarOpen] = useState(false)
   const toggleSidebar = () => {
    UI_contextT.setIsSidebarOpen(!isOpen)
    setSidebarOpen(!isOpen)
  }

  const handleTransmissionChange = (value: string) => {
    setSelectedTransmission(value)
    setSelectedDisease("") // Reset disease selection when transmission changes
    let sel = UI_contextT.sidebarSelection;
    sel.disease = "";
    sel.transmissionPath = value;
    UI_contextT.setSidebarSelection(sel);
  }

  useEffect(() => {
    if (UI_contextT.sidebarSelection.transmissionPath == "") {
      let selection: SidebarSelectionI = new Object() as SidebarSelectionI;
      selection.disease = selectedDisease;
      selection.transmissionPath =transmissionDataLocal[selectedTransmission].transmissionPath;
      const diseaseItem = transmissionDataLocal[selectedTransmission].diseases.find(disease => disease.name === selectedDisease);
      selection.group = diseaseItem?.group;

      //selection.transmissionPath = "";
      UI_contextT.setSidebarSelection(selection);
      console.log("Initial selection set in sidebar:", selection);
    }
  }, [selectedDisease])

  useEffect(() => {
    
  
    if(isOpen != UI_contextT.isSidebarOpen) setSidebarOpen(UI_contextT.isSidebarOpen);
    if(selectedDisease != UI_contextT.sidebarSelection.disease) {
      setSelectedDisease(UI_contextT.sidebarSelection.disease);
      console.log("Disease updated from context:", UI_contextT.sidebarSelection.disease);
    }
   
  }, [selectedTransmission, UI_contextT.sidebarSelection, UI_contextT.isSidebarOpen]);
  

  return (
    <>
      <div
   className={cn(" transition-all duration-300 ease-in-out")}
  style={{
    position: "sticky",
      width: isOpen ? sideBarWidthOpen : `${layoutSizes.leftSidebarWidth}px`, // 20rem = w-80, 2.5rem = w-10
    top: 0,
    height: "100vh", // Fills the screen height
  }}></div>
    <div
   className={cn("pr-0 transition-all duration-300 ease-in-out", isOpen ? "ml-0" : "mr-10")}
  style={{
    position: "fixed",
    top: 0,
    height: "100vh", // Fills the screen height
    zIndex: 1200
  }}>
    
      {!isOpen && toggleSidebar && (
        <Button
        variant="outline"
        size="sm"
        onClick={toggleSidebar}
        className="fixed top-4 z-1200 h-6 w-12 rounded-r-xl shadow-md bg-[#279BBA] border-sidebar-border "
        style={{ left: layoutSizes.leftSidebarWidth + layoutSizes.leftNavbarWidth - 15 }}
        >
        <Bookmark className="h-4 w-4 pl-0 hover:animate-pulse " />
        </Button>
      )}
      

      <div
      className={cn(
        "h-full bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out",
        className,
      )}
      style={{
        width: isOpen ? sideBarWidthOpen : `${layoutSizes.leftSidebarWidth}px`, // 20rem = w-80, 2.5rem = w-10
      }}
      >
      <div
        className={cn(
        "h-full flex flex-col w-full transition-all",
        isOpen
          ? "opacity-100 translate-x-0 ease-in duration-50 delay-250"
          : "opacity-0 translate-x-0 pointer-events-none duration-0 delay-0"
        )}
        style={{ position: "relative", top: 0, height: "100vh", overflowY: "auto" }}
      >
        {/* Header with toggle button */}
        <div className="flex items-center justify-between p-4 border-b border-gray-600">
       
        <Link href="/" className=" block pl-2 py-1 font-semibold max-lg:hidden hover:text-primary">
          <Image
              src="/icon.svg"
              alt="Icon"
              width={25}
              height={30}
              className="transition-transform duration-300 hover:scale-110 "
            />
          </Link>
          <Link href="/" className=" text-white text-xl block max-lg:hidden "> {t.rich("heading", t_richConfig) }</Link>
     
        {isOpen && toggleSidebar && (
          <Button
        variant="ghost"
        size="sm"
        onClick={toggleSidebar}
        className="text-sidebar-foreground hover:bg-sidebar-accent bg-gray-700/40 rounded-full p-2"
          >
        <X className="h-4 w-4" />
          </Button>
        )}
        </div>

        {/* Content */}
        <div className="flex-1 p-6 space-y-6">
       
        {/* Transmission Path Dropdown */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-sidebar-foreground">{t.rich("transmissionPath", t_richConfig)}</label>
          <Select value={selectedTransmission} onValueChange={handleTransmissionChange}>
        <SelectTrigger className="w-full bg-sidebar-accent border-sidebar-border text-sidebar-accent-foreground">
        <SelectValue placeholder={t.rich("dropdown.transmissionPath", t_richConfig)} />
        </SelectTrigger>
        <SelectContent className="w-full overflow-hidden z-1300">
        {Object.entries(transmissionDataLocal).map(([key, d]) => (
          <SelectItem key={key} value={key} className="flex items-center">
          <div className="flex items-center gap-2">
        <d.icon className="h-4 w-4" />
        <span className="capitalize">{d.transmissionPath}</span>
          </div>
          </SelectItem>
        ))}
        </SelectContent>
          </Select>
        </div>

        {/* Disease Dropdown - Only show when transmission is selected */}
        {selectedTransmission && (
          <div className="space-y-3">
        <label className="text-sm font-medium text-sidebar-foreground">{t.rich("disease", t_richConfig)}</label>
        <Select value={selectedDisease} onValueChange={
          (value) => {
            setSelectedDisease(value);
            let selection: SidebarSelectionI = new Object() as SidebarSelectionI;
             selection.disease = "---";
            UI_contextT.setSidebarSelection({ transmissionPath: transmissionDataLocal[selectedTransmission].transmissionPath, disease: "---" } as SidebarSelectionI);
            selection.disease = value;
            selection.transmissionPath = transmissionDataLocal[selectedTransmission].transmissionPath;
            const diseaseItem = transmissionDataLocal[selectedTransmission].diseases.find(disease => disease.name === value);
            selection.group = diseaseItem?.group;
            setTimeout(() => {
              UI_contextT.setSidebarSelection(selection);
            }, 100);
          }
        }>
        <SelectTrigger className="w-full bg-sidebar-accent border-sidebar-border text-sidebar-accent-foreground">
          <SelectValue placeholder={t.rich("dropdown.disease", t_richConfig)} />
        </SelectTrigger>
        <SelectContent className="w-full overflow-hidden z-1300">
          {transmissionDataLocal[selectedTransmission as keyof typeof transmissionDataLocal]?.diseases.map((disease) => {
            return (
              <SelectItem
                className={`rounded-md mb-1 truncate max-w-68
                  ${disease.enabled ? "bg-sidebar-primary-foreground text-sidebar-primary" : "text-gray-400 "}
                  data-highlighted:bg-sidebar-accent  data-highlighted:text-sidebar-accent-foreground
                `}
                value={disease.name}
                key={disease.name}
                disabled={!disease.enabled}
                title={disease.name} // Show full name on hover
              >
                <span
                  style={{
                    maxWidth: "16rem",
                    display: "inline-block",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    verticalAlign: "middle",
                  }}
                  title={disease.name}
                >
                  {disease.name}
                </span>
              </SelectItem>
            )
          })}
        </SelectContent>
        </Select>
         {/* Selected Information Display */}
        {selectedTransmission && (
          <div className="mt-8 p-4 bg-blue-900 rounded-lg border border-sidebar-border">
        <h3 className="text-sm font-medium text-sidebar-accent-foreground mb-2">{t.rich("currentSelection", t_richConfig)}:</h3>
        <hr className="my-1 pb-2 border-t border-sidebar-accent-foreground" />
        <div className="space-y-2 text-sm text-sidebar-accent-foreground">
        <div className="flex items-center justify-center">
          {(() => {
            const IconComponent = transmissionDataLocal[selectedTransmission].icon;
            return IconComponent ? (
              <IconComponent className="h-4 w-4" />
            ) : null;
          })()}
          <span className="capitalize">{transmissionDataLocal[selectedTransmission].transmissionPath}</span>
        </div>
            {selectedDisease && (
              <div className="flex flex-col items-center justify-center">
                <ArrowDown className="h-4 w-4 mb-1" />
                <div className="text-accent-foreground">{selectedDisease}</div>
              </div>
              )}
          </div>
              </div>
            )}
          </div>
        )}
          </div>
        {/* Bottom Section */}
        
        </div>
      </div>
        <Checkbox_isSwapy />
    </div>
  
</>
  )
}