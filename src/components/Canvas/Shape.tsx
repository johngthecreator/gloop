import { useCallback, useEffect, useState } from "react";
import { Pipette } from "lucide-react";

export type ShapeKind = "rectangle" | "square" | "circle" | "triangle";

interface ShapeProps {
  id: string;
  shape: ShapeKind;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  fillColor?: string;
  isSelected?: boolean;
  onRotate?: (id: string, deltaRotation: number) => void;
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onRotateHandleMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onSetFillColor?: (id: string, color: string) => void;
  onStartEyedropper?: (id: string) => void;
  isEyedropperActive?: boolean;
  isDragging?: boolean;
}

export const DEFAULT_FILL: Record<ShapeKind, string> = {
  rectangle: "#FDE68A",
  square: "#C7D2FE",
  circle: "#A7F3D0",
  triangle: "#FBCFE8",
};

export default function Shape({
  id,
  shape,
  x,
  y,
  width = 180,
  height = 120,
  rotation = 0,
  fillColor,
  isSelected = false,
  onRotate,
  onMouseDown,
  onRotateHandleMouseDown,
  onSetFillColor,
  onStartEyedropper,
  isEyedropperActive = false,
  isDragging = false,
}: ShapeProps) {
  const [copied, setCopied] = useState(false);
  const effectiveColor = (fillColor || DEFAULT_FILL[shape]).toUpperCase();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isSelected && onRotate) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onRotate(id, -5);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onRotate(id, 5);
      }
    }
  };

  const renderShape = useCallback(() => {
    const fill = fillColor || DEFAULT_FILL[shape];

    if (shape === "circle") {
      return (
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          <circle cx="50" cy="50" r="46" fill={fill} />
        </svg>
      );
    }

    if (shape === "triangle") {
      return (
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          <polygon points="50,6 96,94 4,94" fill={fill} />
        </svg>
      );
    }

    return (
      <svg width="100%" height="100%" viewBox="0 0 100 100" aria-hidden="true">
        <rect x="0" y="0" width="100" height="100" rx={0} fill={fill} />
      </svg>
    );
  }, [shape, fillColor]);

  const handleCopyColor = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const hex = effectiveColor;
    try {
      await navigator.clipboard.writeText(hex);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = hex;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
  };

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(t);
  }, [copied]);

  return (
    <div
      className={`absolute group select-none ${
        isSelected ? "ring-2 ring-blue-500" : "hover:ring-2 hover:ring-gray-400"
      } rounded ${isDragging ? "opacity-70" : ""}`}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${height}px`,
        transform: `rotate(${rotation}deg)`,
        cursor: isDragging ? "grabbing" : "grab",
        willChange: isDragging ? "transform" : "auto",
      }}
      onMouseDown={onMouseDown}
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
      tabIndex={0}
      data-element-id={id}
      data-element-type="shape"
    >
      {renderShape()}

      {isSelected && (
        <div className="absolute inset-0">
          <div className="absolute -top-8 left-0 flex items-center gap-1 pointer-events-auto">
            <button
              className="w-6 h-6 rounded border border-gray-300 bg-black"
              title="Fill black"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onSetFillColor?.(id, "#000000");
              }}
            />
            <button
              className="w-6 h-6 rounded border border-gray-300 bg-white"
              title="Fill white"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onSetFillColor?.(id, "#FFFFFF");
              }}
            />
            <button
              className={`w-6 h-6 rounded border border-gray-300 flex items-center justify-center ${
                isEyedropperActive ? "bg-blue-500 text-white" : "bg-white"
              }`}
              title="Pick color from image"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onStartEyedropper?.(id);
              }}
            >
              <Pipette size={14} />
            </button>
            <button
              className="h-6 px-2 rounded border border-gray-300 bg-white text-gray-800 text-[11px] font-mono"
              title="Copy hex color"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={handleCopyColor}
            >
              {copied ? "Copied!" : effectiveColor}
            </button>
          </div>

          <div
            className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 rounded-full -mr-1.5 -mb-1.5 cursor-grab pointer-events-auto"
            onMouseDown={(e) => {
              e.stopPropagation();
              onRotateHandleMouseDown?.(e);
            }}
          />
        </div>
      )}
    </div>
  );
}
