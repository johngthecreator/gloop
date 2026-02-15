import { useState, useRef, useEffect, useCallback } from "react";
import Toolbar from "../components/Toolbar/Toolbar";
import Canvas from "../components/Canvas/Canvas";
import Settings from "../components/Settings/Settings";
import type { CanvasElementData } from "../components/Canvas/CanvasElement";
import { useDexieElements } from "../hooks/useDexieElements";
import { db } from "../db";

interface StatusState {
  message: string;
  type: "info" | "success" | "error" | "warning";
}

interface DragState {
  elementId: string | null;
  startX: number;
  startY: number;
  elementStartX: number;
  elementStartY: number;
}

interface RotateState {
  elementId: string;
  centerX: number;
  centerY: number;
  startAngle: number;
  startDistance: number;
  elementStartRotation: number;
  elementStartWidth?: number;
  elementStartHeight?: number;
  elementStartFontSize?: number;
}

export default function Home() {
  const [elements, setElements] = useState<CanvasElementData[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<
    string | undefined
  >();
  const [statusState, setStatusState] = useState<StatusState>({
    message: "Ready",
    type: "info",
  });
  const [history, setHistory] = useState<CanvasElementData[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ x: 50, y: 50 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragPositionRef = useRef<{
    elementId: string;
    x: number;
    y: number;
  } | null>(null);
  const draggedElementRef = useRef<HTMLElement | null>(null);
  const rotateStateRef = useRef<RotateState | null>(null);
  const pendingRotationRef = useRef<number | null>(null);
  const pendingSizeRef = useRef<{
    width?: number;
    height?: number;
    fontSize?: number;
  } | null>(null);

  // Update status
  const updateStatus = (
    message: string,
    type: "info" | "success" | "error" | "warning" = "info",
  ) => {
    setStatusState({ message, type });
  };

  // Load elements from Dexie on mount
  const handleLoadElements = useCallback(
    (loadedElements: CanvasElementData[]) => {
      setElements(loadedElements);
      setHistory([loadedElements]);
      setHistoryIndex(0);
    },
    [],
  );

  const { saveElements } = useDexieElements(elements, handleLoadElements);

  // Cleanup unreferenced images (images in Dexie not referenced by any history entry)
  const handleCleanupUnreferencedImages = useCallback(async () => {
    // Collect all image IDs referenced across every history entry
    const referencedIds = new Set<string>();
    for (const entry of history) {
      for (const el of entry) {
        if (el.type === "image") {
          referencedIds.add(el.id);
        }
      }
    }

    // Get all stored blobs
    const storedBlobs = await db.imageBlobs.toArray();
    let cleanedCount = 0;

    for (const blob of storedBlobs) {
      if (!referencedIds.has(blob.id)) {
        // Revoke any object URL that might exist for this blob
        // (find it from current elements or history entries)
        for (const entry of history) {
          const el = entry.find((e) => e.id === blob.id);
          if (el?.src?.startsWith("blob:")) {
            URL.revokeObjectURL(el.src);
          }
        }
        try {
          await db.imageBlobs.delete(blob.id);
          cleanedCount++;
        } catch (error) {
          console.error("Failed to delete image blob:", error);
        }
      }
    }

    return cleanedCount;
  }, [history]);

  // Add a new textbox
  const handleAddTextbox = () => {
    const newId = `textbox-${Date.now()}`;

    // Calculate center of current viewport
    const canvas = canvasRef.current;
    const x = canvas
      ? canvas.scrollLeft + canvas.clientWidth / 2
      : 5000 + elements.length * 10;
    const y = canvas
      ? canvas.scrollTop + canvas.clientHeight / 2
      : 5000 + elements.length * 10;

    const newElement: CanvasElementData = {
      id: newId,
      type: "textbox",
      x,
      y,
      content: "Edit this text",
      rotation: 0,
      fontSize: 16,
    };

    const newElements = [...elements, newElement];
    updateElementsWithHistory(newElements);
    setSelectedElementId(newId);
    updateStatus("Textbox added", "success");
  };

  // Clear all elements
  const handleClearAll = () => {
    if (elements.length === 0) {
      updateStatus("Canvas is already empty", "info");
      return;
    }

    if (window.confirm("Are you sure you want to clear all elements?")) {
      updateElementsWithHistory([]);
      setSelectedElementId(undefined);
      updateStatus("Canvas cleared", "success");
    }
  };

  // Handle element content change
  const handleElementContentChange = (id: string, content: string) => {
    const newElements = elements.map((el) =>
      el.id === id ? { ...el, content } : el,
    );
    setElements(newElements);
  };

  // Handle element focus
  const handleElementFocus = (id: string) => {
    setSelectedElementId(id);
  };

  // Handle element blur - delete empty textboxes
  const handleElementBlur = (id: string) => {
    const element = elements.find((el) => el.id === id);

    // Delete if empty textbox
    if (element && element.type === "textbox" && !element.content?.trim()) {
      const newElements = elements.filter((el) => el.id !== id);
      updateElementsWithHistory(newElements);
      updateStatus("Empty textbox deleted", "info");

      if (selectedElementId === id) {
        setSelectedElementId(undefined);
      }
    }
  };

  // Handle element selection (for images and canvas clicks)
  const handleElementSelect = (id: string) => {
    setSelectedElementId(id);
  };

  // Handle font toggle
  const handleToggleFont = (id: string) => {
    const newElements = elements.map((el) => {
      if (el.id === id) {
        const current = el.fontFamily || 'sans';
        return { ...el, fontFamily: current === 'sans' ? 'comic-sans' as const : 'sans' as const };
      }
      return el;
    });
    updateElementsWithHistory(newElements);
  };

  // Handle italic toggle
  const handleToggleItalic = (id: string) => {
    const newElements = elements.map((el) => {
      if (el.id === id) {
        return { ...el, italic: !el.italic };
      }
      return el;
    });
    updateElementsWithHistory(newElements);
  };

  // Handle text color toggle
  const handleToggleTextColor = (id: string) => {
    const newElements = elements.map((el) => {
      if (el.id === id) {
        const current = el.textColor || "black";
        return {
          ...el,
          textColor: current === "black" ? ("white" as const) : ("black" as const),
        };
      }
      return el;
    });
    updateElementsWithHistory(newElements);
  };

  // Handle canvas click to deselect
  const handleCanvasClick = () => {
    setSelectedElementId(undefined);
  };

  // Handle paste event for images
  const handlePaste = (e: ClipboardEvent) => {
    const clipboardItems = e.clipboardData?.items || [];

    for (let i = 0; i < clipboardItems.length; i++) {
      const item = clipboardItems[i];

      if (item.type.indexOf("image") !== -1) {
        e.preventDefault();
        handlePasteImage(item);
        break;
      }
    }
  };

  // Handle pasting image from clipboard
  const handlePasteImage = async (item: DataTransferItem) => {
    updateStatus("Processing image...", "info");

    try {
      const file = item.getAsFile();
      if (!file) throw new Error("Could not extract file");

      const newId = `image-${Date.now()}`;

      // Store blob in Dexie
      await db.imageBlobs.put({
        id: newId,
        blob: file,
        storedAt: Date.now(),
      });

      // Create object URL for rendering (lightweight!)
      const objectUrl = URL.createObjectURL(file);

      // Create image element to get dimensions
      const img = new Image();
      img.onload = () => {
        const newElement: CanvasElementData = {
          id: newId,
          type: "image",
          x: cursorPosition.x,
          y: cursorPosition.y,
          width: Math.min(img.naturalWidth, 400),
          height: Math.min(img.naturalHeight, 300),
          rotation: 0,
          src: objectUrl, // Use object URL instead of data URL
        };

        const newElements = [...elements, newElement];
        updateElementsWithHistory(newElements);
        setSelectedElementId(newElement.id);
        updateStatus("Image pasted successfully", "success");
      };
      img.src = objectUrl;
    } catch (err) {
      updateStatus("Failed to paste image", "error");
    }
  };

  // Update elements and manage history
  const updateElementsWithHistory = (newElements: CanvasElementData[]) => {
    // Remove future history if we're not at the end
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newElements);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setElements(newElements);
  };

  // Undo
  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setElements(history[newIndex]);
      setSelectedElementId(undefined);
      updateStatus("Undone", "info");
    }
  };

  // Redo
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setElements(history[newIndex]);
      setSelectedElementId(undefined);
      updateStatus("Redone", "info");
    }
  };

  // Handle delete key
  const handleKeyDown = (e: KeyboardEvent) => {
    // Delete selected element
    if ((e.key === "Delete" || e.key === "Backspace") && selectedElementId) {
      // Don't delete if user is editing text in a contentEditable
      const activeEl = document.activeElement;
      if (activeEl && (activeEl as HTMLElement).isContentEditable) return;

      e.preventDefault();
      const newElements = elements.filter((el) => el.id !== selectedElementId);
      updateElementsWithHistory(newElements);
      setSelectedElementId(undefined);
      updateStatus("Element deleted", "success");
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

  // Setup keyboard event listener
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedElementId, elements, historyIndex, history]);

  // Setup paste event listener
  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [elements, cursorPosition]);

  // Load canvas scroll position from URL or center by default
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const params = new URLSearchParams(window.location.search);
      const scrollX = params.get("scrollX");
      const scrollY = params.get("scrollY");

      if (scrollX && scrollY) {
        // Restore from URL
        canvas.scrollLeft = parseInt(scrollX, 10);
        canvas.scrollTop = parseInt(scrollY, 10);
      } else {
        // Default to center of the large canvas
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
    const preventSwipeNavigation = (e: WheelEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const atLeftEdge = canvas.scrollLeft === 0 && e.deltaX < 0;
      const atRightEdge =
        canvas.scrollLeft >= canvas.scrollWidth - canvas.clientWidth &&
        e.deltaX > 0;

      // Only prevent default at scroll boundaries to stop browser navigation
      if (atLeftEdge || atRightEdge) {
        e.preventDefault();
      }
    };

    const canvas = canvasRef.current;
    if (canvas) {
      // Use passive: false to allow preventDefault
      canvas.addEventListener("wheel", preventSwipeNavigation, {
        passive: false,
      });
      return () => canvas.removeEventListener("wheel", preventSwipeNavigation);
    }
  }, []);

  // Disable text selection while actively dragging
  useEffect(() => {
    if (isDragging) {
      document.body.style.userSelect = "none";
    } else {
      document.body.style.userSelect = "";
    }
    return () => {
      document.body.style.userSelect = "";
    };
  }, [isDragging]);

  // Track cursor position and handle dragging with single event listener
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Handle rotation and resize drag
      if (rotateStateRef.current) {
        const rs = rotateStateRef.current;
        const currentAngle = Math.atan2(
          e.clientY - rs.centerY,
          e.clientX - rs.centerX,
        );
        const currentDistance = Math.sqrt(
          Math.pow(e.clientX - rs.centerX, 2) +
            Math.pow(e.clientY - rs.centerY, 2),
        );

        // Calculate rotation
        const deltaAngle = (currentAngle - rs.startAngle) * (180 / Math.PI);
        const newRotation = rs.elementStartRotation + deltaAngle;

        // Calculate size scale factor
        const scaleFactor = currentDistance / rs.startDistance;

        const element = elements.find((el) => el.id === rs.elementId);
        if (!element) return;

        const domEl = document.querySelector(
          `[data-element-id="${rs.elementId}"]`,
        ) as HTMLElement;

        if (element.type === "image") {
          // Scale image dimensions
          const newWidth = Math.max(
            50,
            (rs.elementStartWidth || 200) * scaleFactor,
          );
          const newHeight = Math.max(
            50,
            (rs.elementStartHeight || 200) * scaleFactor,
          );

          if (domEl) {
            domEl.style.transform = `rotate(${newRotation}deg)`;
            domEl.style.width = `${newWidth}px`;
            domEl.style.height = `${newHeight}px`;
          }

          pendingSizeRef.current = { width: newWidth, height: newHeight };
        } else if (element.type === "textbox") {
          // Scale font size
          const newFontSize = Math.max(
            8,
            Math.min(200, (rs.elementStartFontSize || 16) * scaleFactor),
          );

          if (domEl) {
            domEl.style.transform = `rotate(${newRotation}deg)`;
            const contentDiv = domEl.querySelector(
              "[contenteditable]",
            ) as HTMLElement;
            if (contentDiv) {
              contentDiv.style.fontSize = `${newFontSize}px`;
            }
          }

          pendingSizeRef.current = { fontSize: newFontSize };
        }

        pendingRotationRef.current = newRotation;
        return;
      }

      // Drag threshold: only start dragging if moved more than 5 pixels
      if (dragState && !isDragging) {
        const deltaX = e.clientX - dragState.startX;
        const deltaY = e.clientY - dragState.startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // Only activate drag if threshold exceeded
        if (distance > 5) {
          setIsDragging(true);
        } else {
          // Below threshold, just update cursor position
          if (canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            setCursorPosition({
              x: e.clientX - rect.left + canvasRef.current.scrollLeft,
              y: e.clientY - rect.top + canvasRef.current.scrollTop,
            });
          }
          return;
        }
      }

      // Handle dragging with smooth mousemove (not dragover)
      if (isDragging && dragState) {
        const deltaX = e.clientX - dragState.startX;
        const deltaY = e.clientY - dragState.startY;

        // Use CSS transform for instant visual feedback (no re-render)
        const draggedElement = document.querySelector(
          `[data-element-id="${dragState.elementId}"]`,
        ) as HTMLElement;
        if (draggedElement) {
          // Preserve element rotation during drag
          const element = elements.find((el) => el.id === dragState.elementId);
          const rotation = element?.rotation || 0;
          draggedElement.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0) rotate(${rotation}deg)`;
          draggedElementRef.current = draggedElement;
        }

        // Update ref position for drop
        dragPositionRef.current = {
          elementId: dragState.elementId as string,
          x: Math.max(0, dragState.elementStartX + deltaX),
          y: Math.max(0, dragState.elementStartY + deltaY),
        };
      } else if (!dragState) {
        // Only update cursor position when NOT waiting to drag
        if (canvasRef.current) {
          const rect = canvasRef.current.getBoundingClientRect();
          setCursorPosition({
            x: e.clientX - rect.left + canvasRef.current.scrollLeft,
            y: e.clientY - rect.top + canvasRef.current.scrollTop,
          });
        }
      }
    };

    const handleMouseUp = () => {
      // Commit rotation and resize if rotating/resizing
      if (rotateStateRef.current && pendingRotationRef.current !== null) {
        const rs = rotateStateRef.current;
        const finalRotation = pendingRotationRef.current % 360;
        const newElements = elements.map((el) => {
          if (el.id === rs.elementId) {
            const updates: Partial<CanvasElementData> = {
              rotation: finalRotation,
            };
            if (pendingSizeRef.current) {
              if (pendingSizeRef.current.width !== undefined) {
                updates.width = pendingSizeRef.current.width;
              }
              if (pendingSizeRef.current.height !== undefined) {
                updates.height = pendingSizeRef.current.height;
              }
              if (pendingSizeRef.current.fontSize !== undefined) {
                updates.fontSize = pendingSizeRef.current.fontSize;
              }
            }
            return { ...el, ...updates };
          }
          return el;
        });
        updateElementsWithHistory(newElements);
        updateStatus("Element transformed", "success");

        // Clean up DOM overrides
        const domEl = document.querySelector(
          `[data-element-id="${rs.elementId}"]`,
        ) as HTMLElement;
        if (domEl) {
          domEl.style.width = "";
          domEl.style.height = "";
          const contentDiv = domEl.querySelector(
            "[contenteditable]",
          ) as HTMLElement;
          if (contentDiv) {
            contentDiv.style.fontSize = "";
          }
        }

        rotateStateRef.current = null;
        pendingRotationRef.current = null;
        pendingSizeRef.current = null;
        return;
      }
      if (rotateStateRef.current) {
        rotateStateRef.current = null;
        pendingRotationRef.current = null;
        pendingSizeRef.current = null;
        return;
      }

      if (isDragging && dragState && dragPositionRef.current) {
        // Restore rotation-only transform (don't clear to "" — React won't
        // re-apply rotation if it hasn't changed between renders)
        if (draggedElementRef.current) {
          const element = elements.find((el) => el.id === dragState.elementId);
          const rotation = element?.rotation || 0;
          draggedElementRef.current.style.transform = `rotate(${rotation}deg)`;
          draggedElementRef.current = null;
        }

        // Move element to end (highest z-index) and update position
        const element = elements.find((el) => el.id === dragState.elementId);
        if (element) {
          const newElements = elements.filter(
            (el) => el.id !== dragState.elementId,
          );
          newElements.push({
            ...element,
            x: dragPositionRef.current.x,
            y: dragPositionRef.current.y,
          });
          updateElementsWithHistory(newElements);
          updateStatus("Element moved", "success");
        }

        setIsDragging(false);
        dragPositionRef.current = null;
      }

      // Always clear dragState on mouseup (handles click-without-move on edges)
      setDragState(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragState, elements]);

  // Handle mouse down on element to start drag
  const handleElementMouseDown = (elementId: string) => {
    return (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();

      const element = elements.find((el) => el.id === elementId);
      if (!element) return;

      // Select the element
      setSelectedElementId(elementId);

      // Set drag state immediately (edge-based dragging makes intent unambiguous)
      setDragState({
        elementId,
        startX: e.clientX,
        startY: e.clientY,
        elementStartX: element.x,
        elementStartY: element.y,
      });
    };
  };

  // Handle mouse down on rotate handle
  const handleRotateHandleMouseDown = (elementId: string) => {
    return (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();

      const element = elements.find((el) => el.id === elementId);
      if (!element) return;

      setSelectedElementId(elementId);

      const domEl = document.querySelector(
        `[data-element-id="${elementId}"]`,
      ) as HTMLElement;
      if (!domEl) return;

      const rect = domEl.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
      const startDistance = Math.sqrt(
        Math.pow(e.clientX - centerX, 2) + Math.pow(e.clientY - centerY, 2),
      );

      rotateStateRef.current = {
        elementId,
        centerX,
        centerY,
        startAngle,
        startDistance,
        elementStartRotation: element.rotation || 0,
        elementStartWidth: element.width,
        elementStartHeight: element.height,
        elementStartFontSize: element.fontSize,
      };
    };
  };

  // Handle measurement update for textbox auto-sizing
  const handleMeasure = (
    _elementId: string,
    _width: number,
    _height: number,
  ) => {
    // Measurement callback for textbox auto-sizing (dimensions tracked via ResizeObserver)
  };

  // Handle rotation
  const handleRotate = (elementId: string, deltaRotation: number) => {
    const newElements = elements.map((el) => {
      if (el.id === elementId) {
        const currentRotation = el.rotation || 0;
        return {
          ...el,
          rotation: (currentRotation + deltaRotation) % 360,
        };
      }
      return el;
    });
    updateElementsWithHistory(newElements);
    updateStatus("Element rotated", "success");
  };

  // Auto-save elements to Dexie whenever they change
  useEffect(() => {
    if (elements.length > 0) {
      const timeoutId = setTimeout(() => {
        saveElements(elements);
      }, 1000); // Debounce auto-save by 1 second

      return () => clearTimeout(timeoutId);
    }
  }, [elements, saveElements]);

  // Cleanup: revoke object URLs and delete blobs when component unmounts
  useEffect(() => {
    return () => {
      elements.forEach((el) => {
        if (el.type === "image" && el.src?.startsWith("blob:")) {
          URL.revokeObjectURL(el.src);
        }
      });
    };
  }, []);

  return (
    <>
      <Toolbar
        onAddTextbox={handleAddTextbox}
        onClearAll={handleClearAll}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
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
        selectedElementId={selectedElementId}
        onElementContentChange={handleElementContentChange}
        onElementFocus={handleElementFocus}
        onElementBlur={handleElementBlur}
        onElementSelect={handleElementSelect}
        onCanvasClick={handleCanvasClick}
        onElementMouseDown={handleElementMouseDown}
        onRotateHandleMouseDown={handleRotateHandleMouseDown}
        onMeasure={handleMeasure}
        onRotate={handleRotate}
        onToggleFont={handleToggleFont}
        onToggleItalic={handleToggleItalic}
        onToggleTextColor={handleToggleTextColor}
        isDragging={isDragging}
      />
    </>
  );
}
