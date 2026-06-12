/**
 * useTooltipCleanup – Manages tooltip visibility based on mouse
 * enter/leave on the Leaflet map container.
 *
 * On mouseleave:
 *   - Removes the tooltip
 *   - Calls onMouseLeave callback so the component can clear synced state
 * On mouseenter:
 *   - Sets isMouseInsideRef to true
 *
 * The hook returns `isMouseInsideRef` so components can check it, and
 * ensures tooltip panes don't intercept mouse events.
 */
import { useEffect, useRef } from 'react';
import { removeReusedTooltip } from '../utils/mapUtils';

interface UseTooltipCleanupParams {
    /** Leaflet map instance */
    map: L.Map | null;
    /** Leaflet module (from useLeafletInit) */
    L: typeof import('leaflet') | null;
    /** Ref to the single reused tooltip */
    toolTipRef: React.MutableRefObject<L.Tooltip | null>;
    /** Called when mouse leaves the container — use to clear synced context */
    onMouseLeave?: () => void;
}

interface UseTooltipCleanupReturn {
    /** true when the cursor is inside the map container */
    isMouseInsideRef: React.MutableRefObject<boolean>;
}

export function useTooltipCleanup({
    map,
    L,
    toolTipRef,
    onMouseLeave,
}: UseTooltipCleanupParams): UseTooltipCleanupReturn {
    const isMouseInsideRef = useRef(false);

    useEffect(() => {
        if (!map || !L) return;

        const container = map.getContainer();

        // Ensure tooltip panes never intercept mouse events
        const panes = [
            map.getPane('custom-tooltips'),
            map.getPane('tooltipPane'),
        ].filter(Boolean) as HTMLElement[];
        panes.forEach(p => { p.style.pointerEvents = 'none'; });

        const handleMouseLeave = () => {
            isMouseInsideRef.current = false;
            removeReusedTooltip(map, L, toolTipRef);
            onMouseLeave?.();
        };

        const handleMouseEnter = () => {
            isMouseInsideRef.current = true;
        };

        container.addEventListener('mouseleave', handleMouseLeave);
        container.addEventListener('mouseenter', handleMouseEnter);

        return () => {
            container.removeEventListener('mouseleave', handleMouseLeave);
            container.removeEventListener('mouseenter', handleMouseEnter);
        };
    }, [map, L, toolTipRef, onMouseLeave]);

    return { isMouseInsideRef };
}
