
"use client";

import { Button } from "@/components/ui/button"
import {Settings } from 'lucide-react'
import { useUIContext } from "../../components/contexts/UIContext";
import { t_richConfig } from "@/app/const_store";
import { useTranslations } from "next-intl";

const SettingButton = () => {
  const t = useTranslations("page_home.pageContent");
  const UI_context = useUIContext();

  return (
  <>
  <span className="ml-2">
    <Button
      size="default"
      className="bg-[#279BBA] hover:scale-102 hover:white hover:bg-[#31bbe1]  text-white text-lg font-medium h-8 w-34 rounded-md m-0 p-0  "
      variant="default"
      onClick={() => {
        UI_context.setIsSidebarOpen(!UI_context.isSidebarOpen);
        let sel = { ...UI_context.sidebarSelection };
        sel.disease = "";
        UI_context.setSidebarSelection(sel);
      }}
    >
      {t.rich('startButton', { ...t_richConfig })} <Settings className="text-white ml-1" size={19} />
    </Button>
   </span>
        </>
  )
}
export default SettingButton;
