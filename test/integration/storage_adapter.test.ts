import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import os from 'os';
import { StorageAdapter, ChunkPayload } from '../../main/server/src/services/storageAdapter';

// Testable LocalAdapter class that allows configurable base recordings directory
class TestableLocalAdapter implements StorageAdapter {
  constructor(private recordingsDir: string) {}

  private async ensureSessionDir(sessionId: string): Promise<string> {
    const dir = path.join(this.recordingsDir, sessionId);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  async saveChunk(payload: ChunkPayload): Promise<void> {
    const dir = await this.ensureSessionDir(payload.sessionId);
    const file = path.join(
      dir,
      `chunk-${String(payload.chunkIndex).padStart(5, '0')}.webm`
    );
    await fs.writeFile(file, payload.data);
  }

  async finalizeRecording(sessionId: string): Promise<void> {
    const dir = await this.ensureSessionDir(sessionId);
    const chunks = (await fs.readdir(dir))
      .filter((f) => f.startsWith('chunk-') && f.endsWith('.webm'))
      .sort();

    const outPath = path.join(this.recordingsDir, `${sessionId}.webm`);
    const outFile = await fs.open(outPath, 'w');

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
    const dir = path.join(this.recordingsDir, sessionId);
    await fs.rm(dir, { recursive: true, force: true });
  }
}

describe('Storage Adapter & Chunk Assembly (STORAGE_PIPELINE.md §6.2)', () => {
  let tempBaseDir: string;
  let adapter: TestableLocalAdapter;

  beforeEach(async () => {
    tempBaseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sexyshreya-storage-test-'));
    adapter = new TestableLocalAdapter(tempBaseDir);
  });

  afterEach(async () => {
    try {
      if (existsSync(tempBaseDir)) {
        await fs.rm(tempBaseDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup error
    }
  });

  it('saves chunks into zero-padded file names in session staging directory', async () => {
    const sessionId = 'session-test-001';

    await adapter.saveChunk({
      sessionId,
      chunkIndex: 0,
      data: Buffer.from('CHUNK_0_HEADER'),
      mimeType: 'video/webm',
    });

    await adapter.saveChunk({
      sessionId,
      chunkIndex: 5,
      data: Buffer.from('CHUNK_5_DATA'),
      mimeType: 'video/webm',
    });

    const sessionDir = path.join(tempBaseDir, sessionId);
    expect(existsSync(sessionDir)).toBe(true);

    const chunk0 = path.join(sessionDir, 'chunk-00000.webm');
    const chunk5 = path.join(sessionDir, 'chunk-00005.webm');

    expect(existsSync(chunk0)).toBe(true);
    expect(existsSync(chunk5)).toBe(true);

    const data0 = await fs.readFile(chunk0);
    expect(data0.toString()).toBe('CHUNK_0_HEADER');
  });

  it('assembles disordered chunks into strict ascending sequential order on finalize', async () => {
    const sessionId = 'session-assembly-test';

    // Chunks saved deliberately in disordered arrival sequence: 3 -> 0 -> 2 -> 1
    const rawChunks = [
      { index: 3, content: '[PART_3:AUDIO_SYNC]' },
      { index: 0, content: '[PART_0:HEADER_INIT]' },
      { index: 2, content: '[PART_2:VIDEO_FRAME_B]' },
      { index: 1, content: '[PART_1:VIDEO_FRAME_A]' },
    ];

    for (const chunk of rawChunks) {
      await adapter.saveChunk({
        sessionId,
        chunkIndex: chunk.index,
        data: Buffer.from(chunk.content),
        mimeType: 'video/webm',
      });
    }

    // Trigger finalization
    await adapter.finalizeRecording(sessionId);

    // 1. Output file must exist
    const finalFilePath = path.join(tempBaseDir, `${sessionId}.webm`);
    expect(existsSync(finalFilePath)).toBe(true);

    // 2. Output content must be strictly concatenated in sequential order (0 -> 1 -> 2 -> 3)
    const assembledBuffer = await fs.readFile(finalFilePath);
    const expectedOutput =
      '[PART_0:HEADER_INIT][PART_1:VIDEO_FRAME_A][PART_2:VIDEO_FRAME_B][PART_3:AUDIO_SYNC]';
    expect(assembledBuffer.toString()).toBe(expectedOutput);

    // 3. Staging directory must be cleaned up
    const stagingDir = path.join(tempBaseDir, sessionId);
    expect(existsSync(stagingDir)).toBe(false);
  });

  it('correctly orders 10+ chunks verifying 5-digit zero-padding sorting', async () => {
    const sessionId = 'session-many-chunks';
    const totalChunks = 15;

    // Send chunks in reverse order: 14 down to 0
    for (let i = totalChunks - 1; i >= 0; i--) {
      await adapter.saveChunk({
        sessionId,
        chunkIndex: i,
        data: Buffer.from(`[C${i}]`),
        mimeType: 'video/webm',
      });
    }

    await adapter.finalizeRecording(sessionId);

    const finalFilePath = path.join(tempBaseDir, `${sessionId}.webm`);
    expect(existsSync(finalFilePath)).toBe(true);

    const assembled = (await fs.readFile(finalFilePath)).toString();
    const expected = Array.from({ length: totalChunks }, (_, i) => `[C${i}]`).join('');

    expect(assembled).toBe(expected);
  });

  it('cleans up chunks directory on cleanupChunks call', async () => {
    const sessionId = 'session-cleanup-test';

    await adapter.saveChunk({
      sessionId,
      chunkIndex: 0,
      data: Buffer.from('data'),
      mimeType: 'video/webm',
    });

    const sessionDir = path.join(tempBaseDir, sessionId);
    expect(existsSync(sessionDir)).toBe(true);

    await adapter.cleanupChunks(sessionId);
    expect(existsSync(sessionDir)).toBe(false);
  });
});
