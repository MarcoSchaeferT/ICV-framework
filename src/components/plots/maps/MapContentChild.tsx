'use client';
import React, { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import dynamic from 'next/dynamic';

const ScaleControl = dynamic(
    () => import('react-leaflet').then((mod) => mod.ScaleControl),
    { ssr: false }
);

/**
 * Germany map variant properties for {@link MapContentChild}.
 *
 * @example
 * ```tsx
 * const props: MapContentGermanyProps = {
 *   variant: "germany",
 *   mapRef,
 *   toolTipRef,
 *   L,
 *   isDistanceLegend: true,
 * };
 * ```
 */
export interface MapContentGermanyProps {
    /** Map view variant indicator */
    variant: 'germany';
    /** Mutable ref storing the initialized Leaflet map instance */
    mapRef: React.MutableRefObject<L.Map | null>;
    /** Mutable ref storing the reused tooltip instance */
    toolTipRef: React.MutableRefObject<any>;
    /** Imported Leaflet module instance */
    L: typeof import('leaflet') | null;
    /** Toggle visibility of the Leaflet scale control bar */
    isDistanceLegend: boolean;
}

/**
 * World map variant properties for {@link MapContentChild}.
 *
 * @example
 * ```tsx
 * const props: MapContentWorldProps = {
 *   variant: "world",
 *   mapRef,
 *   toolTipRef,
 *   L,
 *   isDistanceLegend: true,
 * };
 * ```
 */
export interface MapContentWorldProps {
    /** Map view variant indicator */
    variant: 'world';
    /** Mutable ref storing the initialized Leaflet map instance */
    mapRef: React.MutableRefObject<L.Map | null>;
    /** Mutable ref storing the reused tooltip instance */
    toolTipRef: React.MutableRefObject<any>;
    /** Imported Leaflet module instance */
    L: typeof import('leaflet') | null;
    /** Toggle visibility of the Leaflet scale control bar */
    isDistanceLegend: boolean;
}

/**
 * Discriminated union type for {@link MapContentChild} props.
 *
 * @example
 * ```ts
 * const variant: MapContentChildProps = {
 *   variant: "world",
 *   mapRef,
 *   toolTipRef,
 *   L,
 *   isDistanceLegend: false,
 * };
 * ```
 */
export type MapContentChildProps = MapContentGermanyProps | MapContentWorldProps;

/**
 * Inner Leaflet map content child executing React-Leaflet `useMap()` context bindings.
 *
 * Configures variant-specific interaction constraints (e.g. disabling dragging/scroll-zoom for static Germany overview maps),
 * creates custom Leaflet tooltip DOM panes (`z-index: 9999`), and binds the map reference.
 *
 * @param props - Variant configuration object matching {@link MapContentChildProps}.
 *
 * @remarks
 * `useMap()` must be executed within the React Context hierarchy of `<MapContainer>`.
 * Wrapping `MapContentChild` with `React.memo` prevents unnecessary unmounting and expensive Leaflet pane reconstructions when parent props change.
 *
 * @example
 * ```tsx
 * <MapContainer center={[52.52, 13.405]} zoom={6}>
 *   <MapContentChild
 *     variant="world"
 *     mapRef={mapRef}
 *     toolTipRef={toolTipRef}
 *     L={L}
 *     isDistanceLegend={true}
 *   />
 * </MapContainer>
 * ```
 */
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

/** Default export for the memoized React-Leaflet context bridge. */
export default MapContentChild;

