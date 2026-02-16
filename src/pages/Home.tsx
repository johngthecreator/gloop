import { useState, useRef } from "react";
import Toolbar from "../components/Toolbar/Toolbar";
import Canvas from "../components/Canvas/Canvas";
import Settings from "../components/Settings/Settings";
import { useDexieElements } from "../hooks/useDexieElements";
import { useCanvasHistory } from "../hooks/useCanvasHistory";
import { useCanvasElements } from "../hooks/useCanvasElements";
import { useCanvasInteractions } from "../hooks/useCanvasInteractions";
import { useCanvasKeyboard } from "../hooks/useCanvasKeyboard";
import { useCanvasScroll } from "../hooks/useCanvasScroll";
import { useCanvasAutoSave } from "../hooks/useCanvasAutoSave";
import type { StatusState } from "../types/canvas";

export type { MarqueeState } from "../types/canvas";

export default function Home() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [, setStatusState] = useState<StatusState>({
    message: "Ready",
    type: "info",
  });

  const updateStatus = (
    message: string,
    type: "info" | "success" | "error" | "warning" = "info",
  ) => {
    setStatusState({ message, type });
  };

  // Core state + history management
  const {
    elements,
    setElements,
    selectedElementIds,
    setSelectedElementIds,
    history,
    historyIndex,
    updateElementsWithHistory,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
    handleLoadElements,
  } = useCanvasHistory();

  // Persistence (IndexedDB)
  const { saveElements } = useDexieElements(elements, handleLoadElements);

  // Mouse interactions (drag, marquee, rotate)
  const {
    isDragging,
    marqueeState,
    cursorPosition,
    handleElementMouseDown,
    handleCanvasMouseDown,
    handleCanvasClick,
    handleRotateHandleMouseDown,
  } = useCanvasInteractions({
    elements,
    selectedElementIds,
    setSelectedElementIds,
    updateElementsWithHistory,
    canvasRef,
    updateStatus,
  });

  // Element CRUD + property toggles + paste
  const {
    handleAddTextbox,
    handleClearAll,
    handleElementContentChange,
    handleElementFocus,
    handleElementBlur,
    handleElementSelect,
    handleToggleFont,
    handleToggleItalic,
    handleToggleTextColor,
    handleRotate,
    handleMeasure,
    handleCleanupUnreferencedImages,
  } = useCanvasElements({
    elements,
    setElements,
    selectedElementIds,
    setSelectedElementIds,
    updateElementsWithHistory,
    history,
    canvasRef,
    cursorPosition,
    updateStatus,
  });

  // Keyboard shortcuts (delete, undo, redo)
  useCanvasKeyboard({
    selectedElementIds,
    setSelectedElementIds,
    elements,
    historyIndex,
    history,
    handleUndo,
    handleRedo,
    updateElementsWithHistory,
    updateStatus,
  });

  // Scroll position persistence + swipe prevention
  useCanvasScroll(canvasRef);

  // Auto-save to IndexedDB
  useCanvasAutoSave({ elements, saveElements });

  return (
    <>
      <Toolbar
        onAddTextbox={handleAddTextbox}
        onClearAll={handleClearAll}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {settingsOpen && (
        <Settings
          onClose={() => setSettingsOpen(false)}
          onCleanupImages={handleCleanupUnreferencedImages}
        />
      )}

      <Canvas
        ref={canvasRef}
        elements={elements}
        selectedElementIds={selectedElementIds}
        onElementContentChange={handleElementContentChange}
        onElementFocus={handleElementFocus}
        onElementBlur={handleElementBlur}
        onElementSelect={handleElementSelect}
        onCanvasClick={handleCanvasClick}
        onCanvasMouseDown={handleCanvasMouseDown}
        onElementMouseDown={handleElementMouseDown}
        onRotateHandleMouseDown={handleRotateHandleMouseDown}
        onMeasure={handleMeasure}
        onRotate={handleRotate}
        onToggleFont={handleToggleFont}
        onToggleItalic={handleToggleItalic}
        onToggleTextColor={handleToggleTextColor}
        isDragging={isDragging}
        marqueeState={marqueeState}
      />
    </>
  );
}
