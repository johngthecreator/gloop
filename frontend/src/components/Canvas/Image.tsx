import { useState, useRef, useEffect, useCallback } from "react";
import { Scissors, Eraser, Loader2 } from "lucide-react";
import type { CropRect } from "./CanvasElement";

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
  onCropCommit?: (id: string, crop: CropRect, newWidth: number, newHeight: number, naturalWidth: number, naturalHeight: number) => void;
  isRemovingBackground?: boolean;
  isDragging?: boolean;
  naturalWidth?: number;
  naturalHeight?: number;
  crop?: CropRect;
}

type HandleDirection = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

const HANDLE_SIZE = 8;
const MIN_CROP_PX = 20;

export default function Image({
  id,
  src,
  onSelect: _onSelect,
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
  onCropCommit,
  isRemovingBackground = false,
  isDragging = false,
  naturalWidth: propNW,
  naturalHeight: propNH,
  crop,
}: ImageProps) {
  const [isCropping, setIsCropping] = useState(false);
  const [localCrop, setLocalCrop] = useState<CropRect | null>(null);
  const preCropSnapshot = useRef<{ crop?: CropRect; width: number; height: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const cropDragRef = useRef<{
    handle: HandleDirection;
    startX: number;
    startY: number;
    startCrop: CropRect;
  } | null>(null);
  const prevSelectedRef = useRef(isSelected);

  // Resolve natural dimensions: prop or fallback from img element
  const getNaturalDims = useCallback(() => {
    if (propNW && propNH) return { nw: propNW, nh: propNH };
    if (imgRef.current) return { nw: imgRef.current.naturalWidth, nh: imgRef.current.naturalHeight };
    return { nw: width, nh: height };
  }, [propNW, propNH, width, height]);

  // Commit the crop
  const commitCrop = useCallback(() => {
    if (!localCrop || !onCropCommit) return;
    const { nw, nh } = getNaturalDims();
    // Compute new display dimensions preserving the scale from when crop mode was entered
    const preCrop = preCropSnapshot.current;
    if (!preCrop) return;
    // The scale at which natural pixels map to display pixels
    const existingCrop = preCrop.crop;
    let scaleX: number, scaleY: number;
    if (existingCrop) {
      scaleX = preCrop.width / existingCrop.width;
      scaleY = preCrop.height / existingCrop.height;
    } else {
      // Was object-cover before; compute the cover scale
      const coverScale = Math.max(preCrop.width / nw, preCrop.height / nh);
      scaleX = coverScale;
      scaleY = coverScale;
    }
    const newW = localCrop.width * scaleX;
    const newH = localCrop.height * scaleY;
    onCropCommit(id, localCrop, newW, newH, nw, nh);
    setIsCropping(false);
    setLocalCrop(null);
    preCropSnapshot.current = null;
  }, [localCrop, onCropCommit, id, getNaturalDims]);

  // Cancel crop
  const cancelCrop = useCallback(() => {
    setIsCropping(false);
    setLocalCrop(null);
    preCropSnapshot.current = null;
  }, []);

  // Enter crop mode on double-click
  const handleDoubleClick = useCallback(() => {
    if (!isSelected) return;
    const { nw, nh } = getNaturalDims();
    preCropSnapshot.current = { crop, width, height };
    if (crop) {
      setLocalCrop({ ...crop });
    } else {
      // Compute what object-cover shows
      const coverScale = Math.max(width / nw, height / nh);
      const visibleW = width / coverScale;
      const visibleH = height / coverScale;
      const offsetX = (nw - visibleW) / 2;
      const offsetY = (nh - visibleH) / 2;
      setLocalCrop({ x: offsetX, y: offsetY, width: visibleW, height: visibleH });
    }
    setIsCropping(true);
  }, [isSelected, getNaturalDims, crop, width, height]);

  // Keyboard: Enter to commit, Escape to cancel
  useEffect(() => {
    if (!isCropping) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        commitCrop();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cancelCrop();
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [isCropping, commitCrop, cancelCrop]);

  // Deselection auto-commit
  useEffect(() => {
    if (prevSelectedRef.current && !isSelected && isCropping) {
      commitCrop();
    }
    prevSelectedRef.current = isSelected;
  }, [isSelected, isCropping, commitCrop]);

  // Handle drag for crop handles
  useEffect(() => {
    if (!isCropping) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!cropDragRef.current || !localCrop) return;
      const { handle, startX, startY, startCrop } = cropDragRef.current;
      const { nw, nh } = getNaturalDims();

      // Screen delta
      let dx = e.clientX - startX;
      let dy = e.clientY - startY;

      // Rotate delta into element-local space
      const rad = -(rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const localDx = dx * cos - dy * sin;
      const localDy = dx * sin + dy * cos;

      // Convert to natural pixels
      // The full image is displayed at (width x height) for natural (nw x nh)
      // In crop mode the container is sized to the full image extent
      const existingCrop = preCropSnapshot.current?.crop;
      let imgScaleX: number, imgScaleY: number;
      if (existingCrop && preCropSnapshot.current) {
        imgScaleX = preCropSnapshot.current.width / existingCrop.width;
        imgScaleY = preCropSnapshot.current.height / existingCrop.height;
      } else if (preCropSnapshot.current) {
        const coverScale = Math.max(preCropSnapshot.current.width / nw, preCropSnapshot.current.height / nh);
        imgScaleX = coverScale;
        imgScaleY = coverScale;
      } else {
        imgScaleX = width / nw;
        imgScaleY = height / nh;
      }

      const natDx = localDx / imgScaleX;
      const natDy = localDy / imgScaleY;

      let newCrop = { ...startCrop };

      // Adjust edges based on handle direction
      if (handle.includes('w')) {
        const newX = startCrop.x + natDx;
        const clampedX = Math.max(0, Math.min(newX, startCrop.x + startCrop.width - MIN_CROP_PX));
        newCrop.width = startCrop.width - (clampedX - startCrop.x);
        newCrop.x = clampedX;
      }
      if (handle.includes('e')) {
        const newW = startCrop.width + natDx;
        newCrop.width = Math.max(MIN_CROP_PX, Math.min(newW, nw - startCrop.x));
      }
      if (handle.includes('n')) {
        const newY = startCrop.y + natDy;
        const clampedY = Math.max(0, Math.min(newY, startCrop.y + startCrop.height - MIN_CROP_PX));
        newCrop.height = startCrop.height - (clampedY - startCrop.y);
        newCrop.y = clampedY;
      }
      if (handle.includes('s')) {
        const newH = startCrop.height + natDy;
        newCrop.height = Math.max(MIN_CROP_PX, Math.min(newH, nh - startCrop.y));
      }

      setLocalCrop(newCrop);
    };

    const handleMouseUp = () => {
      cropDragRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isCropping, localCrop, rotation, getNaturalDims, width, height]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isSelected && onRotate && !isCropping) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onRotate(id, -5);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onRotate(id, 5);
      }
    }
  };

  const startHandleDrag = (handle: HandleDirection) => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!localCrop) return;
    cropDragRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...localCrop },
    };
  };

  // Compute display scale for crop rendering
  const { nw, nh } = getNaturalDims();
  const existingCrop = preCropSnapshot.current?.crop;
  let imgScaleX: number, imgScaleY: number;
  if (isCropping && preCropSnapshot.current) {
    if (existingCrop) {
      imgScaleX = preCropSnapshot.current.width / existingCrop.width;
      imgScaleY = preCropSnapshot.current.height / existingCrop.height;
    } else {
      const coverScale = Math.max(preCropSnapshot.current.width / nw, preCropSnapshot.current.height / nh);
      imgScaleX = coverScale;
      imgScaleY = coverScale;
    }
  } else if (crop) {
    imgScaleX = width / crop.width;
    imgScaleY = height / crop.height;
  } else {
    imgScaleX = width / nw;
    imgScaleY = height / nh;
  }

  // Render the image with existing crop (non-crop-mode)
  const renderCroppedImage = () => {
    if (!crop) {
      return (
        <img
          ref={imgRef}
          src={src}
          alt="Canvas element"
          className="w-full h-full object-cover rounded"
          draggable={false}
        />
      );
    }
    const sx = width / crop.width;
    const sy = height / crop.height;
    return (
      <div data-crop-container style={{ width, height, overflow: 'hidden', position: 'relative', borderRadius: '0.25rem' }}>
        <img
          ref={imgRef}
          src={src}
          alt="Canvas element"
          draggable={false}
          style={{
            position: 'absolute',
            maxWidth: 'none',
            width: nw * sx,
            height: nh * sy,
            left: -crop.x * sx,
            top: -crop.y * sy,
          }}
        />
      </div>
    );
  };

  // Crop mode rendering
  const renderCropMode = () => {
    if (!localCrop) return null;
    const fullW = nw * imgScaleX;
    const fullH = nh * imgScaleY;
    const cropLeft = localCrop.x * imgScaleX;
    const cropTop = localCrop.y * imgScaleY;
    const cropW = localCrop.width * imgScaleX;
    const cropH = localCrop.height * imgScaleY;

    const handles: { dir: HandleDirection; style: React.CSSProperties }[] = [
      { dir: 'nw', style: { left: cropLeft - HANDLE_SIZE / 2, top: cropTop - HANDLE_SIZE / 2, cursor: 'nw-resize' } },
      { dir: 'ne', style: { left: cropLeft + cropW - HANDLE_SIZE / 2, top: cropTop - HANDLE_SIZE / 2, cursor: 'ne-resize' } },
      { dir: 'sw', style: { left: cropLeft - HANDLE_SIZE / 2, top: cropTop + cropH - HANDLE_SIZE / 2, cursor: 'sw-resize' } },
      { dir: 'se', style: { left: cropLeft + cropW - HANDLE_SIZE / 2, top: cropTop + cropH - HANDLE_SIZE / 2, cursor: 'se-resize' } },
      { dir: 'n', style: { left: cropLeft + cropW / 2 - HANDLE_SIZE / 2, top: cropTop - HANDLE_SIZE / 2, cursor: 'n-resize' } },
      { dir: 's', style: { left: cropLeft + cropW / 2 - HANDLE_SIZE / 2, top: cropTop + cropH - HANDLE_SIZE / 2, cursor: 's-resize' } },
      { dir: 'w', style: { left: cropLeft - HANDLE_SIZE / 2, top: cropTop + cropH / 2 - HANDLE_SIZE / 2, cursor: 'w-resize' } },
      { dir: 'e', style: { left: cropLeft + cropW - HANDLE_SIZE / 2, top: cropTop + cropH / 2 - HANDLE_SIZE / 2, cursor: 'e-resize' } },
    ];

    return (
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: fullW,
          height: fullH,
          zIndex: 50,
          overflow: 'visible',
        }}
        onMouseDown={(e) => e.stopPropagation()}
        data-crop-active="true"
      >
        {/* Dimmed full image */}
        <img
          src={src}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            maxWidth: 'none',
            width: fullW,
            height: fullH,
            left: 0,
            top: 0,
            opacity: 0.3,
          }}
        />
        {/* Bright crop region */}
        <div
          style={{
            position: 'absolute',
            left: cropLeft,
            top: cropTop,
            width: cropW,
            height: cropH,
            overflow: 'hidden',
            border: '2px solid white',
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          <img
            src={src}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              maxWidth: 'none',
              width: fullW,
              height: fullH,
              left: -cropLeft,
              top: -cropTop,
            }}
          />
        </div>
        {/* Handles */}
        {handles.map(({ dir, style }) => (
          <div
            key={dir}
            onMouseDown={startHandleDrag(dir)}
            style={{
              position: 'absolute',
              width: HANDLE_SIZE,
              height: HANDLE_SIZE,
              background: 'white',
              border: '1px solid #888',
              borderRadius: 1,
              zIndex: 51,
              ...style,
            }}
          />
        ))}
      </div>
    );
  };

  if (isCropping) {
    const fullW = nw * imgScaleX;
    const fullH = nh * imgScaleY;
    return (
      <div
        className={`absolute group select-none`}
        style={{
          left: `${x}px`,
          top: `${y}px`,
          width: `${fullW}px`,
          height: `${fullH}px`,
          transform: `rotate(${rotation}deg)`,
          zIndex: 1000,
        }}
        onClick={handleClick}
        onDoubleClick={(e) => e.stopPropagation()}
        tabIndex={0}
        data-element-id={id}
        data-element-type="image"
        data-crop-active="true"
      >
        {renderCropMode()}
      </div>
    );
  }

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
      onDoubleClick={handleDoubleClick}
      onMouseDown={onMouseDown}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      data-element-id={id}
      data-element-type="image"
      {...(crop ? { 'data-crop-info': JSON.stringify({ x: crop.x, y: crop.y, w: crop.width, h: crop.height, nw, nh }) } : {})}
    >
      {/* Rotation badge */}
      {rotation !== 0 && (
        <div className="absolute -top-6 right-0 bg-blue-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
          {Math.round(rotation)}°
        </div>
      )}

      {renderCroppedImage()}

      {/* Processing overlay */}
      {isRemovingBackground && (
        <div className="absolute inset-0 bg-black/40 rounded flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-white" />
        </div>
      )}

      {/* Selection indicator and controls */}
      {isSelected && (
        <div className="absolute inset-0">
          <div className="absolute -top-7 left-0 flex gap-1 pointer-events-auto">
            {/* Remove background button */}
            <button
              className={`text-white text-xs rounded px-1.5 py-0.5 cursor-pointer transition-colors ${
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
                <Eraser size={16} />
              )}
            </button>

            {/* Crop button */}
            <button
              className="text-white text-xs rounded px-1.5 py-0.5 cursor-pointer transition-colors bg-blue-500 hover:bg-blue-600"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                handleDoubleClick();
              }}
              title="Crop image"
            >
              <Scissors size={16} />
            </button>
          </div>

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
