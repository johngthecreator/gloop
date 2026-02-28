import { useEffect, useRef } from 'react';

export function useAutoSizing(
  elementId: string,
  contentRef: React.RefObject<HTMLDivElement | null>,
  onMeasure?: (width: number, height: number) => void,
  enabled: boolean = true
) {
  const observerRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    if (!enabled || !contentRef.current || !onMeasure) return;

    // Create observer to watch content dimensions
    observerRef.current = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const { width, height } = entry.contentRect;
        onMeasure(width, height);
      });
    });

    observerRef.current.observe(contentRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [elementId, enabled, onMeasure]);
}
