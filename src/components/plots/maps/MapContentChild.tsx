/**
 * MapContentChild – Extracted from the nested `MapContent()` in both map components.
 *
 * This component must be rendered as a child of <MapContainer> (via react-leaflet)
 * because it calls useMap() to access the map instance.
 *
 * Wrapped with React.memo since the props rarely change and re-mounting
 * a Leaflet child is expensive.
 */
'use client';
import React, { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import dynamic from 'next/dynamic';

const ScaleControl = dynamic(
    () => import('react-leaflet').then((mod) => mod.ScaleControl),
    { ssr: false }
);

// ─── Germany variant props ───
interface MapContentGermanyProps {
    variant: 'germany';
    mapRef: React.MutableRefObject<L.Map | null>;
    toolTipRef: React.MutableRefObject<any>;
    L: typeof import('leaflet') | null;
    isDistanceLegend: boolean;
}

// ─── World variant props ───
interface MapContentWorldProps {
    variant: 'world';
    mapRef: React.MutableRefObject<L.Map | null>;
    toolTipRef: React.MutableRefObject<any>;
    L: typeof import('leaflet') | null;
    isDistanceLegend: boolean;
}

export type MapContentChildProps = MapContentGermanyProps | MapContentWorldProps;

const MapContentChild: React.FC<MapContentChildProps> = React.memo(
    ({ variant, mapRef, toolTipRef, L, isDistanceLegend }) => {
        const map = useMap();

        useEffect(() => {
            mapRef.current = map;
        }, [map, mapRef]);

        useEffect(() => {
            if (!map || !L) return;

            if (variant === 'germany') {
                // Germany variant: disable interactions and create simple tooltip
                map.dragging.disable();
                map.scrollWheelZoom.disable();
                toolTipRef.current = L.tooltip();

                // Fix initial rendering layout issue
                setTimeout(() => {
                    map.invalidateSize();
                    window.dispatchEvent(new Event('resize'));
                }, 250);
            } else {
                // World variant: create custom tooltip pane for higher z-index
                if (!map.getPane('custom-tooltips')) {
                    map.createPane('custom-tooltips');
                    const customTooltipsPane = map.getPane('custom-tooltips');
                    if (customTooltipsPane) {
                        customTooltipsPane.style.zIndex = '9999';
                    }
                }
                if (!toolTipRef.current) {
                    toolTipRef.current = L.tooltip({ pane: 'custom-tooltips' });
                }
            }
        }, [L, map, variant, toolTipRef]);

        return (
            <>
                {isDistanceLegend && (
                    <ScaleControl
                        position="bottomleft"
                        imperial={false}
                        metric={true}
                        maxWidth={100}
                    />
                )}
            </>
        );
    }
);

MapContentChild.displayName = 'MapContentChild';

export default MapContentChild;
