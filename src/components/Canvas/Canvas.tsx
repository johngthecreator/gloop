import { forwardRef } from "react";
import type { CanvasElementData } from "./CanvasElement";
import type { MarqueeState } from "../../types/canvas";
import CanvasElement from "./CanvasElement";

interface CanvasProps {
  elements: CanvasElementData[];
  selectedElementIds: Set<string>;
  onElementContentChange: (id: string, content: string) => void;
  onElementFocus: (id: string) => void;
  onElementBlur: (id: string) => void;
  onElementSelect: (id: string) => void;
  onCanvasClick?: () => void;
  onCanvasMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onElementMouseDown?: (
    elementId: string,
  ) => (e: React.MouseEvent<HTMLDivElement>) => void;
  onRotateHandleMouseDown?: (
    elementId: string,
  ) => (e: React.MouseEvent<HTMLDivElement>) => void;
  onRotate?: (elementId: string, deltaRotation: number) => void;
  onMeasure?: (elementId: string, width: number, height: number) => void;
  onToggleFont?: (id: string) => void;
  onToggleItalic?: (id: string) => void;
  onToggleTextColor?: (id: string) => void;
  isDragging?: boolean;
  marqueeState?: MarqueeState | null;
}

const Canvas = forwardRef<HTMLDivElement, CanvasProps>(function Canvas(
  {
    elements,
    selectedElementIds,
    onElementContentChange,
    onElementFocus,
    onElementBlur,
    onElementSelect,
    onCanvasClick,
    onCanvasMouseDown,
    onElementMouseDown,
    onRotateHandleMouseDown,
    onRotate,
    onMeasure,
    onToggleFont,
    onToggleItalic,
    onToggleTextColor,
    isDragging = false,
    marqueeState,
  },
  ref,
) {
  const handleCanvasClick = () => {
    // Clicks on elements are stopped via stopPropagation,
    // so if we reach here it's a canvas background click
    onCanvasClick?.();
  };

  // Compute marquee rect for rendering
  const marqueeRect = marqueeState
    ? {
        left: Math.min(marqueeState.startX, marqueeState.currentX),
        top: Math.min(marqueeState.startY, marqueeState.currentY),
        width: Math.abs(marqueeState.currentX - marqueeState.startX),
        height: Math.abs(marqueeState.currentY - marqueeState.startY),
      }
    : null;

  return (
    <div
      ref={ref}
      className={`w-screen h-screen no-scrollbar relative bg-white overflow-auto cursor-default transition-opacity select-none ${
        isDragging ? "opacity-90" : ""
      }`}
      onClick={handleCanvasClick}
      onMouseDown={onCanvasMouseDown}
      data-testid="canvas"
      role="main"
      aria-label="Canvas for adding and editing elements"
    >
      {/* Canvas background grid (optional visual aid) */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" />

      {/* Render all canvas elements - infinite canvas size */}
      <div className="relative" style={{ width: "10000px", height: "10000px" }}>
        {elements.map((element) => (
          <CanvasElement
            key={element.id}
            {...element}
            isSelected={selectedElementIds.has(element.id)}
            onContentChange={onElementContentChange}
            onFocus={onElementFocus}
            onBlur={onElementBlur}
            onSelect={onElementSelect}
            onRotate={onRotate}
            onMeasure={onMeasure}
            onMouseDown={onElementMouseDown?.(element.id)}
            onRotateHandleMouseDown={onRotateHandleMouseDown?.(element.id)}
            onToggleFont={onToggleFont}
            onToggleItalic={onToggleItalic}
            onToggleTextColor={onToggleTextColor}
            isDragging={isDragging}
          />
        ))}

        {/* Marquee selection overlay */}
        {marqueeRect && (
          <div
            className="absolute bg-blue-500/10 border border-blue-500 pointer-events-none"
            style={{
              left: marqueeRect.left,
              top: marqueeRect.top,
              width: marqueeRect.width,
              height: marqueeRect.height,
            }}
          />
        )}
      </div>

      {/* Empty state message - positioned at center of canvas */}
      {elements.length === 0 && (
        <div
          className="absolute w-1/2 flex items-center justify-center pointer-events-none"
          style={{
            left: "5000px",
            top: "5000px",
            transform: "translate(-50%, -50%)",
          }}
        >
          <div className="text-center text-gray-400">
            <p className="text-lg font-semibold">Canvas is empty</p>
            <p className="text-sm">Click "Add Textbox" to get started</p>
          </div>
        </div>
      )}
    </div>
  );
});

export default Canvas;
