import { useEffect, useRef, useCallback } from "react";
import type { CanvasElementData } from "../types/canvas";
import type { CoopEvent } from "../types/coop";

interface UseCoopCanvasOptions {
  elements: CanvasElementData[];
  updateElementsWithHistory: (elements: CanvasElementData[]) => void;
  sendEvent: (event: CoopEvent) => void;
  onEvent: React.MutableRefObject<((event: CoopEvent) => void) | null>;
  connected: boolean;
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
    (event: CoopEvent) => {
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
        // Only add if not already present
        if (!current.find((el) => el.id === event.element.id)) {
          updateElementsWithHistory([...current, event.element]);
        }
      } else if (event.type === "element-updated") {
        const idx = current.findIndex((el) => el.id === event.element.id);
        if (idx !== -1) {
          const next = [...current];
          next[idx] = event.element;
          updateElementsWithHistory(next);
        } else {
          // Element doesn't exist locally yet — treat as add
          updateElementsWithHistory([...current, event.element]);
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

    // Build lookup maps
    const prevMap = new Map(prev.map((el) => [el.id, el]));
    const currMap = new Map(elements.map((el) => [el.id, el]));

    // Detect added and updated
    for (const el of elements) {
      const old = prevMap.get(el.id);
      if (!old) {
        sendEvent({ type: "element-added", element: el });
      } else if (old !== el) {
        sendEvent({ type: "element-updated", element: el });
      }
    }

    // Detect deleted
    for (const old of prev) {
      if (!currMap.has(old.id)) {
        sendEvent({ type: "element-deleted", id: old.id });
      }
    }
  }, [elements, connected, sendEvent]);

  return {
    peerCursorRef,
  };
}
