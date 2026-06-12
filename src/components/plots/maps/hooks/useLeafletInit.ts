/**
 * useLeafletInit – SSR-safe dynamic import of Leaflet.
 */
import { useEffect, useState } from 'react';
import type * as Leaflet from 'leaflet';

export function useLeafletInit(): typeof Leaflet | null {
    const [L, setL] = useState<typeof Leaflet | null>(null);

    useEffect(() => {
        import('leaflet').then((module) => {
            setL(module);
        });
    }, []);

    return L;
}
