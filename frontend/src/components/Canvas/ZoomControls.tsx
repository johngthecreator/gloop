interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export default function ZoomControls({ zoom, onZoomIn, onZoomOut }: ZoomControlsProps) {
  return (
    <div className="fixed bottom-4 right-4 flex items-center gap-1 bg-white rounded-xl shadow-lg border border-gray-200 px-2 py-1.5 z-50 select-none">
      <button
        onClick={onZoomOut}
        disabled={zoom <= 0.25}
        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-700 text-lg font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title="Zoom out"
      >
        −
      </button>
      <span className="text-xs text-gray-500 font-mono w-10 text-center tabular-nums">
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={onZoomIn}
        disabled={zoom >= 3}
        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-700 text-lg font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title="Zoom in"
      >
        +
      </button>
    </div>
  );
}
