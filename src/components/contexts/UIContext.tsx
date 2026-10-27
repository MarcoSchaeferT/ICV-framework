
import { layoutSizes, LayoutSizesT } from '@/app/const_store';
import React, { createContext, useContext, useMemo, useState, useRef, useCallback } from 'react';
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
    /** Shared Vis. Interface shell measurements. */
    layoutDims: LayoutSizesT;
    /** Updates Vis. Interface shell measurements. */
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
    /** Updates the active documentation section name from navigation events. */
    setCurDocsName: (name: string) => void;
    /** Mutable invalidation counter used by documentation navigation. */
    updateHash: React.MutableRefObject<number>;
    /** Whether the demo-mode information dialog is visible. */
    isDemoModeDialogOpen: boolean;
    /** Opens or closes the demo-mode information dialog. */
    setIsDemoModeDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
    /** Server-configured read-only/demo-mode flag. */
    demoMode: boolean;
    /** Whether deployment flags have been loaded from the runtime API. */
    configReady: boolean;
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
 * Flag-dependent UI starts hidden until the runtime API responds, so static HTML
 * and the first browser render agree across deployments.
 */
function UIContextProvider({ children }: { children: React.ReactNode }) {

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
    const setCurDocsName = useCallback((name: string) => {
        curDocsNameRef.current = name;
    }, []);
    const updateHash = useRef(0);
    const [isDemoModeDialogOpen, setIsDemoModeDialogOpen] = useState<boolean>(false);
    const [demoMode, setDemoMode] = useState<boolean>(false);
    const [configReady, setConfigReady] = useState<boolean>(false);
    const [showCov, setShowCov] = useState<boolean>(false);
    const [showLegalTexts, setShowLegalTexts] = useState<boolean>(false);
    const [showLayoutTemplates, setShowLayoutTemplates] = useState<boolean>(false);

    React.useEffect(() => {
        let active = true;
        fetch('/api/appConfig', { cache: 'no-store' })
            .then(res => {
                if (!res.ok) throw new Error(`App config request failed: ${res.status}`);
                return res.json();
            })
            .then(data => {
                if (!active) return;
                setDemoMode(data.demoMode);
                setShowCov(data.showCov);
                setShowLegalTexts(data.showLegalTexts);
                setShowLayoutTemplates(data.showLayoutTemplates);
                setConfigReady(true);
            })
            .catch(err => console.error('Failed to fetch app config:', err));
        return () => { active = false; };
    }, []);

    // Memoize the context value so consumers only re-render when an
    // included field actually changes — not on every parent render.
    const contextValue = useMemo(() => ({
        sidebarSelection, setSidebarSelection,
        layoutDims, setLayoutDims,
        isSidebarOpen, setIsSidebarOpen,
        curDocsMDXContent, setCurMDXContent,
        isSwapy, setIsSwapy,
        curDocsNameRef,
        setCurDocsName,
        updateHash,
        isDemoModeDialogOpen, setIsDemoModeDialogOpen,
        demoMode, setDemoMode,
        configReady,
        showCov, setShowCov,
        showLegalTexts, setShowLegalTexts,
        showLayoutTemplates, setShowLayoutTemplates,
    }), [
        sidebarSelection,
        layoutDims,
        isSidebarOpen,
        curDocsMDXContent,
        setCurDocsName,
        isSwapy,
        isDemoModeDialogOpen,
        demoMode,
        configReady,
        showCov,
        showLegalTexts,
        showLayoutTemplates,
    ])

    return (
        <UIContext.Provider value={contextValue}>
            {children}
        </UIContext.Provider>
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
