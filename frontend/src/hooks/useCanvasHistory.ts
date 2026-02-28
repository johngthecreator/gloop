import { useState, useCallback } from "react";
import type { CanvasElementData } from "../types/canvas";

export function useCanvasHistory() {
  const [elements, setElements] = useState<CanvasElementData[]>([]);
  const [selectedElementIds, setSelectedElementIds] = useState<Set<string>>(
    new Set(),
  );
  const [history, setHistory] = useState<CanvasElementData[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Update elements and push to history stack
  const updateElementsWithHistory = (newElements: CanvasElementData[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newElements);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setElements(newElements);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setElements(history[newIndex]);
      setSelectedElementIds(new Set());
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setElements(history[newIndex]);
      setSelectedElementIds(new Set());
    }
  };

  const handleLoadElements = useCallback(
    (loadedElements: CanvasElementData[]) => {
      setElements(loadedElements);
      setHistory([loadedElements]);
      setHistoryIndex(0);
    },
    [],
  );

  return {
    elements,
    setElements,
    selectedElementIds,
    setSelectedElementIds,
    history,
    historyIndex,
    updateElementsWithHistory,
    handleUndo,
    handleRedo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    handleLoadElements,
  };
}
