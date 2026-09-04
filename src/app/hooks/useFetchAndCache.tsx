import { useEffect, useState } from "react";
import { dbDATA } from "@/app/const_store";

/******************************
****** CUSTOM REACT HOOKS *****
*******************************/

// Global cache to persist data across component mounts/unmounts (cleared on page reload)
// Structure: Map<URL, { data: response, timestamp: when fetched, sizeBytes: estimated size }>
const dataCache = new Map<string, { data: dbDATA; timestamp: number; sizeBytes: number }>();

// Track in-flight requests to prevent duplicate fetches for same URL
interface InflightRequest {
    promise: Promise<dbDATA | undefined>;
    controller: AbortController;
    subscribers: number;
}

// Subscribers share one request. The request is aborted only after its last
// consumer unmounts or changes URL.
const inflightRequests = new Map<string, InflightRequest>();

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds (300,000ms)

// Cache limits — whichever is hit first evicts the least-recently-used
// entries. Dataset responses can be tens of MB, so without a bound a long
// session browsing many datasets/filters would grow tab memory unbounded.
const MAX_CACHE_ENTRIES = 32;
const MAX_CACHE_BYTES = 256 * 1024 * 1024; // 256 MB estimated JS heap

// Running total of the estimated cache size in bytes
let cacheTotalBytes = 0;

function removeCacheEntry(url: string) {
    const entry = dataCache.get(url);
    if (entry) {
        cacheTotalBytes -= entry.sizeBytes;
        dataCache.delete(url);
    }
}

function responseMatchesRequest(url: string, data: dbDATA): boolean {
    let expectedRelation = "";
    try {
        expectedRelation = new URL(url, "http://localhost").searchParams.get("relationName") || "";
    } catch {
        return true;
    }
    const actualRelation = typeof data?.relationName === "string" ? data.relationName : "";
    return !expectedRelation || !actualRelation || expectedRelation === actualRelation;
}

function getUsableCacheEntry(url: string) {
    const entry = dataCache.get(url);
    if (entry && !responseMatchesRequest(url, entry.data)) {
        removeCacheEntry(url);
        return undefined;
    }
    return entry;
}

/** Re-insert an entry so it becomes the most-recently-used one.
 *  Map preserves insertion order, so the first key is always the LRU. */
function touchCacheEntry(url: string) {
    const entry = dataCache.get(url);
    if (entry) {
        dataCache.delete(url);
        dataCache.set(url, entry);
    }
}

function storeInCache(url: string, data: dbDATA, sizeBytes: number) {
    if (!responseMatchesRequest(url, data)) return;
    // A single response bigger than the whole budget is served but not cached
    if (sizeBytes > MAX_CACHE_BYTES) return;

    // Drop expired entries (the TTL is otherwise only checked on read, so
    // stale entries for never-revisited URLs would pile up forever)
    const now = Date.now();
    dataCache.forEach((entry, key) => {
        if (now - entry.timestamp >= CACHE_DURATION) removeCacheEntry(key);
    });

    removeCacheEntry(url);

    // Evict least-recently-used entries until both limits are satisfied
    while (
        dataCache.size >= MAX_CACHE_ENTRIES ||
        cacheTotalBytes + sizeBytes > MAX_CACHE_BYTES
    ) {
        const oldest = dataCache.keys().next().value;
        if (oldest === undefined) break;
        removeCacheEntry(oldest);
    }

    dataCache.set(url, { data, timestamp: now, sizeBytes });
    cacheTotalBytes += sizeBytes;
}

// Stable empty object reference — avoids creating a new {} on every render
const EMPTY_DATA = {} as dbDATA;

function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === "AbortError";
}

function releaseInflightRequest(url: string, request: InflightRequest) {
    const current = inflightRequests.get(url);
    if (current !== request) return;
    current.subscribers = Math.max(0, current.subscribers - 1);
    if (current.subscribers === 0) {
        inflightRequests.delete(url);
        current.controller.abort();
    }
}


/**
 * Primary HTTP data fetching hook with LRU caching, in-flight request deduplication, and an `AbortController` signal.
 *
 * Primary data pipeline hook for retrieving spatial grid datasets, vector presence markers, and genomic metadata payloads
 * from backend endpoints (`/api/db/getDataFromDB`).
 *
 * @param url - Absolute or relative API URL string to fetch.
 * @param isAllowed - Optional boolean flag controlling whether the request is authorized to execute. @default true
 * @returns A tuple `[isLoadingData, data]`:
 * - `isLoadingData`: True while the HTTP request is pending or initializing.
 * - `data`: Parsed JSON response payload matching {@link dbDATA}.
 *
 * @remarks
 * **Performance & Memory Architecture:**
 * 1. **Zero-Latency Cached Reads:** Uses `useState` lazy initializers to synchronously return cached data on initial component mount.
 * 2. **In-Flight Request Deduplication:** If multiple dashboard cards request the same dataset simultaneously, only a single HTTP network request is dispatched. Subscribing components await the shared Promise (`inflightRequests`).
 * 3. **LRU Cache Eviction:** Bounded in-memory LRU cache holding up to 32 entries or an estimated 256 MB (`MAX_CACHE_BYTES`).
 * 4. **5-Minute TTL:** Cached items automatically expire after 300,000 ms (`CACHE_DURATION`).
 * 5. **Unmount Safety:** Reference-counted subscribers abort a request after its final consumer unmounts.
 *
 * @see {@link InterfaceContext} for global URL state parameters driving this hook.
 * @see {@link LeafD3Map} for Leaflet map integration consuming `useGetJSONData`.
 * @see {@link clearDataCache} to flush all cached endpoints.
 * @see {@link clearCacheForUrl} to evict a specific endpoint.
 *
 * @example
 * ```tsx
 * const url = "/api/db/getDataFromDB?dataset=world_mosquitos&feature=mosquito_amount";
 * const [isLoading, rawData] = useGetJSONData(url, true);
 *
 * if (isLoading) return <LoadingSpinner />;
 * console.log("Fetched grid records:", rawData.response?.length);
 * ```
 */
function useGetJSONData(url: string, isAllowed?: boolean): [isLoadingData: boolean, data: dbDATA] {

    const shouldFetch = url !== "" && isAllowed !== false;

    // STEP 1: Initialize state with synchronous cache check.
    // By reading the cache inside useState's lazy initializer we guarantee
    // that cached data is available from the very first render — no gap
    // between mount and effect, so no need for workarounds in the return.
    const [isLoadingData, setLoading] = useState(() => {
        if (!shouldFetch) return false;
        const cached = getUsableCacheEntry(url);
        if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
            return false; // cache hit → not loading
        }
        return true; // need to fetch
    });

    const [data, setData] = useState<dbDATA>(() => {
        if (!shouldFetch) return EMPTY_DATA;
        const cached = getUsableCacheEntry(url);
        if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
            return cached.data; // start with cached data immediately
        }
        return EMPTY_DATA;
    });
    const [dataUrl, setDataUrl] = useState(() => shouldFetch ? url : "");

    // STEP 2: Effect to handle URL changes and fetch data
    useEffect(() => {
        if (!shouldFetch) {
            // Reset to idle state when fetching is disabled (e.g. empty URL)
            setLoading(false); // eslint-disable-line react-hooks/set-state-in-effect
            setData(EMPTY_DATA);
            setDataUrl("");
            return;
        }

        let isMounted = true;

        // STEP 2a: Check cache before fetching
        const cached = getUsableCacheEntry(url);
        if (cached) {
            const age = Date.now() - cached.timestamp;

            if (age < CACHE_DURATION) {
                // Mark as most-recently-used so LRU eviction keeps hot entries
                touchCacheEntry(url);
                // Cache is valid — synchronous setState is intentional here:
                // this is a data-fetching hook that reads from an in-memory cache.
                if (isMounted) {
                    setData(cached.data);
                    setDataUrl(url);
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
            existingRequest.subscribers += 1;
            existingRequest.promise
                .then((fetchedData) => {
                    if (isMounted) {
                        if (fetchedData !== undefined) {
                            setData(fetchedData);
                            setDataUrl(url);
                        }
                        setLoading(false);
                    }
                });

            // Return cleanup function to prevent state updates after unmount
            return () => {
                isMounted = false;
                releaseInflightRequest(url, existingRequest);
            };
        }

        // STEP 2c: No cache, no in-flight request - create new fetch
        const abortController = new AbortController();
        const requestEntry: InflightRequest = {
            promise: Promise.resolve(undefined),
            controller: abortController,
            subscribers: 1,
        };

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
                        if (abortController.signal.aborted || isAbortError(e)) {
                            return undefined;
                        }
                        // Fallback to default message
                    }
                    console.log("Expected server error gracefully caught:", errorMSG);
                    return { error: errorMSG } as dbDATA;
                }
                let fetchedData: dbDATA;
                try {
                    fetchedData = await res.json() as dbDATA;
                } catch (parseErr) {
                    if (abortController.signal.aborted || isAbortError(parseErr)) {
                        return undefined;
                    }
                    console.error("Failed to parse JSON response from:", url, parseErr);
                    fetchedData = { error: "Invalid non-JSON response from server" } as dbDATA;
                }

                if (!responseMatchesRequest(url, fetchedData)) {
                    const actualRelation = fetchedData.relationName || "unknown";
                    fetchedData = {
                        error: `Discarded response for unexpected relation '${actualRelation}'.`,
                    } as dbDATA;
                }

                // STEP 5: Save to cache with size-bounded LRU (only if no error)
                if (!(fetchedData as any).error) {
                    const reportedLength = Number(
                        res.headers.get("X-Uncompressed-Length") ||
                        res.headers.get("Content-Length") ||
                        0
                    );
                    // Parsed JS arrays/objects need more memory than their JSON
                    // representation. The multiplier deliberately errs on the
                    // conservative side for cache eviction.
                    const estimatedHeapBytes = reportedLength > 0
                        ? Math.ceil(reportedLength * 2.5)
                        : 1024 * 1024;
                    storeInCache(url, fetchedData, estimatedHeapBytes);
                }
                return fetchedData;
            })
            .then((fetchedData) => {
                if (fetchedData === undefined) {
                    if (isMounted) {
                        setLoading(false);
                    }
                    return undefined;
                }

                // Update this component's state
                if (isMounted) {
                    setData(fetchedData);
                    setDataUrl(url);
                    setLoading(false);
                }

                // Return data for other components waiting on this promise
                return fetchedData;
            })
            .catch((error) => {
                // Handle errors
                if (abortController.signal.aborted || isAbortError(error)) {
                    return undefined; // Return undefined so waiters can detect abort
                } else {
                    const errorData: dbDATA = { error: `Fetch error: ${error.message}` } as dbDATA;
                    if (isMounted) {
                        setData(errorData);
                        setDataUrl(url);
                        setLoading(false);
                    }
                    console.error('Fetch error:', error);
                    return errorData; // Return error data instead of re-throwing
                }
            })
            .finally(() => {
                // STEP 6: Clean up in-flight request tracking
                if (inflightRequests.get(url) === requestEntry) {
                    inflightRequests.delete(url);
                }
            });

        // Store the promise so other components can wait for it
        requestEntry.promise = fetchPromise;
        inflightRequests.set(url, requestEntry);

        return () => {
            isMounted = false;
            releaseInflightRequest(url, requestEntry);
        };

    }, [url, shouldFetch]);

    if (!shouldFetch) return [false, EMPTY_DATA];
    if (dataUrl !== url) return [true, EMPTY_DATA];
    return [isLoadingData, data];
}

/**
 * Flushes all cached dataset responses from the global in-memory cache and resets byte counters.
 *
 * @remarks
 * Useful when the user triggers a explicit "Refresh Data" action, forcing fresh HTTP API fetches.
 *
 * @see {@link useGetJSONData}
 */
function clearDataCache() {
    dataCache.clear();
    cacheTotalBytes = 0;
}

/**
 * Removes a specific API endpoint URL entry from the global in-memory cache.
 *
 * @param url - The API endpoint URL to evict.
 *
 * @see {@link useGetJSONData}
 * @see {@link clearDataCache}
 */
function clearCacheForUrl(url: string) {
    removeCacheEntry(url);
}

/** Public client-data cache and retrieval API. */
export { useGetJSONData, clearDataCache, clearCacheForUrl };

