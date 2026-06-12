/**
 * useMapLibreInit – SSR-safe dynamic import of MapLibre GL JS.
 *
 * Replaces useLeafletInit.ts.
 * Returns the maplibre-gl module or null if not yet loaded.
 */
import { useEffect, useState } from 'react';
import type * as MapLibreGL from 'maplibre-gl';

export function useMapLibreInit(): typeof MapLibreGL | null {
    const [ml, setMl] = useState<typeof MapLibreGL | null>(null);

    useEffect(() => {
        import('maplibre-gl').then((mod) => {
            // Import CSS side-effect for proper rendering
            import('maplibre-gl/dist/maplibre-gl.css');
            setMl(mod);
        });
    }, []);

    return ml;
}
