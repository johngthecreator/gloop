import { useEffect, useCallback } from "react";
import type { CanvasElementData } from "../types/canvas";
import { db } from "../db";

interface UseCanvasElementsParams {
  elements: CanvasElementData[];
  setElements: React.Dispatch<React.SetStateAction<CanvasElementData[]>>;
  selectedElementIds: Set<string>;
  setSelectedElementIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  updateElementsWithHistory: (newElements: CanvasElementData[]) => void;
  history: CanvasElementData[][];
  canvasRef: React.RefObject<HTMLDivElement | null>;
  cursorPosition: { x: number; y: number };
  updateStatus: (
    message: string,
    type?: "info" | "success" | "error" | "warning",
  ) => void;
}

export function useCanvasElements({
  elements,
  setElements,
  selectedElementIds,
  setSelectedElementIds,
  updateElementsWithHistory,
  history,
  canvasRef,
  cursorPosition,
  updateStatus,
}: UseCanvasElementsParams) {
  // Add a new textbox
  const handleAddTextbox = () => {
    const newId = `textbox-${Date.now()}`;

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

    updateElementsWithHistory([...elements, newElement]);
    setSelectedElementIds(new Set([newId]));
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
      setSelectedElementIds(new Set());
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
    setSelectedElementIds(new Set([id]));
  };

  // Handle element blur - delete empty textboxes
  const handleElementBlur = (id: string) => {
    const element = elements.find((el) => el.id === id);

    if (element && element.type === "textbox" && !element.content?.trim()) {
      const newElements = elements.filter((el) => el.id !== id);
      updateElementsWithHistory(newElements);
      updateStatus("Empty textbox deleted", "info");

      if (selectedElementIds.has(id)) {
        const next = new Set(selectedElementIds);
        next.delete(id);
        setSelectedElementIds(next);
      }
    }
  };

  // Handle element selection
  const handleElementSelect = (id: string) => {
    setSelectedElementIds(new Set([id]));
  };

  // Handle font toggle
  const handleToggleFont = (id: string) => {
    const newElements = elements.map((el) => {
      if (el.id === id) {
        const current = el.fontFamily || "sans";
        return {
          ...el,
          fontFamily:
            current === "sans"
              ? ("comic-sans" as const)
              : ("sans" as const),
        };
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
          textColor:
            current === "black" ? ("white" as const) : ("black" as const),
        };
      }
      return el;
    });
    updateElementsWithHistory(newElements);
  };

  // Handle pasting image from clipboard
  const handlePasteImage = async (item: DataTransferItem) => {
    updateStatus("Processing image...", "info");

    try {
      const file = item.getAsFile();
      if (!file) throw new Error("Could not extract file");

      const newId = `image-${Date.now()}`;

      await db.imageBlobs.put({
        id: newId,
        blob: file,
        storedAt: Date.now(),
      });

      const objectUrl = URL.createObjectURL(file);

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
          src: objectUrl,
        };

        const newElements = [...elements, newElement];
        updateElementsWithHistory(newElements);
        setSelectedElementIds(new Set([newElement.id]));
        updateStatus("Image pasted successfully", "success");
      };
      img.src = objectUrl;
    } catch {
      updateStatus("Failed to paste image", "error");
    }
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

  // Handle measurement update for textbox auto-sizing
  const handleMeasure = (
    _elementId: string,
    _width: number,
    _height: number,
  ) => {
    // Measurement callback for textbox auto-sizing (dimensions tracked via ResizeObserver)
  };

  // Cleanup unreferenced images
  const handleCleanupUnreferencedImages = useCallback(async () => {
    const referencedIds = new Set<string>();
    for (const entry of history) {
      for (const el of entry) {
        if (el.type === "image") {
          referencedIds.add(el.id);
        }
      }
    }

    const storedBlobs = await db.imageBlobs.toArray();
    let cleanedCount = 0;

    for (const blob of storedBlobs) {
      if (!referencedIds.has(blob.id)) {
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

  // Setup paste event listener
  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [elements, cursorPosition]);

  // Cleanup: revoke object URLs when component unmounts
  useEffect(() => {
    return () => {
      elements.forEach((el) => {
        if (el.type === "image" && el.src?.startsWith("blob:")) {
          URL.revokeObjectURL(el.src);
        }
      });
    };
  }, []);

  return {
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
  };
}
