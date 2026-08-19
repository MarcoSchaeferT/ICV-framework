import { useEffect, useState } from 'react';
import type * as Leaflet from 'leaflet';

/**
 * SSR-safe dynamic import hook for the Leaflet library.
 *
 * Dynamically loads the `leaflet` module on client-side mount to prevent
 * Next.js Server-Side Rendering (SSR) window/document reference errors.
 *
 * @returns The imported `L` Leaflet module instance, or `null` while initializing.
 *
 * @remarks
 * Next.js App Router evaluates components on the server during initial load.
 * Direct static imports of Leaflet crash on Node.js because Leaflet accesses
 * `window` and `document` at module evaluation time. This hook guarantees
 * that Leaflet is loaded only in client browser contexts.
 *
 * @example
 * ```tsx
 * const L = useLeafletInit();
 *
 * useEffect(() => {
 *   if (!L || !mapRef.current) return;
 *   const marker = L.marker([52.52, 13.405]).addTo(mapRef.current);
 * }, [L]);
 * ```
 */
export function useLeafletInit(): typeof Leaflet | null {
    const [L, setL] = useState<typeof Leaflet | null>(null);

    useEffect(() => {
        import('leaflet').then((module) => {
            setL(module);
        });
    }, []);

    return L;
}

