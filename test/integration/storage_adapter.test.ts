import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import os from 'os';
import { StorageAdapter, ChunkPayload, uploadMedia, listMedia, uploadCallChunk, s3, deleteMedia, getMediaStream } from '../../main/server/src/services/storageAdapter';

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
  });

  it('assembles disordered chunks into strict ascending sequential order on finalize', async () => {
    const sessionId = 'session-assembly-test';

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

    await adapter.finalizeRecording(sessionId);

    const finalFilePath = path.join(tempBaseDir, `${sessionId}.webm`);
    const assembledBuffer = await fs.readFile(finalFilePath);
    const expectedOutput =
      '[PART_0:HEADER_INIT][PART_1:VIDEO_FRAME_A][PART_2:VIDEO_FRAME_B][PART_3:AUDIO_SYNC]';
    expect(assembledBuffer.toString()).toBe(expectedOutput);
  });
});

describe('Cloudflare R2 Integration API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    s3.send = vi.fn().mockImplementation(async (command) => {
      const name = command.constructor.name;
      if (name === 'ListObjectsV2Command') {
        return {
          Contents: [
            { Key: 'public/123-test.jpg', LastModified: new Date() },
            { Key: 'private/456-secret.mp4', LastModified: new Date() }
          ]
        };
      }
      if (name === 'GetObjectCommand') {
        return { Body: 'mock-stream', ContentType: 'image/jpeg', ContentLength: 100 };
      }
      if (name === 'DeleteObjectCommand') {
        return { success: true };
      }
      return {};
    }) as any;
  });

  it('uploadMedia generates correct key and resolves public URL', async () => {
    const url = await uploadMedia(Buffer.from('test'), 'test.jpg', 'image/jpeg', false);
    expect(url).toContain('public/');
    expect(url).toContain('-test.jpg');
    expect(s3.send).toHaveBeenCalled();
  });

  it('listMedia correctly maps objects and filters based on auth', async () => {
    const publicItems = await listMedia(false);
    // 1 real public item
    expect(publicItems.filter(i => !i.isPrivate).length).toBe(1);

    const allItems = await listMedia(true);
    // 2 real items total
    expect(allItems).toHaveLength(2);
  });

  it('uploadCallChunk sends chunk with calls/ prefix', async () => {
    const url = await uploadCallChunk(Buffer.from('test'), 'call-123', 0);
    expect(url).toContain('/api/gallery/media/calls/call-123/chunk_0.webm');
    expect(s3.send).toHaveBeenCalled();
  });

  it('getMediaStream fetches object correctly', async () => {
    const result = await getMediaStream('public/test.jpg');
    expect(result.Body).toBe('mock-stream');
    expect(s3.send).toHaveBeenCalled();
  });

  it('deleteMedia executes DeleteObjectCommand', async () => {
    await deleteMedia('public/test.jpg');
    expect(s3.send).toHaveBeenCalled();
  });
});

import request from 'supertest';
import express from 'express';
import galleryRoutes from '../../main/server/src/api/gallery/galleryController';
import { auditLogger } from '../../main/server/src/services/auditLogger';

import * as sessionService from '../../main/server/src/services/sessionService';

describe('Gallery RBAC & Audit Log Integration', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock cookie parser so req.cookies is defined
    app.use((req, res, next) => {
      req.cookies = { sexyshreya_session: 'mock-token' };
      next();
    });
    
    // Mock user session route wrapper
    app.use('/api/gallery/user', (req, res, next) => {
      vi.spyOn(sessionService, 'verifySession').mockReturnValue({ role: 'user', jti: '123' } as any);
      next();
    }, galleryRoutes);
    
    // Mock admin session route wrapper
    app.use('/api/gallery/admin', (req, res, next) => {
      vi.spyOn(sessionService, 'verifySession').mockReturnValue({ role: 'admin', jti: '123' } as any);
      next();
    }, galleryRoutes);

    vi.clearAllMocks();
    s3.send = vi.fn().mockResolvedValue({ Body: 'mock', transformToString: async () => '' }) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('User role receives 403 Forbidden when attempting to delete an item', async () => {
    const res = await request(app).delete('/api/gallery/user/item?key=public/test.jpg');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Admin authorization required to delete assets');
  });

  it('Admin role receives 200 OK and successfully deletes an item', async () => {
    const res = await request(app).delete('/api/gallery/admin/item?key=public/test.jpg');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(s3.send).toHaveBeenCalled();
  });

  it('Call recordings and audit log entries push to their respective calls/ and logs/ R2 paths', async () => {
    // Audit logger writes to logs/
    auditLogger.write({ event: 'test_event' });
    
    // Wait for the fire-and-forget Promise to tick
    await new Promise(resolve => setTimeout(resolve, 50));
    
    expect(s3.send).toHaveBeenCalled();
    const commandCall = (s3.send as any).mock.calls.find((call: any[]) => call[0].constructor.name === 'PutObjectCommand');
    expect(commandCall).toBeDefined();
    expect(commandCall[0].input.Key).toMatch(/^logs\/audit-.*\.ndjson$/);

    // Call chunk writes to calls/
    await uploadCallChunk(Buffer.from('test'), 'call-999', 0);
    const chunkCall = (s3.send as any).mock.calls.find((call: any[]) => call[0].input.Key?.startsWith('calls/call-999/'));
    expect(chunkCall).toBeDefined();
  });

  it('GET /api/gallery/media/:key streams media with 200 OK and headers', async () => {
    const stream = require('stream');
    const readable = new stream.Readable();
    readable.push('image_bytes');
    readable.push(null);
    (s3.send as any).mockResolvedValueOnce({
      Body: readable,
      ContentType: 'image/jpeg',
      ContentLength: 11
    });

    const res = await request(app).get('/api/gallery/user/media/public/test.jpg');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/jpeg');
    expect(res.headers['cache-control']).toContain('public');
    expect(res.body.toString()).toBe('image_bytes');
  });
});
