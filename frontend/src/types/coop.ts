import type { CanvasElementData } from "./canvas";

export type CoopEvent =
  | { type: "element-updated"; element: CanvasElementData }
  | { type: "element-deleted"; id: string }
  | { type: "element-added"; element: CanvasElementData }
  | { type: "cursor"; peerId: string; x: number; y: number };
