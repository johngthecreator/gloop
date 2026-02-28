import type { CanvasElementData } from "./canvas";

export type CoopEvent =
  // imageData is a base64 data URL included when the image blob needs to be
  // transferred to the peer (new paste, or background removal changed the blob).
  // The receiver stores it in their local IndexedDB and creates a fresh object URL.
  | { type: "element-updated"; element: CanvasElementData; imageData?: string }
  | { type: "element-deleted"; id: string }
  | { type: "element-added"; element: CanvasElementData; imageData?: string }
  | { type: "cursor"; peerId: string; x: number; y: number };
