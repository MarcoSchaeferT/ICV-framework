"use client";
import { Hand } from 'lucide-react';
import { useUIContext } from '../contexts/UIContext';
import { useTranslations } from 'next-intl';


export default function Checkbox_isSwapy() {
  let c = useUIContext();
  const t = useTranslations('swapyHandle_component');
  return(
    <>
      <label className="fixed bottom-4 left-[4px] z-1000 bg-gray-600 rounded-full p-1 text-white group ">
        
        <Hand
          color={c.isSwapy ? "#1ebd43" : "#d7d7d7"}
          onClick={() => {
            c.setIsSwapy(!c.isSwapy);
          }}
        />
        <span className="absolute bottom-full mb-2 hidden w-max rounded bg-black p-2 text-xs text-white group-hover:block">
          {c.isSwapy ? t('disable') : t('enable')}
        </span>
      </label>
    </>);
}
