import { useEffect, useRef, useState } from "react";
import { Shapes, Triangle, Square, Circle } from "lucide-react";
import type { ShapeKind } from "../Canvas/Shape";

interface AddShapeButtonProps {
  onAddShape: (shape: ShapeKind) => void;
  disabled?: boolean;
}

const SHAPES: { kind: ShapeKind; label: string; Icon: typeof Square }[] = [
  { kind: "square", label: "Square", Icon: Square },
  { kind: "circle", label: "Circle", Icon: Circle },
  { kind: "triangle", label: "Triangle", Icon: Triangle },
];

export default function AddShapeButton({
  onAddShape,
  disabled = false,
}: AddShapeButtonProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="p-2 bg-violet-500 text-white rounded-xl hover:bg-violet-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        title="Add a shape"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Shapes />
      </button>

      {open && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 p-2 z-50"
          role="menu"
        >
          {SHAPES.map(({ kind, label, Icon }) => (
            <button
              key={kind}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 text-sm text-gray-800 w-full"
              onClick={() => {
                onAddShape(kind);
                setOpen(false);
              }}
              role="menuitem"
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
