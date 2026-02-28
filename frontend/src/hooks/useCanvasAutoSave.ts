import { useEffect } from "react";
import type { CanvasElementData } from "../types/canvas";

interface UseCanvasAutoSaveParams {
  elements: CanvasElementData[];
  saveElements: (elements: CanvasElementData[]) => Promise<void>;
}

export function useCanvasAutoSave({
  elements,
  saveElements,
}: UseCanvasAutoSaveParams) {
  // Auto-save elements to Dexie whenever they change (debounced)
  useEffect(() => {
    if (elements.length > 0) {
      const timeoutId = setTimeout(() => {
        saveElements(elements);
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [elements, saveElements]);
}
