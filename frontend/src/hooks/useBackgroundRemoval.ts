import { useState, useRef, useEffect, useCallback } from "react";

export function useBackgroundRemoval() {
  const workerRef = useRef<Worker | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("../workers/backgroundRemoval.worker.ts", import.meta.url),
        { type: "module" },
      );
    }
    return workerRef.current;
  }, []);

  const removeBackground = useCallback(
    (elementId: string, imageBlob: Blob): Promise<Blob> => {
      setProcessingIds((prev) => new Set(prev).add(elementId));
      const requestId = `${elementId}-${Date.now()}`;

      return new Promise<Blob>((resolve, reject) => {
        const worker = getWorker();

        const handler = (e: MessageEvent) => {
          const data = e.data;

          // Only handle responses for our request
          if (data.requestId && data.requestId !== requestId) return;

          if (data.type === "result") {
            worker.removeEventListener("message", handler);
            setProcessingIds((prev) => {
              const next = new Set(prev);
              next.delete(elementId);
              return next;
            });
            resolve(data.blob as Blob);
          } else if (data.type === "error") {
            worker.removeEventListener("message", handler);
            setProcessingIds((prev) => {
              const next = new Set(prev);
              next.delete(elementId);
              return next;
            });
            reject(new Error(data.error as string));
          }
          // Ignore 'progress' messages — just let the worker warm up
        };

        worker.addEventListener("message", handler);
        worker.postMessage({ type: "process", blob: imageBlob, requestId });
      });
    },
    [getWorker],
  );

  // Terminate worker on unmount
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  return { removeBackground, processingIds };
}
