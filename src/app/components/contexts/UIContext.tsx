
import { layoutSizes, LayoutSizesT } from '@/app/const_store';
import { createContext, useContext, use, useState, useRef } from 'react'
import React from 'react';
import { transmissionData,TransmissionDataT } from "../../../../messages/sidebarContent"
import { useLocale, useTranslations } from "next-intl"
import { MDXContentProvider } from '../../../../messages/markdown/MDXContentProvider';


const UIContext = createContext({} as UIContextI);


export interface UIContextI {
    sidebarSelection: SidebarSelectionI;
    setSidebarSelection: React.Dispatch<React.SetStateAction<SidebarSelectionI>>;
    layoutDims: LayoutSizesT;
    setLayoutDims: React.Dispatch<React.SetStateAction<LayoutSizesT>>;
    isSidebarOpen: boolean;
    setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
    curDocsMDXContent: React.ReactNode;
    setCurMDXContent: React.Dispatch<React.SetStateAction<React.ReactNode>>;
    isSwapy: boolean;
    setIsSwapy: React.Dispatch<React.SetStateAction<boolean>>;
    curDocsNameRef: React.MutableRefObject<string>;
    updateHash: React.MutableRefObject<number>;
}

export interface SidebarSelectionI {
   transmissionPath: string;
   disease: string;
   group: string | undefined;
}

function UIContextProvider({children}: any) {

    const locale = useLocale();
    const MDXContent = MDXContentProvider[locale as string].FullDocu.fullDocu;

    const [sidebarSelection, setSidebarSelection] = useState<SidebarSelectionI>({
        transmissionPath: '',
        disease: '',
        group: undefined
    })
    const [layoutDims, setLayoutDims] = useState<LayoutSizesT>(layoutSizes)
    const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
    const [curDocsMDXContent, setCurMDXContent] = useState<React.ReactNode>(<MDXContent />);
    const [isSwapy, setIsSwapy] = useState<boolean>(false)
    const curDocsNameRef = useRef<string>(' General ');
    const updateHash = useRef(0);

   const contextValue = {
       sidebarSelection, setSidebarSelection,
       layoutDims, setLayoutDims,
       isSidebarOpen, setIsSidebarOpen,
       curDocsMDXContent, setCurMDXContent,
       curDocsNameRef,
       updateHash,
       isSwapy, setIsSwapy
   }

    return (
        <>
         <UIContext.Provider value={{
            sidebarSelection, setSidebarSelection,
            layoutDims, setLayoutDims,
            isSidebarOpen, setIsSidebarOpen,
            curDocsMDXContent, setCurMDXContent,
            isSwapy, setIsSwapy,
            curDocsNameRef,
            updateHash
           }}>
            {children}
         </UIContext.Provider>
         </>
    )
}

function useUIContext() {
    return useContext(UIContext);
}

export { UIContextProvider, useUIContext};