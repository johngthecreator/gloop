import { Settings as SettingsIcon } from "lucide-react";
import AddTextboxButton from "./AddTextboxButton";
import AddShapeButton from "./AddShapeButton";
// import ClearButton from "./ClearButton";
import UndoRedoButtons from "./UndoRedoButtons";
import gloopLogo from "../../assets/gloop.svg";
import type { ShapeKind } from "../Canvas/Shape";

interface ToolbarProps {
  onAddTextbox: () => void;
  onAddShape: (shape: ShapeKind) => void;
  // onClearAll: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onOpenSettings: () => void;
}

export default function Toolbar({
  onAddTextbox,
  onAddShape,
  // onClearAll,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onOpenSettings,
}: ToolbarProps) {
  return (
    <header
      className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 bg-white text-gray-800 rounded-full px-8 py-4 shadow-xl"
      style={{
        backgroundImage:
          "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(249,250,251,0.95) 100%)",
        boxShadow: "0 20px 40px rgba(0,0,0,0.15), 0 0 1px rgba(0,0,0,0.1)",
      }}
    >
      <nav className="flex items-center justify-center gap-2">
        <img src={gloopLogo} className="h-10" />
        <div className="h-6 w-px bg-gray-300"></div>
        <UndoRedoButtons
          onUndo={onUndo}
          onRedo={onRedo}
          canUndo={canUndo}
          canRedo={canRedo}
        />
        <AddTextboxButton onClick={onAddTextbox} />
        <AddShapeButton onAddShape={onAddShape} />
        {/* <ClearButton onClick={onClearAll} /> */}
        <button
          onClick={onOpenSettings}
          className="p-2 bg-gray-300 text-white rounded-xl hover:bg-gray-400 transition-colors"
          title="Settings"
          aria-label="Settings"
        >
          <SettingsIcon />
        </button>
      </nav>
    </header>
  );
}
