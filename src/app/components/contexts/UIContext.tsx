
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
    isDemoModeDialogOpen: boolean;
    setIsDemoModeDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
    demoMode: boolean;
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
    const [isDemoModeDialogOpen, setIsDemoModeDialogOpen] = useState<boolean>(false);
    const [demoMode, setDemoMode] = useState<boolean>(false);

    // Fetch demo mode on mount
    React.useEffect(() => {
        fetch('/api/demo-mode')
            .then(res => res.json())
            .then(data => setDemoMode(data.demoMode))
            .catch(err => console.error('Failed to fetch demo mode:', err));
    }, []);

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
            updateHash,
            isDemoModeDialogOpen, setIsDemoModeDialogOpen,
            demoMode
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