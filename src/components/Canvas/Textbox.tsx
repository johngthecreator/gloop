import { useRef, useEffect } from "react";
import { useAutoSizing } from "../../hooks/useAutoSizing";
import { Italic } from "lucide-react";

interface TextboxProps {
  id: string;
  content: string;
  onContentChange: (id: string, content: string) => void;
  onFocus: (id: string) => void;
  onBlur: (id: string) => void;
  isSelected?: boolean;
  rotation?: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  fontSize?: number;
  onRotate?: (id: string, deltaRotation: number) => void;
  onMeasure?: (elementId: string, width: number, height: number) => void;
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onRotateHandleMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onToggleFont?: (id: string) => void;
  onToggleItalic?: (id: string) => void;
  fontFamily?: "comic-sans" | "sans";
  italic?: boolean;
  isDragging?: boolean;
}

export default function Textbox({
  id,
  content,
  onContentChange,
  onFocus,
  onBlur,
  isSelected = false,
  rotation = 0,
  x,
  y,
  width,
  fontSize = 16,
  fontFamily = "sans",
  italic = false,
  onRotate,
  onMeasure,
  onMouseDown,
  onRotateHandleMouseDown,
  onToggleFont,
  onToggleItalic,
  isDragging = false,
}: TextboxProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const hasAutoFocusedRef = useRef(false);

  // Auto-focus on newly created textboxes (when selected on first render)
  useEffect(() => {
    if (
      isSelected &&
      !hasAutoFocusedRef.current &&
      contentRef.current &&
      document.activeElement !== contentRef.current
    ) {
      contentRef.current.focus();
      // Select all text for easy editing
      const range = document.createRange();
      range.selectNodeContents(contentRef.current);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      hasAutoFocusedRef.current = true;
    }
  }, [isSelected]);

  // Sync content prop to contentEditable div
  useEffect(() => {
    if (contentRef.current && document.activeElement !== contentRef.current) {
      // Only update if not currently focused (to avoid disrupting user input)
      contentRef.current.textContent = content;
    }
  }, [content]);

  // Use auto-sizing hook
  useAutoSizing(
    id,
    contentRef,
    onMeasure ? (w, h) => onMeasure(id, w, h) : undefined,
  );

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    onContentChange(id, target.textContent || "");
  };

  const handleFocus = () => {
    onFocus(id);
  };

  const handleBlur = () => {
    onBlur(id);
  };

  // Handle keyboard rotation (arrow keys)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Only handle rotation if the outer div is focused (not content being edited)
    const isEditingText = document.activeElement === contentRef.current;
    if (isEditingText) return;

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

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  return (
    <div
      className={`absolute group transition-opacity p-2 border-2 rounded ${
        isDragging ? "opacity-70" : ""
      } ${isSelected ? "border-dotted border-blue-500" : "border-transparent"}`}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: `rotate(${rotation}deg)`,
        width: width ? `${width}px` : "auto",
        minWidth: "80px",
        cursor: isDragging ? "grabbing" : "move",
        willChange: isDragging ? "transform" : "auto",
      }}
      onMouseDown={onMouseDown}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      data-element-id={id}
      data-element-type="textbox"
    >
      {/* Hover indicator (when not selected) */}
      {!isSelected && (
        <div className="absolute inset-0 border-2 border-gray-400 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      )}

      {/* Rotation badge */}
      {rotation !== 0 && (
        <div className="absolute -top-6 right-0 bg-blue-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
          {Math.round(rotation)}°
        </div>
      )}

      {/* Textbox content */}
      <div
        ref={contentRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onFocus={handleFocus}
        onBlur={handleBlur}
        spellCheck={false}
        onMouseDown={(e) => e.stopPropagation()}
        className={`p-2 text-base outline-none transition-all rounded cursor-text wrap-break-word text-black select-text ${
          fontFamily === "comic-sans" ? "font-comic-sans" : ""
        } ${italic ? "italic" : ""}`}
        style={{
          fontSize: `${fontSize}px`,
          minHeight: "40px",
          whiteSpace: "pre-wrap",
          wordWrap: "break-word",
        }}
        data-placeholder="Click to edit..."
      />

      {/* Selection indicator and controls */}
      {isSelected && (
        <div className="absolute inset-0">
          <button
            className={`absolute -top-7 left-0 text-white text-xs rounded px-1.5 py-0.5 cursor-pointer pointer-events-auto transition-colors ${
              italic
                ? "bg-blue-700 hover:bg-blue-800"
                : "bg-blue-500 hover:bg-blue-600"
            }`}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onToggleItalic?.(id);
            }}
          >
            <span>
              <Italic size={16} />
            </span>
          </button>
          {/* Font toggle button */}
          <button
            className="absolute -top-7 left-8 bg-blue-500 text-white text-xs rounded px-1.5 py-0.5 cursor-pointer pointer-events-auto hover:bg-blue-600 transition-colors"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFont?.(id);
            }}
          >
            {fontFamily === "comic-sans" ? "Inter" : "Comic Sans"}
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
