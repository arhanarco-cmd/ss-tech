import path from "path";
import fs from "fs/promises";
import { StorageAdapter, ChunkPayload } from "../storageAdapter";

const RECORDINGS_DIR = path.resolve(__dirname, "../../../storage/recordings");

export class LocalAdapter implements StorageAdapter {
  private async ensureSessionDir(sessionId: string): Promise<string> {
    const dir = path.join(RECORDINGS_DIR, sessionId);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  async saveChunk(payload: ChunkPayload): Promise<void> {
    const dir = await this.ensureSessionDir(payload.sessionId);
    const file = path.join(
      dir,
      `chunk-${String(payload.chunkIndex).padStart(5, "0")}.webm`
    );
    await fs.writeFile(file, payload.data);
  }

  async finalizeRecording(sessionId: string): Promise<void> {
    const dir = await this.ensureSessionDir(sessionId);
    const chunks = (await fs.readdir(dir))
      .filter((f) => f.startsWith("chunk-") && f.endsWith(".webm"))
      .sort();

    const outPath = path.join(RECORDINGS_DIR, `${sessionId}.webm`);
    const outFile = await fs.open(outPath, "w");

    try {
      for (const chunk of chunks) {
        const data = await fs.readFile(path.join(dir, chunk));
        await outFile.write(data);
      }
    } finally {
      await outFile.close();
    }

    await this.cleanupChunks(sessionId);
  }

  async cleanupChunks(sessionId: string): Promise<void> {
    const dir = path.join(RECORDINGS_DIR, sessionId);
    await fs.rm(dir, { recursive: true, force: true });
  }
}

