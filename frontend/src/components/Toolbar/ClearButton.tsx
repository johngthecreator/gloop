import { Trash } from "lucide-react";

interface ClearButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export default function ClearButton({
  onClick,
  disabled = false,
}: ClearButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title="Clear all elements from the canvas"
      className="p-2 bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
    >
      <Trash />
    </button>
  );
}
