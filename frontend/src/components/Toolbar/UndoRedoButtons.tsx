import { Redo, Undo } from "lucide-react";

interface UndoRedoButtonsProps {
  onUndo: () => void;
  onRedo: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export default function UndoRedoButtons({
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: UndoRedoButtonsProps) {
  return (
    <div className="flex gap-2">
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className="p-2 bg-pink-300 text-white rounded-xl hover:bg-pink-400 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
        title="Undo last action"
        aria-label="Undo"
      >
        <Undo />
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className="p-2 bg-pink-300 text-white rounded-xl hover:bg-pink-400 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
        title="Redo last undone action"
        aria-label="Redo"
      >
        <Redo />
      </button>
    </div>
  );
}
