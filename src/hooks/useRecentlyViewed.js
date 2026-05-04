import { useState, useCallback } from 'react';

const STORAGE_KEY = 'larrys_recently_viewed';
const MAX_ITEMS = 20;

/**
 * Custom hook for tracking recently viewed listing IDs in localStorage.
 * Used in the customer bento-box homepage.
 */
export function useRecentlyViewed() {
  const [recentIds, setRecentIds] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const addViewed = useCallback((listingId) => {
    setRecentIds(prev => {
      const id = Number(listingId);
      const filtered = prev.filter(i => i !== id);
      const updated = [id, ...filtered].slice(0, MAX_ITEMS);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // localStorage full — ignore
      }
      return updated;
    });
  }, []);

  const clearViewed = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setRecentIds([]);
  }, []);

  return { recentIds, addViewed, clearViewed };
}
