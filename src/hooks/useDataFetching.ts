import { useState, useEffect, useRef, useCallback } from 'react';

// Track ongoing requests to prevent duplicate calls
const pendingRequests: Record<string, Promise<any>> = {};

interface FetchOptions {
  onError?: (error: Error) => void; // Custom error handler
}

export function useDataFetching<T>(url: string, options: FetchOptions = {}) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const isMounted = useRef(true);
  const requestTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const fetchData = useCallback(async () => {
    if (!url) {
      console.log(`useDataFetching: fetchData aborted for ${url} - URL is empty`);
      return;
    }
    
    console.log(`useDataFetching: fetchData CALLED for ${url}`);
    
    if (requestTimeoutRef.current) {
      console.log(`useDataFetching: Clearing PREVIOUS timeout for ${url}`);
      clearTimeout(requestTimeoutRef.current);
    }
    
    requestTimeoutRef.current = setTimeout(async () => {
      console.log(`useDataFetching: setTimeout EXECUTING for ${url}`);
      const cacheKey = url; // Still used for pendingRequests key
      
      if (pendingRequests[cacheKey]) {
        console.log(`useDataFetching: Request ALREADY IN PROGRESS for ${url}, awaiting existing promise.`);
        try {
          const result = await pendingRequests[cacheKey];
          if (isMounted.current) {
            console.log(`useDataFetching: Existing pending request for ${url} COMPLETED. isMounted: true. Setting data. Result length: ${Array.isArray(result) ? result.length : 'N/A'}`);
            setData(result);
            // setIsLoading(false) should be handled by the original promise's chain.
          } else {
            console.log(`useDataFetching: Existing pending request for ${url} COMPLETED, but component UNMOUNTED.`);
          }
          return;
        } catch (err) {
          console.warn(`useDataFetching: Existing pending request for ${url} FAILED. Error:`, err, `Proceeding to make a new request.`);
        }
      }
      
      console.log(`useDataFetching: Setting isLoading = true for ${url}. isMounted.current: ${isMounted.current}`);
      if(isMounted.current) setIsLoading(true);
      if(isMounted.current) setError(null); // Reset error state
      
      console.log(`useDataFetching: Making NEW fetch request to ${url}`);
      
      const fetchPromise = (async () => {
        try {
          console.log(`useDataFetching: fetchPromise - Awaiting fetch for ${url}`);
          const response = await fetch(url);
          console.log(`useDataFetching: fetchPromise - Received response from ${url}, status: ${response.status}`);
          
          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Failed to get error text');
            console.error(`useDataFetching: fetchPromise - API request FAILED for ${url}. Status: ${response.status}. Body: ${errorText}`);
            throw new Error(`API request failed for ${url} with status ${response.status}. Body: ${errorText}`);
          }
          
          const result = await response.json();
          console.log(`useDataFetching: fetchPromise - Parsed JSON result from ${url}. Result length: ${Array.isArray(result) ? result.length : 'N/A'}`);
          return result;
        } finally {
          console.log(`useDataFetching: fetchPromise - FINALLY block for ${url}. Deleting pendingRequest.`);
          delete pendingRequests[cacheKey];
        }
      })();
      
      pendingRequests[cacheKey] = fetchPromise;
      
      try {
        const result = await fetchPromise;
        if (isMounted.current) {
          console.log(`useDataFetching: Fetch successful for ${url}. isMounted: true. Setting data. Result length: ${Array.isArray(result) ? result.length : 'N/A'}`);
          setData(result);
          console.log(`useDataFetching: Fetch successful for ${url}. isMounted: true. Setting isLoading = false.`);
          setIsLoading(false);
        } else {
          console.log(`useDataFetching: Fetch successful for ${url}, but component UNMOUNTED. Not updating state.`);
        }
      } catch (err) {
        const currentError = err instanceof Error ? err : new Error('An unknown error occurred');
        if (isMounted.current) {
          console.error(`useDataFetching: Error during fetch for ${url}. isMounted: true. Error:`, currentError.message);
          setError(currentError);
          console.log(`useDataFetching: Error during fetch for ${url}. isMounted: true. Setting isLoading = false.`);
          setIsLoading(false);
        } else {
          console.log(`useDataFetching: Error during fetch for ${url}, but component UNMOUNTED. Error:`, currentError.message);
        }
      }
    }, 50);
  }, [url, options.onError]);

  useEffect(() => {
    console.log(`useDataFetching: Main useEffect TRIGGERED for ${url}. isMounted.current at start of effect: ${isMounted.current}`);
    isMounted.current = true; // Ensure isMounted is true when effect runs
    fetchData();
    
    return () => {
      console.log(`useDataFetching: Main useEffect CLEANUP for ${url}. Clearing timeoutRef. Setting isMounted = false.`);
      if (requestTimeoutRef.current) {
        clearTimeout(requestTimeoutRef.current);
      }
      isMounted.current = false;
    };
  }, [fetchData, url]); // Added url to dependencies as fetchData depends on it.

  console.log(`useDataFetching: Hook rendering for ${url}. isLoading: ${isLoading}, data is null: ${data === null}, error is null: ${error === null}`);
  return { data, isLoading, error, refetch: fetchData }; // Return fetchData directly for refetch
} 