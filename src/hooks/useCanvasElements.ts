import { useEffect, useCallback, useRef, useState } from "react";
import type { CanvasElementData } from "../types/canvas";
import { DEFAULT_FILL, type ShapeKind } from "../components/Canvas/Shape";
import type { CropRect } from "../components/Canvas/CanvasElement";
import { db } from "../db";
import { useBackgroundRemoval } from "./useBackgroundRemoval";

interface UseCanvasElementsParams {
  elements: CanvasElementData[];
  setElements: React.Dispatch<React.SetStateAction<CanvasElementData[]>>;
  selectedElementIds: Set<string>;
  setSelectedElementIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  updateElementsWithHistory: (newElements: CanvasElementData[]) => void;
  history: CanvasElementData[][];
  canvasRef: React.RefObject<HTMLDivElement | null>;
  cursorPosition: { x: number; y: number };
  zoom: number;
  updateStatus: (
    message: string,
    type?: "info" | "success" | "error" | "warning",
  ) => void;
}

const SHAPE_DIMS: Record<ShapeKind, { width: number; height: number }> = {
  rectangle: { width: 200, height: 140 },
  square: { width: 160, height: 160 },
  circle: { width: 160, height: 160 },
  triangle: { width: 200, height: 180 },
};

export function useCanvasElements({
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
}: UseCanvasElementsParams) {
  const [eyedropperTargetId, setEyedropperTargetId] = useState<string | null>(
    null,
  );
  const lastPreviewColorRef = useRef<string | null>(null);
  const eyedropperCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const eyedropperStartColorRef = useRef<string | null>(null);

  const previewShapeFillColor = useCallback(
    (id: string, color: string) => {
      setElements((prev) =>
        prev.map((el) => (el.id === id ? { ...el, fillColor: color } : el)),
      );
    },
    [setElements],
  );

  const commitShapeFillColor = useCallback(
    (id: string, color: string) => {
      const newElements = elements.map((el) =>
        el.id === id ? { ...el, fillColor: color } : el,
      );
      updateElementsWithHistory(newElements);
    },
    [elements, updateElementsWithHistory],
  );
  // Add a new textbox
  const handleAddTextbox = () => {
    const newId = `textbox-${Date.now()}`;

    const canvas = canvasRef.current;
    const x = canvas
      ? (canvas.scrollLeft + canvas.clientWidth / 2) / zoom
      : 5000 + elements.length * 10;
    const y = canvas
      ? (canvas.scrollTop + canvas.clientHeight / 2) / zoom
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

  const handleAddShape = (shape: ShapeKind) => {
    const newId = `shape-${Date.now()}`;

    const canvas = canvasRef.current;
    const x = canvas
      ? (canvas.scrollLeft + canvas.clientWidth / 2) / zoom
      : 5000 + elements.length * 10;
    const y = canvas
      ? (canvas.scrollTop + canvas.clientHeight / 2) / zoom
      : 5000 + elements.length * 10;

    const { width, height } = SHAPE_DIMS[shape];
    const fillColor = DEFAULT_FILL[shape];

    const newElement: CanvasElementData = {
      id: newId,
      type: "shape",
      shape,
      x,
      y,
      width,
      height,
      rotation: 0,
      fillColor,
    };

    updateElementsWithHistory([...elements, newElement]);
    setSelectedElementIds(new Set([newId]));
    updateStatus("Shape added", "success");
  };

  const handleSetShapeFillColor = (id: string, color: string) => {
    commitShapeFillColor(id, color);
    updateStatus("Shape color updated", "success");
  };

  const handleStartShapeEyedropper = (id: string) => {
    if (eyedropperTargetId === id) {
      setEyedropperTargetId(null);
      lastPreviewColorRef.current = null;
      if (eyedropperStartColorRef.current) {
        previewShapeFillColor(id, eyedropperStartColorRef.current);
      }
      eyedropperStartColorRef.current = null;
      updateStatus("Eyedropper canceled", "info");
      return;
    }
    lastPreviewColorRef.current = null;
    const target = elements.find((el) => el.id === id);
    eyedropperStartColorRef.current = target?.fillColor || null;
    setEyedropperTargetId(id);
    updateStatus("Eyedropper active - hover an image to pick a color", "info");
  };

  useEffect(() => {
    if (!eyedropperTargetId) return;

    const canvas =
      eyedropperCanvasRef.current || document.createElement("canvas");
    eyedropperCanvasRef.current = canvas;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const pickColorAtPoint = (clientX: number, clientY: number) => {
      const el = document.elementFromPoint(clientX, clientY) as
        | HTMLElement
        | null;
      if (!el) return null;

      const imageRoot = el.closest(
        '[data-element-type="image"]',
      ) as HTMLElement | null;
      if (!imageRoot) return null;

      const img = imageRoot.querySelector("img") as HTMLImageElement | null;
      if (!img || !img.naturalWidth || !img.naturalHeight) return null;

      const rect = img.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;

      const drawW = Math.max(1, Math.floor(rect.width));
      const drawH = Math.max(1, Math.floor(rect.height));
      canvas.width = drawW;
      canvas.height = drawH;

      try {
        ctx.drawImage(img, 0, 0, drawW, drawH);
        const px = Math.min(drawW - 1, Math.max(0, Math.floor(x)));
        const py = Math.min(drawH - 1, Math.max(0, Math.floor(y)));
        const data = ctx.getImageData(px, py, 1, 1).data;
        const [r, g, b] = data;
        return `#${[r, g, b]
          .map((v) => v.toString(16).padStart(2, "0"))
          .join("")}`;
      } catch {
        return null;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const color = pickColorAtPoint(e.clientX, e.clientY);
      if (!color || color === lastPreviewColorRef.current) return;
      lastPreviewColorRef.current = color;
      previewShapeFillColor(eyedropperTargetId, color);
    };

    const handleMouseDown = (e: MouseEvent) => {
      const color = pickColorAtPoint(e.clientX, e.clientY);
      if (!color) return;
      e.preventDefault();
      e.stopPropagation();
    };

    const handleClick = (e: MouseEvent) => {
      const color = pickColorAtPoint(e.clientX, e.clientY);
      if (!color) return;
      e.preventDefault();
      e.stopPropagation();
      commitShapeFillColor(eyedropperTargetId, color);
      updateStatus("Color picked", "success");
      setEyedropperTargetId(null);
      lastPreviewColorRef.current = null;
      eyedropperStartColorRef.current = null;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (eyedropperStartColorRef.current && eyedropperTargetId) {
          previewShapeFillColor(
            eyedropperTargetId,
            eyedropperStartColorRef.current,
          );
        }
        setEyedropperTargetId(null);
        lastPreviewColorRef.current = null;
        eyedropperStartColorRef.current = null;
        updateStatus("Eyedropper canceled", "info");
      }
    };

    document.body.style.cursor = "crosshair";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseDown, true);
    window.addEventListener("click", handleClick, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown, true);
      window.removeEventListener("click", handleClick, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    eyedropperTargetId,
    commitShapeFillColor,
    previewShapeFillColor,
    updateStatus,
  ]);

  // Clear all elements
  // const handleClearAll = () => {
  //   if (elements.length === 0) {
  //     updateStatus("Canvas is already empty", "info");
  //     return;
  //   }

  //   if (window.confirm("Are you sure you want to clear all elements?")) {
  //     updateElementsWithHistory([]);
  //     setSelectedElementIds(new Set());
  //     updateStatus("Canvas cleared", "success");
  //   }
  // };

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
            current === "sans" ? ("comic-sans" as const) : ("sans" as const),
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
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
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

  // Background removal
  const { removeBackground, processingIds: bgRemovalProcessingIds } =
    useBackgroundRemoval();

  const handleRemoveBackground = async (id: string) => {
    const element = elements.find((el) => el.id === id);
    if (!element || element.type !== "image") return;

    updateStatus("Removing background...", "info");

    try {
      // Get original blob from Dexie, or fetch from current src
      let imageBlob: Blob;
      const stored = await db.imageBlobs.get(id);
      if (stored) {
        imageBlob = stored.blob;
      } else if (element.src) {
        const response = await fetch(element.src);
        imageBlob = await response.blob();
      } else {
        throw new Error("No image data found");
      }

      const resultBlob = await removeBackground(id, imageBlob);

      // Persist the new blob
      await db.imageBlobs.put({ id, blob: resultBlob, storedAt: Date.now() });

      // Swap src
      const newUrl = URL.createObjectURL(resultBlob);
      if (element.src?.startsWith("blob:")) {
        URL.revokeObjectURL(element.src);
      }

      const newElements = elements.map((el) =>
        el.id === id ? { ...el, src: newUrl } : el,
      );
      updateElementsWithHistory(newElements);
      updateStatus("Background removed", "success");
    } catch {
      updateStatus("Failed to remove background", "error");
    }
  };

  // Handle crop commit
  const handleCropImage = (
    id: string,
    crop: CropRect,
    newWidth: number,
    newHeight: number,
    naturalWidth: number,
    naturalHeight: number,
  ) => {
    const newElements = elements.map((el) =>
      el.id === id
        ? {
            ...el,
            crop,
            width: newWidth,
            height: newHeight,
            naturalWidth,
            naturalHeight,
          }
        : el,
    );
    updateElementsWithHistory(newElements);
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
  };
}
