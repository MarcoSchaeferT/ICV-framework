/**
 * useMapLibreTooltip – React-based tooltip manager for MapLibre GL JS.
 *
 * Replaces Leaflet's L.tooltip with a lightweight <div> positioned
 * via map.project(). The tooltip DOM element lives inside the map container.
 *
 * Returns refs and functions to control tooltip visibility and content.
 */
import { useEffect, useRef, useCallback } from 'react';
import type { Map as MapLibreMap, LngLatLike } from 'maplibre-gl';

interface UseMapLibreTooltipParams {
    map: MapLibreMap | null;
    /** CSS class names for the tooltip container */
    tooltipClassName?: string;
}

interface UseMapLibreTooltipReturn {
    /** Show the tooltip at a given lngLat with HTML content */
    showTooltip: (lngLat: LngLatLike, content: string) => void;
    /** Hide the tooltip */
    hideTooltip: () => void;
    /** Whether the mouse is currently inside the map container */
    isMouseInsideRef: React.MutableRefObject<boolean>;
    /** Ref to the tooltip DOM element */
    tooltipRef: React.MutableRefObject<HTMLDivElement | null>;
}

export function useMapLibreTooltip({
    map,
    tooltipClassName = '',
}: UseMapLibreTooltipParams): UseMapLibreTooltipReturn {
    const tooltipRef = useRef<HTMLDivElement | null>(null);
    const isMouseInsideRef = useRef(false);

    // Create tooltip element on mount
    useEffect(() => {
        if (!map) return;

        const container = map.getContainer();
        if (!container) return;

        // Create tooltip div if it doesn't exist
        if (!tooltipRef.current) {
            const el = document.createElement('div');
            el.style.cssText = `
                position: absolute;
                pointer-events: none;
                z-index: 1000;
                transform: translate(-50%, -100%);
                transition: opacity 0.15s ease;
                opacity: 0;
                display: none;
            `;
            if (tooltipClassName) {
                el.className = tooltipClassName;
            }
            container.appendChild(el);
            tooltipRef.current = el;
        }

        // Mouse enter/leave handlers for the map container
        const handleMouseEnter = () => {
            isMouseInsideRef.current = true;
        };

        const handleMouseLeave = () => {
            isMouseInsideRef.current = false;
            if (tooltipRef.current) {
                tooltipRef.current.style.opacity = '0';
                setTimeout(() => {
                    if (tooltipRef.current) {
                        tooltipRef.current.style.display = 'none';
                    }
                }, 150);
            }
        };

        container.addEventListener('mouseenter', handleMouseEnter);
        container.addEventListener('mouseleave', handleMouseLeave);

        return () => {
            container.removeEventListener('mouseenter', handleMouseEnter);
            container.removeEventListener('mouseleave', handleMouseLeave);

            // Remove tooltip element
            if (tooltipRef.current && container.contains(tooltipRef.current)) {
                container.removeChild(tooltipRef.current);
                tooltipRef.current = null;
            }
        };
    }, [map, tooltipClassName]);

    const showTooltip = useCallback((lngLat: LngLatLike, content: string) => {
        if (!map || !tooltipRef.current || !isMouseInsideRef.current) return;

        const point = map.project(lngLat as [number, number]);
        const el = tooltipRef.current;

        el.innerHTML = content;
        el.style.left = `${point.x}px`;
        el.style.top = `${point.y}px`;
        el.style.display = 'block';
        el.style.opacity = '1';
    }, [map]);

    const hideTooltip = useCallback(() => {
        if (!tooltipRef.current) return;
        tooltipRef.current.style.opacity = '0';
        setTimeout(() => {
            if (tooltipRef.current) {
                tooltipRef.current.style.display = 'none';
            }
        }, 150);
    }, []);

    return {
        showTooltip,
        hideTooltip,
        isMouseInsideRef,
        tooltipRef,
    };
}
