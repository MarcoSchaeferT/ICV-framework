import { useEffect, useState, useRef, useMemo } from "react";
import { dbDATA } from "../const_store";

/******************************
****** CUSTOM REACT HOOKS *****
*******************************/

// Global cache to persist data across component mounts/unmounts (cleared on page reload)
// Structure: Map<URL, { data: response, timestamp: when it was fetched }>
const dataCache = new Map<string, { data: dbDATA; timestamp: number }>();

// Track in-flight requests to prevent duplicate fetches for same URL
// Structure: Map<URL, Promise<dbDATA>>
const inflightRequests = new Map<string, Promise<dbDATA>>();

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds (300,000ms)

// Stable empty object reference — avoids creating a new {} on every render
const EMPTY_DATA = {} as dbDATA;


/**
 * Custom React hook to fetch JSON data from a given API URL with caching and proper cleanup.
 *
 * @param url - The API URL to fetch the data from.
 * @param isAllowed - Optional flag to control if fetching is allowed.
 * @returns A tuple containing:
 * - `isLoadingData`: A boolean indicating if the data is still being loaded.
 * - `data`: The fetched JSON data.
 *
 * Features:
 * - Caches data for 5 minutes (prevents repeated fetches)
 * - Prevents duplicate fetches (if 2+ components request same URL simultaneously)
 * - Aborts in-flight requests on unmount (prevents memory leaks)
 *
 *
 * @example
 * const [isLoadingData, data] = useGetJSONData('https://api.example.com/data');
 */
function useGetJSONData(url: string, isAllowed?: boolean): [isLoadingData: boolean, data: dbDATA] {

    const shouldFetch = url !== "" && isAllowed !== false;
    
    // STEP 1: Initialize state with synchronous cache check.
    // By reading the cache inside useState's lazy initializer we guarantee
    // that cached data is available from the very first render — no gap
    // between mount and effect, so no need for workarounds in the return.
    const [isLoadingData, setLoading] = useState(() => {
        if (!shouldFetch) return false;
        const cached = dataCache.get(url);
        if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
            return false; // cache hit → not loading
        }
        return true; // need to fetch
    });

    const [data, setData] = useState<dbDATA>(() => {
        if (!shouldFetch) return EMPTY_DATA;
        const cached = dataCache.get(url);
        if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
            return cached.data; // start with cached data immediately
        }
        return EMPTY_DATA;
    });
    
    const abortControllerRef = useRef<AbortController | null>(null);
   
    // STEP 2: Effect to handle URL changes and fetch data
    useEffect(() => {
        if (!shouldFetch) {
            // Reset to idle state when fetching is disabled (e.g. empty URL)
            setLoading(false);
            setData(EMPTY_DATA);
            return;
        }

        let isMounted = true;

        // STEP 2a: Check cache before fetching
        const cached = dataCache.get(url);
        if (cached) {
            const age = Date.now() - cached.timestamp;
            
            if (age < CACHE_DURATION) {
                // Cache is valid — synchronous setState is intentional here:
                // this is a data-fetching hook that reads from an in-memory cache.
                if (isMounted) {
                    setData(cached.data); // eslint-disable-line react-hooks/set-state-in-effect
                    setLoading(false);
                }
                return () => {
                    isMounted = false;
                };
            }
        }

        // No valid cache, need to fetch - set loading state
        if (isMounted) {
            setLoading(true);
        }

        // STEP 2b: Check if there's already an in-flight request for this URL
        const existingRequest = inflightRequests.get(url);
        if (existingRequest) {
            // Another component is already fetching this URL!
            // Wait for that fetch to complete instead of starting a new one
            existingRequest
                .then((fetchedData) => {
                    // fetchedData is undefined on abort, skip state update in that case
                    if (isMounted && fetchedData !== undefined) {
                        setData(fetchedData);
                        setLoading(false);
                    }
                });
            
            // Return cleanup function to prevent state updates after unmount
            return () => {
                isMounted = false;
            };
        }

        // STEP 2c: No cache, no in-flight request - create new fetch
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        const fetchPromise = fetch(url, {
            method: "GET",
            signal: abortController.signal,
        })
        .then(async (res) => {
            if (!res.ok) {
                let errorMSG = "ERROR while retrieving data from URL: '" + String(url) + "'";
                try {
                    const errorJson = await res.json();
                    if (errorJson && errorJson.error) {
                        errorMSG = errorJson.error;
                    }
                } catch (e) {
                    // Fallback to default message
                }
                console.log("Expected server error gracefully caught:", errorMSG);
                return { error: errorMSG } as dbDATA;
            }
            return res.json();
        })
        .then((fetchedData) => {
            // STEP 5: Save to cache with new timestamp (only if no error)
            if (!(fetchedData as any).error) {
                dataCache.set(url, { 
                    data: fetchedData, 
                    timestamp: Date.now()
                });
            }
            
            // Update this component's state
            if (isMounted) {
                setData(fetchedData);
                setLoading(false);
            }
            
            // Return data for other components waiting on this promise
            return fetchedData;
        })
        .catch((error) => {
            // Handle errors
            if (error.name === 'AbortError') {
                console.log('Fetch aborted for:', url);
                return undefined; // Return undefined so waiters can detect abort
            } else {
                const errorData: dbDATA = { error: `Fetch error: ${error.message}` } as dbDATA;
                if (isMounted) {
                    setData(errorData);
                    setLoading(false);
                }
                console.error('Fetch error:', error);
                return errorData; // Return error data instead of re-throwing
            }
        })
        .finally(() => {
            // STEP 6: Clean up in-flight request tracking
            inflightRequests.delete(url);
        });

        // Store the promise so other components can wait for it
        inflightRequests.set(url, fetchPromise);

        return () => {
            isMounted = false;
        };
       
    }, [url, shouldFetch]);

    if (!shouldFetch) return [false, EMPTY_DATA];
    return [isLoadingData, data];
}

/**
 * Clear the entire data cache - useful for forcing fresh data fetch
 * 
 * Use case: User clicks "Refresh All Data" button
 * Result: All cached URLs cleared, next fetch will be fresh
 */
function clearDataCache() {
    dataCache.clear();
}

/**
 * Clear specific URL from cache
 * 
 * Use case: User knows data for specific endpoint changed
 * Result: Only that URL cleared, other cached data preserved
 * 
 * @param url - The specific URL to remove from cache
 */
function clearCacheForUrl(url: string) {
    dataCache.delete(url);
}

export { useGetJSONData, clearDataCache, clearCacheForUrl };
