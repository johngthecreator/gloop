import { useState, useRef, useCallback } from "react";
import Toolbar from "../components/Toolbar/Toolbar";
import Canvas from "../components/Canvas/Canvas";
import ZoomControls from "../components/Canvas/ZoomControls";
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
  const [zoom, setZoom] = useState(1);
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
    zoom,
    updateStatus,
  });

  // Element CRUD + property toggles + paste
  const {
    handleAddTextbox,
    handleAddShape,
    // handleClearAll,
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
    handleRemoveBackground,
    handleCropImage,
    bgRemovalProcessingIds,
    handleSetShapeFillColor,
    handleStartShapeEyedropper,
    eyedropperTargetId,
  } = useCanvasElements({
    elements,
    setElements,
    selectedElementIds,
    setSelectedElementIds,
    updateElementsWithHistory,
    history,
    canvasRef,
    cursorPosition,
    zoom,
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

  const applyZoom = useCallback((computeNext: (prev: number) => number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const centerX = canvas.scrollLeft + canvas.clientWidth / 2;
    const centerY = canvas.scrollTop + canvas.clientHeight / 2;

    setZoom((prevZoom) => {
      const unclamped = computeNext(prevZoom);
      const nextZoom = Math.min(3, Math.max(0.25, unclamped));
      if (nextZoom === prevZoom) return prevZoom;

      requestAnimationFrame(() => {
        canvas.scrollLeft = (centerX * nextZoom / prevZoom) - canvas.clientWidth / 2;
        canvas.scrollTop = (centerY * nextZoom / prevZoom) - canvas.clientHeight / 2;
      });

      return nextZoom;
    });
  }, []);

  const handleZoomSnap = useCallback(
    (direction: "in" | "out") => {
      const step = 0.25;
      const epsilon = 1e-6;
      applyZoom((prev) => {
        if (direction === "in") {
          const up = Math.ceil((prev + epsilon) / step) * step;
          return up <= prev + epsilon ? prev + step : up;
        }
        const down = Math.floor((prev - epsilon) / step) * step;
        return down >= prev - epsilon ? prev - step : down;
      });
    },
    [applyZoom],
  );


  return (
    <>
      <Toolbar
        onAddTextbox={handleAddTextbox}
        onAddShape={handleAddShape}
        // onClearAll={handleClearAll}
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
        onRemoveBackground={handleRemoveBackground}
        onCropImage={handleCropImage}
        bgRemovalProcessingIds={bgRemovalProcessingIds}
        isDragging={isDragging}
        marqueeState={marqueeState}
        zoom={zoom}
        onSetShapeFillColor={handleSetShapeFillColor}
        onStartShapeEyedropper={handleStartShapeEyedropper}
        eyedropperTargetId={eyedropperTargetId}
      />

      <ZoomControls
        zoom={zoom}
        onZoomIn={() => handleZoomSnap("in")}
        onZoomOut={() => handleZoomSnap("out")}
      />
    </>
  );
}
