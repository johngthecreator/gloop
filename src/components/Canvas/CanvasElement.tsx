import Textbox from './Textbox';
import Image from './Image';
import Shape, { type ShapeKind } from './Shape';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasElementData {
  id: string;
  type: 'textbox' | 'image' | 'shape';
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  content?: string;
  src?: string;
  fontSize?: number;
  fontFamily?: 'comic-sans' | 'sans';
  italic?: boolean;
  textColor?: 'black' | 'white';
  naturalWidth?: number;
  naturalHeight?: number;
  crop?: CropRect;
  shape?: ShapeKind;
  fillColor?: string;
}

interface CanvasElementProps extends CanvasElementData {
  isSelected?: boolean;
  onContentChange?: (id: string, content: string) => void;
  onFocus?: (id: string) => void;
  onBlur?: (id: string) => void;
  onSelect?: (id: string) => void;
  onRotate?: (id: string, deltaRotation: number) => void;
  onMeasure?: (elementId: string, width: number, height: number) => void;
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onRotateHandleMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onToggleFont?: (id: string) => void;
  onToggleItalic?: (id: string) => void;
  onToggleTextColor?: (id: string) => void;
  onRemoveBackground?: (id: string) => void;
  onCropCommit?: (id: string, crop: import('./CanvasElement').CropRect, newWidth: number, newHeight: number, naturalWidth: number, naturalHeight: number) => void;
  isRemovingBackground?: boolean;
  isDragging?: boolean;
  onSetShapeFillColor?: (id: string, color: string) => void;
  onStartShapeEyedropper?: (id: string) => void;
  eyedropperTargetId?: string | null;
}

export default function CanvasElement({
  id,
  type,
  x,
  y,
  width,
  height,
  rotation = 0,
  content = '',
  src = '',
  fontSize = 16,
  fontFamily = 'sans',
  italic = false,
  textColor = 'black',
  isSelected = false,
  onContentChange = () => {},
  onFocus = () => {},
  onBlur = () => {},
  onSelect = () => {},
  onRotate,
  onMeasure,
  onMouseDown,
  onRotateHandleMouseDown,
  onToggleFont,
  onToggleItalic,
  onToggleTextColor,
  onRemoveBackground,
  onCropCommit,
  isRemovingBackground = false,
  isDragging = false,
  naturalWidth,
  naturalHeight,
  crop,
  shape = 'rectangle',
  fillColor,
  onSetShapeFillColor,
  onStartShapeEyedropper,
  eyedropperTargetId,
}: CanvasElementProps) {
  if (type === 'textbox') {
    return (
      <Textbox
        id={id}
        content={content}
        onContentChange={onContentChange}
        onFocus={onFocus}
        onBlur={onBlur}
        isSelected={isSelected}
        rotation={rotation}
        x={x}
        y={y}
        width={width}
        height={height}
        fontSize={fontSize}
        fontFamily={fontFamily}
        italic={italic}
        textColor={textColor}
        onRotate={onRotate}
        onMeasure={onMeasure}
        onMouseDown={onMouseDown}
        onRotateHandleMouseDown={onRotateHandleMouseDown}
        onToggleFont={onToggleFont}
        onToggleItalic={onToggleItalic}
        onToggleTextColor={onToggleTextColor}
        isDragging={isDragging}
      />
    );
  }

  if (type === 'image') {
    return (
      <Image
        id={id}
        src={src}
        onSelect={onSelect}
        isSelected={isSelected}
        x={x}
        y={y}
        width={width}
        height={height}
        rotation={rotation}
        onRotate={onRotate}
        onMouseDown={onMouseDown}
        onRotateHandleMouseDown={onRotateHandleMouseDown}
        onRemoveBackground={onRemoveBackground}
        onCropCommit={onCropCommit}
        isRemovingBackground={isRemovingBackground}
        isDragging={isDragging}
        naturalWidth={naturalWidth}
        naturalHeight={naturalHeight}
        crop={crop}
      />
    );
  }

  if (type === 'shape') {
    return (
      <Shape
        id={id}
        shape={shape}
        fillColor={fillColor}
        x={x}
        y={y}
        width={width}
        height={height}
        rotation={rotation}
        isSelected={isSelected}
        onMouseDown={onMouseDown}
        onRotate={onRotate}
        onRotateHandleMouseDown={onRotateHandleMouseDown}
        onSetFillColor={onSetShapeFillColor}
        onStartEyedropper={onStartShapeEyedropper}
        isEyedropperActive={eyedropperTargetId === id}
        isDragging={isDragging}
      />
    );
  }

  return null;
}
