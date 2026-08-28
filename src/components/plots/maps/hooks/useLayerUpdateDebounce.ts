import { useCallback, useEffect, useRef } from 'react';
import { resetTimeout } from '../utils/mapUtils';

/**
 * Parameters for the {@link useLayerUpdateDebounce} hook.
 *
 * @example
 * ```ts
 * const params: UseLayerUpdateDebounceParams = {
 *   curMouseEventRef: { current: "opacity" },
 *   timerRef: { current: null },
 *   startLoading: () => undefined,
 *   stopLoading: () => undefined,
 *   setIsUpdate: () => undefined,
 *   deps: [0.85, "interpolateInferno"],
 * };
 * ```
 */
export interface UseLayerUpdateDebounceParams {
    /** Ref holding the active mouse-event type (e.g. "wheel", "opacity", "slider", "mousemove") */
    curMouseEventRef: React.MutableRefObject<string>;
    /** Mutable ref storing the active setTimeout handle */
    timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
    /** Triggered when debouncing begins (activates task loading spinner) */
    startLoading: () => void;
    /** Triggered when debouncing completes (deactivates task loading spinner) */
    stopLoading: () => void;
    /** React state dispatcher toggling layer update trigger */
    setIsUpdate: React.Dispatch<React.SetStateAction<boolean>>;
    /** Optional callback executed after the debounce delay completes */
    onDebounceComplete?: () => void;
    /**
     * Whether the task loading spinner should be cleared when debounce finishes.
     * @default true
     */
    clearSpinnerOnComplete?: boolean;
    /** Array of React state/prop dependencies triggering the debounced update */
    deps: unknown[];
    /** Custom millisecond delay overrides mapped by event type */
    delayOverrides?: Record<string, number>;
    /** Leaflet map whose active pointer/drag/zoom interactions pause updates. */
    interactionMap?: L.Map | null;
}

const DEFAULT_DELAYS: Record<string, number> = {
    wheel: 250,
    opacity: 100,
    null: 250,
    drag: 250,
    slider: 120,
    mousemove: 250,
};

const EMPTY_DELAY_OVERRIDES: Record<string, number> = {};

/**
 * Coalesces rapid layer update triggers using event-aware dynamic debounce timeouts.
 *
 * Adjusts delay thresholds dynamically based on user interaction type. The
 * compact shared-grid renderer permits short 100–250 ms delays while still
 * coalescing rapid wheel and slider updates.
 *
 * @param params - Configuration containing interaction ref, timer ref, loading handlers, and dependency triggers.
 *
 * @remarks
 * Rapid parameter adjustments (such as sliding an opacity slider or scrolling the map wheel) dispatch dozens
 * of state updates per second. Re-rendering heavy D3 SVG or Leaflet canvas tile layers synchronously on each frame
 * stalls the browser main thread. Dynamic debouncing ensures interactive UI feedback while delaying expensive canvas repaints.
 *
 * @example
 * ```tsx
 * const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
 * useLayerUpdateDebounce({
 *   curMouseEventRef: mouseEventRef,
 *   timerRef,
 *   startLoading: () => loadingTask.start(),
 *   stopLoading: () => loadingTask.stop(),
 *   setIsUpdate: setLayerUpdateTrigger,
 *   deps: [layerOpacity, activeFeature, colorMap],
 * });
 * ```
 */
export function useLayerUpdateDebounce({
    curMouseEventRef,
    timerRef,
    startLoading,
    stopLoading,
    setIsUpdate,
    onDebounceComplete,
    clearSpinnerOnComplete = true,
    deps,
    delayOverrides = EMPTY_DELAY_OVERRIDES,
    interactionMap = null,
}: UseLayerUpdateDebounceParams): void {
    const interactionActiveRef = useRef(false);
    const activeInteractionsRef = useRef(new Set<string>());
    const updatePendingRef = useRef(false);
    const runtimeRef = useRef({
        startLoading,
        stopLoading,
        setIsUpdate,
        clearSpinnerOnComplete,
        onDebounceComplete,
        delayOverrides,
    });

    useEffect(() => {
        runtimeRef.current = {
            startLoading,
            stopLoading,
            setIsUpdate,
            clearSpinnerOnComplete,
            onDebounceComplete,
            delayOverrides,
        };
    }, [
        clearSpinnerOnComplete,
        delayOverrides,
        onDebounceComplete,
        setIsUpdate,
        startLoading,
        stopLoading,
    ]);

    const schedulePendingUpdate = useCallback(() => {
        resetTimeout(timerRef);
        if (interactionActiveRef.current || !updatePendingRef.current) return;

        const runtime = runtimeRef.current;
        const delays = { ...DEFAULT_DELAYS, ...runtime.delayOverrides };
        const delay = delays[curMouseEventRef.current] ?? 100;
        runtime.startLoading();
        timerRef.current = setTimeout(() => {
            timerRef.current = null;
            if (interactionActiveRef.current) return;

            updatePendingRef.current = false;
            const latestRuntime = runtimeRef.current;
            latestRuntime.setIsUpdate((prev) => !prev);
            if (latestRuntime.clearSpinnerOnComplete) latestRuntime.stopLoading();
            latestRuntime.onDebounceComplete?.();
        }, delay);
    }, [curMouseEventRef, timerRef]);

    useEffect(() => {
        updatePendingRef.current = true;
        schedulePendingUpdate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    useEffect(() => {
        if (!interactionMap) return;
        const activeInteractions = activeInteractionsRef.current;

        const pausePendingUpdate = (source: string) => {
            activeInteractions.add(source);
            interactionActiveRef.current = true;
            resetTimeout(timerRef);
            runtimeRef.current.stopLoading();
        };
        const resumePendingUpdate = (source: string) => {
            activeInteractions.delete(source);
            if (activeInteractions.size > 0) return;

            interactionActiveRef.current = false;
            schedulePendingUpdate();
        };
        const handlePointerDown = (event: PointerEvent) => pausePendingUpdate(`pointer:${event.pointerId}`);
        const handlePointerUp = (event: PointerEvent) => resumePendingUpdate(`pointer:${event.pointerId}`);
        const handleDragStart = () => pausePendingUpdate('drag');
        const handleDragEnd = () => resumePendingUpdate('drag');
        const handleZoomStart = () => pausePendingUpdate('zoom');
        const handleZoomEnd = () => resumePendingUpdate('zoom');

        // Wheel fires BEFORE Leaflet's zoomstart, giving the earliest
        // possible cancellation point for scroll-zoom interactions.
        // A debounced resume ensures rapid wheel ticks are coalesced
        // into a single interaction block.
        let wheelResumeTimer: ReturnType<typeof setTimeout> | null = null;
        const handleWheel = () => {
            pausePendingUpdate('wheel');
            if (wheelResumeTimer) clearTimeout(wheelResumeTimer);
            wheelResumeTimer = setTimeout(() => {
                wheelResumeTimer = null;
                resumePendingUpdate('wheel');
            }, 150);
        };
        const container = interactionMap.getContainer();
        container.addEventListener('wheel', handleWheel, { passive: true });

        const handleTouchStart = () => pausePendingUpdate('touch');
        const handleTouchEnd = () => resumePendingUpdate('touch');

        container.addEventListener('pointerdown', handlePointerDown, { passive: true });
        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchend', handleTouchEnd, { passive: true });
        container.addEventListener('touchcancel', handleTouchEnd, { passive: true });
        window.addEventListener('pointerup', handlePointerUp, { passive: true });
        window.addEventListener('pointercancel', handlePointerUp, { passive: true });
        interactionMap.on('dragstart', handleDragStart);
        interactionMap.on('dragend', handleDragEnd);
        interactionMap.on('zoomstart', handleZoomStart);
        interactionMap.on('zoomend', handleZoomEnd);

        return () => {
            container.removeEventListener('pointerdown', handlePointerDown);
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchend', handleTouchEnd);
            container.removeEventListener('touchcancel', handleTouchEnd);
            container.removeEventListener('wheel', handleWheel);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
            interactionMap.off('dragstart', handleDragStart);
            interactionMap.off('dragend', handleDragEnd);
            interactionMap.off('zoomstart', handleZoomStart);
            interactionMap.off('zoomend', handleZoomEnd);
            if (wheelResumeTimer) clearTimeout(wheelResumeTimer);
            activeInteractions.clear();
            interactionActiveRef.current = false;
        };
    }, [interactionMap, schedulePendingUpdate, timerRef]);

    useEffect(() => () => {
        resetTimeout(timerRef);
        runtimeRef.current.stopLoading();
    }, [timerRef]);
}

