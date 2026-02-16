import { useState, useRef, useCallback, useEffect } from "react";
import type {
  CanvasElementData,
  DragState,
  MarqueeState,
  RotateState,
} from "../types/canvas";

interface UseCanvasInteractionsParams {
  elements: CanvasElementData[];
  selectedElementIds: Set<string>;
  setSelectedElementIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  updateElementsWithHistory: (newElements: CanvasElementData[]) => void;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  updateStatus: (
    message: string,
    type?: "info" | "success" | "error" | "warning",
  ) => void;
}

export function useCanvasInteractions({
  elements,
  selectedElementIds,
  setSelectedElementIds,
  updateElementsWithHistory,
  canvasRef,
  updateStatus,
}: UseCanvasInteractionsParams) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [marqueeState, setMarqueeState] = useState<MarqueeState | null>(null);
  const [cursorPosition, setCursorPosition] = useState({ x: 50, y: 50 });

  const dragPositionsRef = useRef<Map<
    string,
    { x: number; y: number }
  > | null>(null);
  const draggedElementsRef = useRef<HTMLElement[]>([]);
  const marqueeJustEndedRef = useRef(false);
  const rotateStateRef = useRef<RotateState | null>(null);
  const pendingRotationRef = useRef<number | null>(null);
  const pendingSizeRef = useRef<{
    width?: number;
    height?: number;
    fontSize?: number;
  } | null>(null);

  // Helper: get canvas-relative coordinates from mouse event
  const getCanvasCoords = useCallback(
    (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left + canvas.scrollLeft,
        y: e.clientY - rect.top + canvas.scrollTop,
      };
    },
    [canvasRef],
  );

  // Helper: compute marquee rect (normalized so x/y is top-left)
  const getMarqueeRect = useCallback((m: MarqueeState) => {
    const x = Math.min(m.startX, m.currentX);
    const y = Math.min(m.startY, m.currentY);
    const w = Math.abs(m.currentX - m.startX);
    const h = Math.abs(m.currentY - m.startY);
    return { x, y, w, h };
  }, []);

  // Helper: check if element intersects marquee rect
  const elementIntersectsRect = useCallback(
    (
      el: CanvasElementData,
      rect: { x: number; y: number; w: number; h: number },
    ) => {
      let elW = el.width;
      let elH = el.height;

      if (!elW || !elH) {
        const domEl = document.querySelector(
          `[data-element-id="${el.id}"]`,
        ) as HTMLElement;
        if (domEl) {
          const domRect = domEl.getBoundingClientRect();
          elW = elW || domRect.width;
          elH = elH || domRect.height;
        } else {
          elW = elW || 100;
          elH = elH || 30;
        }
      }

      return !(
        el.x + elW < rect.x ||
        el.x > rect.x + rect.w ||
        el.y + elH < rect.y ||
        el.y > rect.y + rect.h
      );
    },
    [],
  );

  // Handle canvas click to deselect (skip if a real marquee just finished)
  const handleCanvasClick = () => {
    if (marqueeJustEndedRef.current) {
      marqueeJustEndedRef.current = false;
      return;
    }
    setSelectedElementIds(new Set());
  };

  // Handle mouse down on element to start drag
  const handleElementMouseDown = (elementId: string) => {
    return (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();

      const element = elements.find((el) => el.id === elementId);
      if (!element) return;

      // Shift+click: toggle selection, don't start drag
      if (e.shiftKey) {
        const next = new Set(selectedElementIds);
        if (next.has(elementId)) {
          next.delete(elementId);
        } else {
          next.add(elementId);
        }
        setSelectedElementIds(next);
        return;
      }

      // If element is already selected, start drag for ALL selected elements
      if (selectedElementIds.has(elementId)) {
        const ids = Array.from(selectedElementIds);
        const starts = new Map<string, { x: number; y: number }>();
        for (const id of ids) {
          const el = elements.find((e) => e.id === id);
          if (el) starts.set(id, { x: el.x, y: el.y });
        }
        setDragState({
          elementIds: ids,
          startX: e.clientX,
          startY: e.clientY,
          elementStarts: starts,
        });
      } else {
        // Select only this element and start drag for it
        setSelectedElementIds(new Set([elementId]));
        setDragState({
          elementIds: [elementId],
          startX: e.clientX,
          startY: e.clientY,
          elementStarts: new Map([
            [elementId, { x: element.x, y: element.y }],
          ]),
        });
      }
    };
  };

  // Handle mouse down on canvas background to start marquee
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-element-id]")) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left + canvas.scrollLeft;
    const y = e.clientY - rect.top + canvas.scrollTop;

    setMarqueeState({ startX: x, startY: y, currentX: x, currentY: y });
    setSelectedElementIds(new Set());
  };

  // Handle mouse down on rotate handle
  const handleRotateHandleMouseDown = (elementId: string) => {
    return (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();

      const element = elements.find((el) => el.id === elementId);
      if (!element) return;

      setSelectedElementIds(new Set([elementId]));

      const domEl = document.querySelector(
        `[data-element-id="${elementId}"]`,
      ) as HTMLElement;
      if (!domEl) return;

      const rect = domEl.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const startAngle = Math.atan2(
        e.clientY - centerY,
        e.clientX - centerX,
      );
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

  // Disable text selection while actively dragging or marquee-selecting
  useEffect(() => {
    if (isDragging || marqueeState) {
      document.body.style.userSelect = "none";
    } else {
      document.body.style.userSelect = "";
    }
    return () => {
      document.body.style.userSelect = "";
    };
  }, [isDragging, marqueeState]);

  // Track cursor position and handle dragging/marquee with single event listener
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

        const deltaAngle = (currentAngle - rs.startAngle) * (180 / Math.PI);
        const newRotation = rs.elementStartRotation + deltaAngle;
        const scaleFactor = currentDistance / rs.startDistance;

        const element = elements.find((el) => el.id === rs.elementId);
        if (!element) return;

        const domEl = document.querySelector(
          `[data-element-id="${rs.elementId}"]`,
        ) as HTMLElement;

        if (element.type === "image") {
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

      // Handle marquee drag
      if (marqueeState) {
        const coords = getCanvasCoords(e);
        const newMarquee = {
          ...marqueeState,
          currentX: coords.x,
          currentY: coords.y,
        };
        setMarqueeState(newMarquee);

        const rect = getMarqueeRect(newMarquee);
        const intersecting = new Set<string>();
        for (const el of elements) {
          if (elementIntersectsRect(el, rect)) {
            intersecting.add(el.id);
          }
        }
        setSelectedElementIds(intersecting);
        return;
      }

      // Drag threshold: only start dragging if moved more than 5 pixels
      if (dragState && !isDragging) {
        const deltaX = e.clientX - dragState.startX;
        const deltaY = e.clientY - dragState.startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (distance > 5) {
          setIsDragging(true);
        } else {
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

      // Handle multi-drag with smooth mousemove
      if (isDragging && dragState) {
        const deltaX = e.clientX - dragState.startX;
        const deltaY = e.clientY - dragState.startY;

        const hasImages = dragState.elementIds.some((id) => {
          const el = elements.find((e) => e.id === id);
          return el?.type === "image";
        });

        const newPositions = new Map<string, { x: number; y: number }>();
        for (const id of dragState.elementIds) {
          const start = dragState.elementStarts.get(id);
          if (!start) continue;

          const domEl = document.querySelector(
            `[data-element-id="${id}"]`,
          ) as HTMLElement;
          if (domEl) {
            const element = elements.find((el) => el.id === id);
            const rotation = element?.rotation || 0;
            if (hasImages && element?.type === "textbox") {
              domEl.style.transition =
                "transform 150ms cubic-bezier(0.4, 0, 0.2, 1)";
            }
            domEl.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0) rotate(${rotation}deg)`;
            if (!draggedElementsRef.current.includes(domEl)) {
              draggedElementsRef.current.push(domEl);
            }
          }

          newPositions.set(id, {
            x: Math.max(0, start.x + deltaX),
            y: Math.max(0, start.y + deltaY),
          });
        }

        dragPositionsRef.current = newPositions;
      } else if (!dragState && !marqueeState) {
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

      // Finalize marquee selection
      if (marqueeState) {
        const rect = getMarqueeRect(marqueeState);
        if (rect.w > 3 || rect.h > 3) {
          marqueeJustEndedRef.current = true;
        }
        setMarqueeState(null);
        return;
      }

      if (isDragging && dragState && dragPositionsRef.current) {
        // Restore rotation-only transforms and clear inline transition
        for (const domEl of draggedElementsRef.current) {
          const id = domEl.getAttribute("data-element-id");
          const element = id ? elements.find((el) => el.id === id) : null;
          const rotation = element?.rotation || 0;
          domEl.style.transform = `rotate(${rotation}deg)`;
          domEl.style.transition = "";
        }
        draggedElementsRef.current = [];

        // Move dragged elements to end (highest z-index) and update positions
        const positions = dragPositionsRef.current;
        const draggedIds = new Set(dragState.elementIds);
        const nonDragged = elements.filter((el) => !draggedIds.has(el.id));
        const dragged = elements.filter((el) => draggedIds.has(el.id));
        const updatedDragged = dragged.map((el) => {
          const pos = positions.get(el.id);
          return pos ? { ...el, x: pos.x, y: pos.y } : el;
        });

        const newElements = [...nonDragged, ...updatedDragged];
        updateElementsWithHistory(newElements);
        updateStatus(
          dragState.elementIds.length === 1
            ? "Element moved"
            : `${dragState.elementIds.length} elements moved`,
          "success",
        );

        setIsDragging(false);
        dragPositionsRef.current = null;
      }

      // Always clear dragState on mouseup
      setDragState(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragState, elements, marqueeState]);

  return {
    isDragging,
    marqueeState,
    cursorPosition,
    handleElementMouseDown,
    handleCanvasMouseDown,
    handleCanvasClick,
    handleRotateHandleMouseDown,
  };
}
