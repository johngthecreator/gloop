import { useEffect, useCallback } from 'react';
import { db } from '../db/index';
import type { CanvasElementData } from '../components/Canvas/CanvasElement';

export function useDexieElements(
  _elements: CanvasElementData[],
  onLoad: (elements: CanvasElementData[]) => void
) {
  // Load elements from Dexie on mount
  useEffect(() => {
    const loadElements = async () => {
      try {
        const storedElements = await db.elements.toArray();
        if (storedElements.length > 0) {
          // Load image blobs and create object URLs
          const elementsWithUrls = await Promise.all(
            storedElements.map(async (el) => {
              if (el.type === 'image' && el.id) {
                // Use blobKey if present so we load the correct version of the
                // blob (e.g. after background removal stores under a new key).
                const lookupKey = el.blobKey || el.id;
                const imageBlob = await db.imageBlobs.get(lookupKey);
                if (imageBlob) {
                  return {
                    ...el,
                    src: URL.createObjectURL(imageBlob.blob),
                  };
                }
              }
              return el;
            })
          );
          onLoad(elementsWithUrls);
        }
      } catch (error) {
        console.error('Failed to load elements from Dexie:', error);
      }
    };

    loadElements();
  }, [onLoad]);

  // Save elements to Dexie whenever they change
  const saveElements = useCallback(async (elementsToSave: CanvasElementData[]) => {
    try {
      await db.elements.clear();
      const elementsWithTimestamp = elementsToSave.map((el) => ({
        ...el,
        storedAt: Date.now(),
      }));
      await db.elements.bulkAdd(elementsWithTimestamp);
    } catch (error) {
      console.error('Failed to save elements to Dexie:', error);
    }
  }, []);

  return { saveElements };
}
