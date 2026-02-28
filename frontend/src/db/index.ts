import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { CanvasElementData } from '../components/Canvas/CanvasElement';

export interface StoredCanvasElement extends CanvasElementData {
  storedAt?: number;
}

export interface ImageBlob {
  id: string;
  blob: Blob;
  storedAt: number;
}

export class MultiMemeDB extends Dexie {
  elements!: Table<StoredCanvasElement>;
  imageBlobs!: Table<ImageBlob>;

  constructor() {
    super('MultiMemeDB');
    this.version(1).stores({
      elements: 'id',
    });
    this.version(2).stores({
      elements: 'id',
      imageBlobs: 'id',
    });
  }
}

export const db = new MultiMemeDB();
