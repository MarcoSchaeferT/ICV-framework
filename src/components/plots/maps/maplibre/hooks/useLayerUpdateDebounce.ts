/**
 * useLayerUpdateDebounce – Debounces map layer re-renders based on
 * the current mouse-event type (wheel, opacity slider, etc.).
 */
import { useEffect } from 'react';
import { resetTimeout } from '../../utils/mapUtils';

interface UseLayerUpdateDebounceParams {
    /** Ref holding the current mouse-event type (determines debounce delay) */
    curMouseEventRef: React.MutableRefObject<string>;
    /** Ref for the debounce timer */
    timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
    /** Ref for the loading spinner flag */
    isLoadingSpinnerRef: React.MutableRefObject<boolean>;
    /** Callback to toggle the isUpdate flag (triggers layer re-render) */
    setIsUpdate: React.Dispatch<React.SetStateAction<boolean>>;
    /** Optional: callback to run after the debounce completes */
    onDebounceComplete?: () => void;
    /**
     * Whether the spinner should be cleared when the debounce completes.
     * If false, the spinner remains active (useful when data is still loading).
     * Defaults to true.
     */
    clearSpinnerOnComplete?: boolean;
    /** Values whose changes trigger the debounced update */
    deps: unknown[];
    /** Custom delay overrides per event type */
    delayOverrides?: Record<string, number>;
}

const DEFAULT_DELAYS: Record<string, number> = {
    wheel: 800,
    opacity: 150,
    null: 500,
    slider: 200,
    mousemove: 1500,
};

export function useLayerUpdateDebounce({
    curMouseEventRef,
    timerRef,
    isLoadingSpinnerRef,
    setIsUpdate,
    onDebounceComplete,
    clearSpinnerOnComplete = true,
    deps,
    delayOverrides = {},
}: UseLayerUpdateDebounceParams): void {
    useEffect(() => {
        resetTimeout(timerRef);
        isLoadingSpinnerRef.current = true;

        const delays = { ...DEFAULT_DELAYS, ...delayOverrides };
        const delay = delays[curMouseEventRef.current] ?? 500;

        timerRef.current = setTimeout(() => {
            setIsUpdate((prev) => !prev);
            if (clearSpinnerOnComplete) {
                isLoadingSpinnerRef.current = false;
            }
            onDebounceComplete?.();
        }, delay);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
}
