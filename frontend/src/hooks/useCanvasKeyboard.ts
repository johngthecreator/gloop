import { useEffect } from "react";
import type { CanvasElementData } from "../types/canvas";

interface UseCanvasKeyboardParams {
  selectedElementIds: Set<string>;
  setSelectedElementIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  elements: CanvasElementData[];
  historyIndex: number;
  history: CanvasElementData[][];
  handleUndo: () => void;
  handleRedo: () => void;
  updateElementsWithHistory: (newElements: CanvasElementData[]) => void;
  updateStatus: (
    message: string,
    type?: "info" | "success" | "error" | "warning",
  ) => void;
}

export function useCanvasKeyboard({
  selectedElementIds,
  setSelectedElementIds,
  elements,
  historyIndex,
  history,
  handleUndo,
  handleRedo,
  updateElementsWithHistory,
  updateStatus,
}: UseCanvasKeyboardParams) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete selected elements
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedElementIds.size > 0
      ) {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl as HTMLElement).isContentEditable) return;
        if (document.querySelector('[data-crop-active]')) return;

        e.preventDefault();
        const newElements = elements.filter(
          (el) => !selectedElementIds.has(el.id),
        );
        updateElementsWithHistory(newElements);
        setSelectedElementIds(new Set());
        updateStatus(
          selectedElementIds.size === 1
            ? "Element deleted"
            : `${selectedElementIds.size} elements deleted`,
          "success",
        );
        return;
      }

      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Ctrl+Shift+Z or Cmd+Shift+Z for redo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Ctrl+Y or Cmd+Y for redo
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        handleRedo();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedElementIds, elements, historyIndex, history]);
}
