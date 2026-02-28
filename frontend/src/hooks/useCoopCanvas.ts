import { useEffect, useRef, useCallback } from "react";
import type { CanvasElementData } from "../types/canvas";
import type { CoopEvent } from "../types/coop";
import { db } from "../db";

interface UseCoopCanvasOptions {
  elements: CanvasElementData[];
  updateElementsWithHistory: (elements: CanvasElementData[]) => void;
  sendEvent: (event: CoopEvent) => void;
  onEvent: React.MutableRefObject<((event: CoopEvent) => void) | null>;
  connected: boolean;
}

// Encode a Blob as a base64 data URL so it can be sent over the DataChannel as JSON.
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Fetch the image blob for an element from IndexedDB and return it as a base64
// data URL, or undefined if not found.
async function fetchImageData(el: CanvasElementData): Promise<string | undefined> {
  try {
    const key = el.blobKey || el.id;
    const stored = await db.imageBlobs.get(key);
    if (!stored) return undefined;
    return await blobToDataUrl(stored.blob);
  } catch {
    return undefined;
  }
}

// Decode a base64 data URL received from the peer, store the blob in local
// IndexedDB under the element's key, and return a fresh object URL for rendering.
async function storeReceivedImage(
  el: CanvasElementData,
  imageData: string,
): Promise<string> {
  const res = await fetch(imageData);
  const blob = await res.blob();
  const key = el.blobKey || el.id;
  await db.imageBlobs.put({ id: key, blob, storedAt: Date.now() });
  return URL.createObjectURL(blob);
}

export function useCoopCanvas({
  elements,
  updateElementsWithHistory,
  sendEvent,
  onEvent,
  connected,
}: UseCoopCanvasOptions) {
  const prevElementsRef = useRef<CanvasElementData[]>(elements);
  // When true, the current elements change came from a remote peer — skip re-broadcasting it.
  const suppressBroadcast = useRef(false);
  const peerCursorRef = useRef<{ peerId: string; x: number; y: number } | null>(
    null,
  );

  // Keep a mutable ref to the latest elements so the incoming-event handler
  // always works with current state without re-registering.
  const elementsRef = useRef(elements);
  elementsRef.current = elements;

  // ── Handle incoming events from peer ──────────────────────────────────
  const handleRemoteEvent = useCallback(
    async (event: CoopEvent) => {
      if (event.type === "cursor") {
        peerCursorRef.current = {
          peerId: event.peerId,
          x: event.x,
          y: event.y,
        };
        return;
      }

      const current = elementsRef.current;
      suppressBroadcast.current = true;

      if (event.type === "element-added") {
        if (!current.find((el) => el.id === event.element.id)) {
          let element = event.element;
          // If the peer sent image data, store it locally and create a usable src.
          if (event.imageData && element.type === "image") {
            const src = await storeReceivedImage(element, event.imageData);
            element = { ...element, src };
          }
          updateElementsWithHistory([...current, element]);
        }
      } else if (event.type === "element-updated") {
        let element = event.element;
        // If the image blob changed (e.g. background removal), store the new data.
        if (event.imageData && element.type === "image") {
          const src = await storeReceivedImage(element, event.imageData);
          element = { ...element, src };
        }
        const idx = current.findIndex((el) => el.id === element.id);
        if (idx !== -1) {
          const next = [...current];
          next[idx] = element;
          updateElementsWithHistory(next);
        } else {
          updateElementsWithHistory([...current, element]);
        }
      } else if (event.type === "element-deleted") {
        const next = current.filter((el) => el.id !== event.id);
        if (next.length !== current.length) {
          updateElementsWithHistory(next);
        }
      }

      // Reset after a microtask so the resulting setState has time to propagate
      // before the next diff runs.
      queueMicrotask(() => {
        suppressBroadcast.current = false;
      });
    },
    [updateElementsWithHistory],
  );

  // Register our handler on the onEvent ref from useWebRTC
  useEffect(() => {
    if (connected) {
      onEvent.current = handleRemoteEvent;
    }
    return () => {
      onEvent.current = null;
    };
  }, [connected, handleRemoteEvent, onEvent]);

  // ── Broadcast outgoing changes ────────────────────────────────────────
  useEffect(() => {
    if (!connected || suppressBroadcast.current) {
      prevElementsRef.current = elements;
      return;
    }

    const prev = prevElementsRef.current;
    prevElementsRef.current = elements;

    const prevMap = new Map(prev.map((el) => [el.id, el]));
    const currMap = new Map(elements.map((el) => [el.id, el]));

    // Run async so we can fetch image blobs from IndexedDB before sending.
    void (async () => {
      for (const el of elements) {
        const old = prevMap.get(el.id);
        if (!old) {
          // New element — for images, include the blob so the peer can render it.
          const imageData =
            el.type === "image" ? await fetchImageData(el) : undefined;
          sendEvent({ type: "element-added", element: el, imageData });
        } else if (old !== el) {
          // Updated element — only re-send image data if the blob itself changed
          // (e.g. background removal). Position/size/crop changes don't need it.
          const blobChanged =
            el.type === "image" && (el.blobKey || el.id) !== (old.blobKey || old.id);
          const imageData = blobChanged ? await fetchImageData(el) : undefined;
          sendEvent({ type: "element-updated", element: el, imageData });
        }
      }

      for (const old of prev) {
        if (!currMap.has(old.id)) {
          sendEvent({ type: "element-deleted", id: old.id });
        }
      }
    })();
  }, [elements, connected, sendEvent]);

  return {
    peerCursorRef,
  };
}
