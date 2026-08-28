
import { layoutSizes, LayoutSizesT } from '@/app/const_store';
import { createContext, useContext, use, useState, useRef } from 'react'
import React from 'react';
import { transmissionData,TransmissionDataT } from '@messages/sidebarContent'
import { useLocale, useTranslations } from "next-intl"
import { MDXContentProvider } from '@messages/markdown/MDXContentProvider';


const UIContext = createContext({} as UIContextI);


/**
 * Global UI-shell state shared by navigation, documentation, layout, and application dialogs.
 *
 * @remarks
 * Visualization selections belong in `InterfaceContext`; this context is intentionally limited to shell-level state.
 * Keeping the two contexts separate prevents navigation and documentation changes from coupling to high-frequency map
 * interactions.
 *
 * @example
 * ```tsx
 * function DocumentationToolbar() {
 *   const { isSidebarOpen, setIsSidebarOpen, curDocsNameRef } = useUIContext();
 *   return (
 *     <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
 *       {curDocsNameRef.current}
 *     </button>
 *   );
 * }
 * ```
 */
export interface UIContextI {
    /** Current disease and transmission-path selection shown by the sidebar. */
    sidebarSelection: SidebarSelectionI;
    /** Updates the current sidebar selection. */
    setSidebarSelection: React.Dispatch<React.SetStateAction<SidebarSelectionI>>;
    /** Shared dashboard-shell measurements. */
    layoutDims: LayoutSizesT;
    /** Updates dashboard-shell measurements. */
    setLayoutDims: React.Dispatch<React.SetStateAction<LayoutSizesT>>;
    /** Whether the disease sidebar is expanded. */
    isSidebarOpen: boolean;
    /** Opens or closes the disease sidebar. */
    setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
    /** Localized MDX node currently rendered by the documentation page. */
    curDocsMDXContent: React.ReactNode;
    /** Replaces the active localized documentation node. */
    setCurMDXContent: React.Dispatch<React.SetStateAction<React.ReactNode>>;
    /** Whether Swapy drag handles and card rearrangement are enabled. */
    isSwapy: boolean;
    /** Enables or disables card rearrangement. */
    setIsSwapy: React.Dispatch<React.SetStateAction<boolean>>;
    /** Mutable display name for the active documentation section. */
    curDocsNameRef: React.MutableRefObject<string>;
    /** Mutable invalidation counter used by documentation navigation. */
    updateHash: React.MutableRefObject<number>;
    /** Whether the demo-mode information dialog is visible. */
    isDemoModeDialogOpen: boolean;
    /** Opens or closes the demo-mode information dialog. */
    setIsDemoModeDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
    /** Server-configured read-only/demo-mode flag. */
    demoMode: boolean;
    /** Updates the locally cached demo-mode flag. */
    setDemoMode: React.Dispatch<React.SetStateAction<boolean>>;
    /** Whether covariance-related controls and content should be shown. */
    showCov: boolean;
    /** Updates covariance-content visibility. */
    setShowCov: React.Dispatch<React.SetStateAction<boolean>>;
    /** Whether legal-text UI should be rendered. */
    showLegalTexts: boolean;
    /** Updates legal-text visibility. */
    setShowLegalTexts: React.Dispatch<React.SetStateAction<boolean>>;
    /** Whether layout templates navigation and grid should be rendered. */
    showLayoutTemplates: boolean;
    /** Updates layout templates visibility. */
    setShowLayoutTemplates: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Hierarchical disease selection managed by the application sidebar.
 *
 * @example
 * ```ts
 * const dengueSelection: SidebarSelectionI = {
 *   transmissionPath: "vector-borne",
 *   disease: "dengue",
 *   group: "mosquito-borne",
 * };
 * ```
 */
export interface SidebarSelectionI {
   /** Transmission category selected by the user. */
   transmissionPath: string;
   /** Disease identifier selected within the transmission category. */
   disease: string;
   /** Optional subgroup identifier. */
   group: string | undefined;
}

/**
 * Provides shell-level UI state and localized default documentation to the application tree.
 *
 * @param props - React children rendered inside the UI context.
 * @returns The UI context provider wrapping its children.
 *
 * @remarks
 * On mount, the provider reads deployment flags from the Next.js route handlers. Network failures are logged and leave
 * the declared local defaults in place, allowing the interface to remain usable.
 */
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
    // Keep optional COVID navigation and showcases hidden until the runtime
    // deployment flag has explicitly enabled them.
    const [showCov, setShowCov] = useState<boolean>(false);
    const [showLegalTexts, setShowLegalTexts] = useState<boolean>(false);
    const [showLayoutTemplates, setShowLayoutTemplates] = useState<boolean>(false);

    // Fetch demo mode on mount
    React.useEffect(() => {
        fetch('/api/demoMode', { cache: 'no-store' })
            .then(res => res.json())
            .then(data => setDemoMode(data.demoMode))
            .catch(err => console.error('Failed to fetch demo mode:', err));
    }, []);

     React.useEffect(() => {
        fetch('/api/showCov', { cache: 'no-store' })
            .then(res => res.json())
            .then(data => setShowCov(data.showCov))
            .catch(err => console.error('Failed to fetch COVID visibility:', err));
    }, []);

     React.useEffect(() => {
        fetch('/api/showLegalTexts', { cache: 'no-store' })
            .then(res => res.json())
            .then(data => setShowLegalTexts(data.showLegalTexts))
            .catch(err => console.error('Failed to fetch legal texts status:', err));
    }, []);

     React.useEffect(() => {
        fetch('/api/showLayoutTemplates', { cache: 'no-store' })
            .then(res => res.json())
            .then(data => setShowLayoutTemplates(data.showLayoutTemplates))
            .catch(err => console.error('Failed to fetch layout templates visibility:', err));
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
            demoMode, setDemoMode,
            showCov, setShowCov,
            showLegalTexts, setShowLegalTexts,
            showLayoutTemplates, setShowLayoutTemplates
           }}>
            {children}
         </UIContext.Provider>
         </>
    )
}

/**
 * Reads the nearest {@link UIContextI} value.
 *
 * @returns Shell-level UI state and dispatchers.
 * @see {@link UIContextProvider}
 */
function useUIContext() {
    return useContext(UIContext);
}

/** Public application-shell state provider and consumer hook. */
export { UIContextProvider, useUIContext};
