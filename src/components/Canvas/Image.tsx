import { Scissors, Loader2 } from "lucide-react";

interface ImageProps {
  id: string;
  src: string;
  onSelect: (id: string) => void;
  isSelected?: boolean;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  onRotate?: (id: string, deltaRotation: number) => void;
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onRotateHandleMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onRemoveBackground?: (id: string) => void;
  isRemovingBackground?: boolean;
  isDragging?: boolean;
}

export default function Image({
  id,
  src,
  onSelect,
  isSelected = false,
  x,
  y,
  width = 200,
  height = 200,
  rotation = 0,
  onRotate,
  onMouseDown,
  onRotateHandleMouseDown,
  onRemoveBackground,
  isRemovingBackground = false,
  isDragging = false,
}: ImageProps) {
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  // Handle keyboard rotation (arrow keys)
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

  return (
    <div
      className={`absolute group transition-all select-none ${
        isSelected ? 'ring-2 ring-blue-500' : 'hover:ring-2 hover:ring-gray-400'
      } rounded ${isDragging ? 'opacity-70' : ''}`}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${height}px`,
        transform: `rotate(${rotation}deg)`,
        cursor: isDragging ? 'grabbing' : 'grab',
        willChange: isDragging ? 'transform' : 'auto',
      }}
      onClick={handleClick}
      onMouseDown={onMouseDown}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      data-element-id={id}
      data-element-type="image"
    >
      {/* Rotation badge */}
      {rotation !== 0 && (
        <div className="absolute -top-6 right-0 bg-blue-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
          {Math.round(rotation)}°
        </div>
      )}

      <img
        src={src}
        alt="Canvas element"
        className="w-full h-full object-cover rounded"
        draggable={false}
      />

      {/* Processing overlay */}
      {isRemovingBackground && (
        <div className="absolute inset-0 bg-black/40 rounded flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-white" />
        </div>
      )}

      {/* Selection indicator and controls */}
      {isSelected && (
        <div className="absolute inset-0">
          {/* Remove background button */}
          <button
            className={`absolute -top-7 left-0 text-white text-xs rounded px-1.5 py-0.5 cursor-pointer pointer-events-auto transition-colors ${
              isRemovingBackground
                ? "bg-blue-700"
                : "bg-blue-500 hover:bg-blue-600"
            }`}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (!isRemovingBackground) {
                onRemoveBackground?.(id);
              }
            }}
            disabled={isRemovingBackground}
            title="Remove background"
          >
            {isRemovingBackground ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Scissors size={16} />
            )}
          </button>

          {/* Rotate handle at bottom-right */}
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
