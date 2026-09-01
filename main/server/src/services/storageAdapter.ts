export interface ChunkPayload {
  sessionId: string;
  chunkIndex: number;
  data: Buffer;
  mimeType: string;
}

export interface StorageAdapter {
  saveChunk(payload: ChunkPayload): Promise<void>;
  finalizeRecording(sessionId: string): Promise<void>;
  cleanupChunks(sessionId: string): Promise<void>;
}

