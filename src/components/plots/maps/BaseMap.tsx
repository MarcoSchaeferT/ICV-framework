"use client";
import React, { useEffect, useState } from 'react';

import dynamic from 'next/dynamic';


const MapContainer = dynamic(() => import("react-leaflet").then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then(mod => mod.TileLayer), { ssr: false });



/**
 * Base React-Leaflet map-container configuration shared by supported map layers.
 *
 * @example
 * ```ts
 * const baseMap: LeafletComponentProps = {
 *   chartName: "global-albopictus-map",
 *   dataURL: "/api/getMapData?mapName=world_map",
 *   exampleVar: null,
 *   center: [52.52, 13.405],
 *   zoom: 2,
 *   isProjection_equirectangular: true,
 * };
 * ```
 */
export interface LeafletComponentProps {
  /** Stable DOM identifier for the Leaflet container. */
  chartName: string;
  /** React-Leaflet layers and controls rendered inside `MapContainer`. */
  children?: any;
  /** Source URL associated with the map configuration. */
  dataURL: any;
  /** Legacy extension value retained for existing map consumers. */
  exampleVar: any;
  /** Initial `[latitude, longitude]` center used by React-Leaflet. @default [51.505, -0.09] */
  center?: [number, number];
  /** Initial Leaflet zoom. @default 2 */
  zoom?: number;
  /** Whether to use `L.CRS.EPSG4326` instead of Web Mercator. @default false */
  isProjection_equirectangular?: boolean;
}

/**
 * Creates a complete base Leaflet map-container configuration.
 *
 * @param chartName - Stable DOM identifier for the map.
 * @param dataURL - Source URL associated with the map.
 * @param exampleVar - Legacy extension value.
 * @param center - Initial `[latitude, longitude]` center.
 * @param zoom - Initial Leaflet zoom.
 * @param isProjection_equirectangular - Enables the EPSG:4326 coordinate reference system.
 * @returns A configuration consumed by {@link LeafletMapComponent}.
 * @default exampleVar null
 * @default center [51.505, -0.09]
 * @default zoom 2
 * @default isProjection_equirectangular false
 */
export function LeafletComponentProps(
    chartName: string,
    dataURL: string,
    exampleVar: any = null,
    center: [number, number] = [51.505, -0.09],
    zoom = 2,
    isProjection_equirectangular = false
): LeafletComponentProps {
  return {
      chartName,
      dataURL: dataURL || null,
      exampleVar,
      center,
      zoom,
      isProjection_equirectangular
  };
}

/**
 * Props for the SSR-safe Leaflet container.
 *
 * @example
 * ```tsx
 * const props: Props = {
 *   chartProps: LeafletComponentProps(
 *     "berlin-vector-map",
 *     "/api/getMapData?mapName=world_map",
 *     null,
 *     [52.52, 13.405],
 *     4,
 *   ),
 *   children: <></>,
 * };
 * ```
 */
interface Props {
  /** Leaflet layers and controls. */
  children: React.ReactNode;
  /** Map-container configuration. */
  chartProps: LeafletComponentProps;
};

/**
 * Renders the supported Leaflet map boundary after dynamically loading browser-only dependencies.
 *
 * @param props - Child layers and map-container configuration.
 * @returns A React-Leaflet `MapContainer`, or a loading message before Leaflet is available.
 *
 * @remarks
 * Leaflet accesses browser globals and therefore must not be imported during server rendering. Analytical layers are
 * supplied as children by `LeafD3Map` or `LeafD3MapGermanyCovid`; this component owns only the map container and CRS.
 */
const LeafletMapComponent: React.FC<Props> = ({ children,   chartProps = {} as LeafletComponentProps }: Props) => {

let props = chartProps;

const [L, setL] = useState<any>(null);

  useEffect(() => {
    import("leaflet").then((module) => {
      setL(module);
    });
  }, []);

  if (!L) return <p>Loading map...</p>;

/******************************
* *** THE PLOT DEFINITION *** *
*******************************/

const zoomStep = 0.01;
const isProjection_equirectangular = props.isProjection_equirectangular ?? false;
   //   isProjection_equirectangular = false; // TEMPORARY DISABLE


/**************************
* *** PAGE DEFINITION *** *
***************************/
return (
    <>
      <MapContainer
        className='size-full absolute z-0 '
        id={props.chartName}
        center={[props.center?.[0] ?? 51.505, props.center?.[1] ?? -0.09]}
        zoom={props.zoom}
        minZoom={-1}
        scrollWheelZoom={true}
        zoomDelta={zoomStep}
        zoomSnap={zoomStep*0.01}
        inertia={true}
        zoomAnimation={false}
        style={{ backgroundColor: '#ffffff' }}
        zoomControl={false}
        doubleClickZoom={false}

        crs={isProjection_equirectangular ? L.CRS.EPSG4326 : L.CRS.EPSG3857} // equirectangular projection EPSG:4326 or default mercator EPSG:3857
        layers={[
        ]}
      >
        {/*
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />
        */}
        {children}
      </MapContainer>
    </>
);

};

/** Default export for the SSR-safe React-Leaflet map container. */
export default  LeafletMapComponent;
