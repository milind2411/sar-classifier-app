import { useEffect } from 'react';

/**
 * Updates document.title on mount/update and restores previous title on unmount.
 * @param {string} title - The desired page title
 */
export function useDocumentTitle(title) {
  useEffect(() => {
    const prevTitle = document.title;
    if (title) {
      document.title = title;
    }
    return () => {
      document.title = prevTitle;
    };
  }, [title]);
}

export default useDocumentTitle;
