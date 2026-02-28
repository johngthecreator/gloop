import type { CanvasElementData } from "../components/Canvas/CanvasElement";

export type { CanvasElementData };

export interface StatusState {
  message: string;
  type: "info" | "success" | "error" | "warning";
}

export interface DragState {
  elementIds: string[];
  startX: number;
  startY: number;
  elementStarts: Map<string, { x: number; y: number }>;
}

export interface MarqueeState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export interface RotateState {
  elementId: string;
  centerX: number;
  centerY: number;
  startAngle: number;
  startDistance: number;
  elementStartRotation: number;
  elementStartWidth?: number;
  elementStartHeight?: number;
  elementStartFontSize?: number;
}
