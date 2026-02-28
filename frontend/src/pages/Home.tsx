import { useState, useRef, useCallback, useEffect } from "react";
import Toolbar from "../components/Toolbar/Toolbar";
import Canvas from "../components/Canvas/Canvas";
import ZoomControls from "../components/Canvas/ZoomControls";
import PeerCursor from "../components/Canvas/PeerCursor";
import Settings from "../components/Settings/Settings";
import { useDexieElements } from "../hooks/useDexieElements";
import { useCanvasHistory } from "../hooks/useCanvasHistory";
import { useCanvasElements } from "../hooks/useCanvasElements";
import { useCanvasInteractions } from "../hooks/useCanvasInteractions";
import { useCanvasKeyboard } from "../hooks/useCanvasKeyboard";
import { useCanvasScroll } from "../hooks/useCanvasScroll";
import { useCanvasAutoSave } from "../hooks/useCanvasAutoSave";
import { useWebRTC } from "../hooks/useWebRTC";
import { useCoopCanvas } from "../hooks/useCoopCanvas";
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

  // Co-op room state — pre-fill from ?room= query param if present
  const initialRoomId = new URLSearchParams(window.location.search).get("room") ?? "";
  const [roomId, setRoomId] = useState(initialRoomId);
  const [signalingUrl, setSignalingUrl] = useState("ws://localhost:8787");
  const [peerCursorPos, setPeerCursorPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const lastCursorSendRef = useRef(0);

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

  // ── Co-op (WebRTC) ──────────────────────────────────────────────────
  const {
    connected: coopConnected,
    hosting: coopHosting,
    isHost: coopIsHost,
    sendEvent,
    onEvent,
    connect: coopConnect,
    disconnect: coopDisconnect,
  } = useWebRTC({ signalingUrl, roomId });

  const { peerCursorRef } = useCoopCanvas({
    elements,
    updateElementsWithHistory,
    sendEvent,
    onEvent,
    connected: coopConnected,
  });

  // Auto-connect when page is opened via a shared invite link (?room=XXXXX).
  // Runs only once on mount; clears the query param so the URL stays clean.
  useEffect(() => {
    if (initialRoomId) {
      coopConnect();
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Broadcast local cursor position to peer (throttled ~60fps)
  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!coopConnected) return;
      const now = performance.now();
      if (now - lastCursorSendRef.current < 16) return;
      lastCursorSendRef.current = now;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left + canvas.scrollLeft) / zoom;
      const y = (e.clientY - rect.top + canvas.scrollTop) / zoom;
      sendEvent({ type: "cursor", peerId: "local", x, y });
    },
    [coopConnected, sendEvent, zoom],
  );

  // Sync peer cursor ref into state so we re-render when it moves.
  useEffect(() => {
    if (!coopConnected) return;
    const id = setInterval(() => {
      const c = peerCursorRef.current;
      setPeerCursorPos((prev) => {
        if (!c && !prev) return prev;
        if (c && prev && c.x === prev.x && c.y === prev.y) return prev;
        return c ? { x: c.x, y: c.y } : null;
      });
    }, 50);
    return () => clearInterval(id);
  }, [coopConnected, peerCursorRef]);

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
          coop={{
            connected: coopConnected,
            hosting: coopHosting,
            isHost: coopIsHost,
            roomId,
            signalingUrl,
            onRoomIdChange: setRoomId,
            onSignalingUrlChange: setSignalingUrl,
            onConnect: coopConnect,
            onDisconnect: coopDisconnect,
          }}
        />
      )}

      <div style={{ position: "relative" }} onMouseMove={handleCanvasMouseMove}>
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
        <PeerCursor position={peerCursorPos} />
      </div>

      <ZoomControls
        zoom={zoom}
        onZoomIn={() => handleZoomSnap("in")}
        onZoomOut={() => handleZoomSnap("out")}
      />
    </>
  );
}
