import { useEffect } from "react";

export function useCanvasScroll(
  canvasRef: React.RefObject<HTMLDivElement | null>,
) {
  // Load canvas scroll position from URL or center by default
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const params = new URLSearchParams(window.location.search);
      const scrollX = params.get("scrollX");
      const scrollY = params.get("scrollY");

      if (scrollX && scrollY) {
        canvas.scrollLeft = parseInt(scrollX, 10);
        canvas.scrollTop = parseInt(scrollY, 10);
      } else {
        canvas.scrollLeft = (canvas.scrollWidth - canvas.clientWidth) / 2;
        canvas.scrollTop = (canvas.scrollHeight - canvas.clientHeight) / 2;
      }
    }
  }, []);

  // Save canvas scroll position to URL query params (debounced)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let timeoutId: number;

    const handleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        const params = new URLSearchParams(window.location.search);
        params.set("scrollX", Math.round(canvas.scrollLeft).toString());
        params.set("scrollY", Math.round(canvas.scrollTop).toString());

        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({}, "", newUrl);
      }, 500);
    };

    canvas.addEventListener("scroll", handleScroll);
    return () => {
      canvas.removeEventListener("scroll", handleScroll);
      clearTimeout(timeoutId);
    };
  }, []);

  // Prevent trackpad swipe-to-navigate gestures at scroll boundaries
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const preventSwipeNavigation = (e: WheelEvent) => {
      const atLeftEdge = canvas.scrollLeft === 0 && e.deltaX < 0;
      const atRightEdge =
        canvas.scrollLeft >= canvas.scrollWidth - canvas.clientWidth &&
        e.deltaX > 0;

      if (atLeftEdge || atRightEdge) {
        e.preventDefault();
      }
    };

    canvas.addEventListener("wheel", preventSwipeNavigation, {
      passive: false,
    });
    return () => canvas.removeEventListener("wheel", preventSwipeNavigation);
  }, []);
}
