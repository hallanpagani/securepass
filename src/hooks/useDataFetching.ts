import { useState, useEffect, useRef, useCallback } from 'react';

// Cache for storing API responses
const apiCache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_DURATION = 30000; // Increase to 30 seconds (from 10 seconds)

// Track ongoing requests to prevent duplicate calls
const pendingRequests: Record<string, Promise<any>> = {};

interface FetchOptions {
  cacheDuration?: number; // Custom cache duration in milliseconds
  forceRefresh?: boolean; // Force refresh even if cache is valid
  onError?: (error: Error) => void; // Custom error handler
}

export function useDataFetching<T>(url: string, options: FetchOptions = {}) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const isMounted = useRef(true);
  const requestTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Cache duration from options or default
  const cacheDuration = options.cacheDuration ?? CACHE_DURATION;

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!url) return;
    
    // Clear any pending timeout
    if (requestTimeoutRef.current) {
      clearTimeout(requestTimeoutRef.current);
    }
    
    // Debounce the request by 50ms to prevent multiple rapid calls
    requestTimeoutRef.current = setTimeout(async () => {
      const currentTime = Date.now();
      const cacheKey = url;
      const cachedData = apiCache[cacheKey];
      
      // Use cache if available and not expired, unless force refresh is requested
      if (!forceRefresh && 
          cachedData && 
          currentTime - cachedData.timestamp < cacheDuration) {
        setData(cachedData.data);
        return;
      }
      
      // Check if there's already a pending request for this URL
      if (pendingRequests[cacheKey]) {
        try {
          // Re-use the in-flight request instead of starting a new one
          const result = await pendingRequests[cacheKey];
          if (isMounted.current) {
            setData(result);
          }
          return;
        } catch (err) {
          // Continue with a new request if the pending one failed
        }
      }
      
      setIsLoading(true);
      setError(null);
      
      // Create a new request and store it in pendingRequests
      const fetchPromise = (async () => {
        try {
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
          }
          
          const result = await response.json();
          
          // Cache the result
          apiCache[cacheKey] = {
            data: result,
            timestamp: Date.now()
          };
          
          return result;
        } finally {
          // Remove from pending requests after completion (success or error)
          setTimeout(() => {
            delete pendingRequests[cacheKey];
          }, 0);
        }
      })();
      
      // Store the promise
      pendingRequests[cacheKey] = fetchPromise;
      
      try {
        const result = await fetchPromise;
        
        // Only update state if component is still mounted
        if (isMounted.current) {
          setData(result);
          setIsLoading(false);
        }
      } catch (err) {
        // Only update state if component is still mounted
        if (isMounted.current) {
          const error = err instanceof Error ? err : new Error('An unknown error occurred');
          setError(error);
          setIsLoading(false);
          
          // Call custom error handler if provided
          if (options.onError) {
            options.onError(error);
          }
        }
      }
    }, 50); // 50ms debounce
  }, [url, cacheDuration, options.onError]);

  // Fetch data on mount or when url/options change
  useEffect(() => {
    fetchData(options.forceRefresh);
    
    return () => {
      isMounted.current = false;
      if (requestTimeoutRef.current) {
        clearTimeout(requestTimeoutRef.current);
      }
    };
  }, [fetchData, options.forceRefresh]);

  // Return data, loading state, error, and a function to manually refresh
  return { data, isLoading, error, refetch: () => fetchData(true) };
} 