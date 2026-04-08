"use client";
import React, { useEffect, useState } from 'react';

import dynamic from 'next/dynamic';


const MapContainer = dynamic(() => import("react-leaflet").then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then(mod => mod.TileLayer), { ssr: false });



class LeafletComponentPorps {
  chartName: string
  children: any;
  dataURL: any; // or you can use a more specific type like GeoJSON.FeatureCollection if you have the type definitions
  exampleVar: any;
  center?: [number, number];
  zoom?: number;
  isProjection_equirectangular?: boolean;

  constructor(chartName: string, dataURL: string, exampleVar?: any, center?: [number, number], zoom?: number, isProjection_equirectangular?: boolean) {
      this.chartName = chartName;
      this.dataURL = dataURL || null;
      this.exampleVar = exampleVar || null;
      this.center = center || [51.505, -0.09];
      this.zoom = zoom || 2;
      this.isProjection_equirectangular = isProjection_equirectangular || false;
  }
}

interface Props {
  children: React.ReactNode;
  ChartPorps: LeafletComponentPorps;
};

const LeafletMapComponent: React.FC<Props> = ({ children,   ChartPorps = {} as LeafletComponentPorps }: Props) => {

let props = ChartPorps;

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

export default  LeafletMapComponent;
export { LeafletComponentPorps };
