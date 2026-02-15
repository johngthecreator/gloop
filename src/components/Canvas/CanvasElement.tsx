import Textbox from './Textbox';
import Image from './Image';

export interface CanvasElementData {
  id: string;
  type: 'textbox' | 'image';
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
  isDragging?: boolean;
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
  isDragging = false,
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
        onRotate={onRotate}
        onMeasure={onMeasure}
        onMouseDown={onMouseDown}
        onRotateHandleMouseDown={onRotateHandleMouseDown}
        onToggleFont={onToggleFont}
        onToggleItalic={onToggleItalic}
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
        isDragging={isDragging}
      />
    );
  }

  return null;
}
