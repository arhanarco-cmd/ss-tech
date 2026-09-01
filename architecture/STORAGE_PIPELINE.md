# Storage Pipeline Specification
**Project:** sexyshreya — High-Security Interactive Web Gallery  
**Document:** STORAGE_PIPELINE.md  
**Version:** 1.0.0  
**Date:** 2026-09-01  
**Classification:** Production-Grade Technical Specification

---

## 1. Overview

This document specifies the end-to-end pipeline for recording dual-party video calls, compositing local and remote WebRTC streams into a unified output, transmitting data in time-bounded chunks, and persisting recordings through a modular Storage Adapter.

---

## 2. Recording Architecture — High-Level Flow

```
┌──────────────────────── Browser (Client) ──────────────────────┐
│                                                                  │
│  Local Camera/Mic ───┐                                           │
│                      ├──▶ Canvas Compositor ──▶ MediaRecorder   │
│  Remote WebRTC  ─────┘          │                     │          │
│                        Mixed AudioContext              │          │
│                                 │                     │          │
│                          captureStream()               │          │
│                                 └─────────────────────┘          │
│                                         │                        │
│                                 ondataavailable (5s)             │
│                                         │                        │
│                                  Chunk Uploader                  │
└─────────────────────────────────────────┼────────────────────────┘
                                          │ POST /api/call/chunk
                                          ▼
┌─────────────────────── Server ─────────────────────────────────┐
│                                                                  │
│  Recording Controller                                            │
│         │                                                        │
│         ▼                                                        │
│  Storage Adapter (interface)                                     │
│         │                                                        │
│         ├─ LocalAdapter  → main/server/storage/recordings/      │
│         └─ R2Adapter     → Cloudflare R2 Bucket                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Client-Side: Canvas Compositor

### 3.1 Stream Sources

| Source       | API                                       | Track Types   |
|--------------|-------------------------------------------|---------------|
| Local (self) | `navigator.mediaDevices.getUserMedia()`   | Video + Audio |
| Remote peer  | `RTCPeerConnection.ontrack` event         | Video + Audio |

### 3.2 Canvas Compositing Strategy

Both video feeds are drawn side-by-side on a single `<canvas>` at 30 fps. The canvas stream is used as the video source for `MediaRecorder`.

```typescript
// src/services/recordingCompositor.ts

const CANVAS_WIDTH  = 1280; // Two 640x360 tiles
const CANVAS_HEIGHT = 360;
const FRAME_RATE    = 30;

export function createCompositeStream(
  localStream:  MediaStream,
  remoteStream: MediaStream
): MediaStream {
  const canvas  = document.createElement('canvas');
  canvas.width  = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx     = canvas.getContext('2d')!;

  const localVideo  = createHiddenVideo(localStream);
  const remoteVideo = createHiddenVideo(remoteStream);

  const interval = setInterval(() => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.drawImage(localVideo,   0, 0, 640, CANVAS_HEIGHT); // Left: local
    ctx.drawImage(remoteVideo, 640, 0, 640, CANVAS_HEIGHT); // Right: remote
    drawLabel(ctx,   0, 'You');
    drawLabel(ctx, 640, 'Admin');
  }, 1000 / FRAME_RATE);

  // Capture canvas video track
  const videoStream = canvas.captureStream(FRAME_RATE);

  // Mix audio from both sources
  const audioContext = new AudioContext();
  const destination  = audioContext.createMediaStreamDestination();

  [localStream, remoteStream].forEach(stream => {
    if (stream.getAudioTracks().length > 0) {
      audioContext.createMediaStreamSource(stream).connect(destination);
    }
  });

  const compositeStream = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...destination.stream.getAudioTracks(),
  ]);

  compositeStream.addEventListener('inactive', () => {
    clearInterval(interval);
    audioContext.close();
  });

  return compositeStream;
}

function createHiddenVideo(stream: MediaStream): HTMLVideoElement {
  const video      = document.createElement('video');
  video.srcObject  = stream;
  video.muted      = true;
  video.autoplay   = true;
  video.playsInline = true;
  return video;
}

function drawLabel(ctx: CanvasRenderingContext2D, x: number, text: string): void {
  ctx.font      = '16px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(text, x + 12, CANVAS_HEIGHT - 12);
}
```

### 3.3 Audio Context Graph

```
LocalStream  ──▶ MediaStreamSourceNode ──┐
                                         ├──▶ MediaStreamDestinationNode ──▶ Mixed AudioTrack
RemoteStream ──▶ MediaStreamSourceNode ──┘
```

---

## 4. Client-Side: MediaRecorder with 5-Second Chunks

### 4.1 MIME Type Priority

```typescript
const PREFERRED_MIME_TYPES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

function selectMimeType(): string {
  for (const type of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  throw new Error('No supported video MIME type found in this browser');
}
```

### 4.2 MediaRecorder Initialization

```typescript
// src/services/callRecorder.ts

export class CallRecorder {
  private recorder:  MediaRecorder | null = null;
  private chunkIndex = 0;
  private uploadQueue: Promise<void> = Promise.resolve();

  constructor(
    private compositeStream: MediaStream,
    private sessionId: string
  ) {}

  start(): void {
    const mimeType = selectMimeType();

    this.recorder = new MediaRecorder(this.compositeStream, {
      mimeType,
      videoBitsPerSecond: 1_500_000,  // 1.5 Mbps
      audioBitsPerSecond:   128_000,  // 128 kbps
    });

    this.recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        this.uploadQueue = this.uploadQueue.then(() =>
          this.uploadChunk(event.data)
        );
      }
    };

    this.recorder.onerror = () => { this.stop(); };

    // Fire ondataavailable every 5 seconds
    this.recorder.start(5_000);
  }

  stop(): void {
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.stop(); // Fires final ondataavailable
    }
  }

  private async uploadChunk(blob: Blob): Promise<void> {
    const index = this.chunkIndex++;
    const formData = new FormData();
    formData.append('sessionId',  this.sessionId);
    formData.append('chunkIndex', String(index));
    formData.append('chunk', blob, `chunk-${index}.webm`);
    formData.append('isFinal', String(this.recorder?.state === 'inactive'));

    try {
      await fetch('/api/call/chunk', {
        method:      'POST',
        body:        formData,
        credentials: 'include',
      });
    } catch (err) {
      console.error(`[CallRecorder] Failed to upload chunk ${index}:`, err);
    }
  }
}
```

### 4.3 Recording Lifecycle

```
User enters call room
        │
getUserMedia() + RTCPeerConnection established
        │
createCompositeStream(local, remote)
        │
new CallRecorder(compositeStream, sessionId).start()
        │
        ▼ (every 5 seconds)
ondataavailable → uploadChunk(blob) → POST /api/call/chunk
        │
        ▼ (call ends)
recorder.stop() → final chunk (isFinal=true) uploaded
        │
Server assembles chunks → finalized recording file
```

---

## 5. Server-Side: Recording Endpoint

```typescript
// src/api/call/callController.ts
const upload = multer({ storage: multer.memoryStorage() });

router.post(
  '/chunk',
  authenticate,
  upload.single('chunk'),
  async (req, res) => {
    const { sessionId, chunkIndex, isFinal } = req.body;
    const chunkBuffer = req.file?.buffer;

    if (!sessionId || chunkIndex === undefined || !chunkBuffer) {
      return res.status(400).json({ error: 'Invalid chunk payload' });
    }

    await storageService.saveChunk({
      sessionId,
      chunkIndex: Number(chunkIndex),
      data:       chunkBuffer,
      mimeType:   req.file!.mimetype,
    });

    auditLogger.write({
      event: 'media_upload', sessionId,
      chunkIndex: Number(chunkIndex), bytes: chunkBuffer.byteLength, ip: req.ip,
    });

    if (isFinal === 'true') {
      await storageService.finalizeRecording(sessionId);
      auditLogger.write({ event: 'recording_finalized', sessionId });
    }

    res.status(200).json({ received: true });
  }
);
```

---

## 6. Storage Adapter Pattern

### 6.1 Interface Contract

```typescript
// src/services/storageAdapter.ts

export interface ChunkPayload {
  sessionId:  string;
  chunkIndex: number;
  data:       Buffer;
  mimeType:   string;
}

export interface StorageAdapter {
  saveChunk(payload: ChunkPayload): Promise<void>;
  finalizeRecording(sessionId: string): Promise<void>;
  cleanupChunks(sessionId: string): Promise<void>;
}
```

### 6.2 Local Filesystem Adapter (Development)

```typescript
// src/services/adapters/localAdapter.ts
import path from 'path';
import fs   from 'fs/promises';

const RECORDINGS_DIR = path.resolve(__dirname, '../../storage/recordings');

export class LocalAdapter implements StorageAdapter {
  private async ensureSessionDir(sessionId: string): Promise<string> {
    const dir = path.join(RECORDINGS_DIR, sessionId);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  async saveChunk(payload: ChunkPayload): Promise<void> {
    const dir  = await this.ensureSessionDir(payload.sessionId);
    const file = path.join(dir, `chunk-${String(payload.chunkIndex).padStart(5,'0')}.webm`);
    await fs.writeFile(file, payload.data);
  }

  async finalizeRecording(sessionId: string): Promise<void> {
    const dir    = await this.ensureSessionDir(sessionId);
    const chunks = (await fs.readdir(dir))
      .filter(f => f.startsWith('chunk-') && f.endsWith('.webm'))
      .sort();

    const outPath = path.join(RECORDINGS_DIR, `${sessionId}.webm`);
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
    const dir = path.join(RECORDINGS_DIR, sessionId);
    await fs.rm(dir, { recursive: true, force: true });
  }
}
```

**Local directory layout:**
```
main/server/storage/recordings/
├── <sessionId>/               ← Chunk staging directory
│   ├── chunk-00000.webm
│   ├── chunk-00001.webm
│   └── chunk-00002.webm
└── <sessionId>.webm           ← Finalized assembled recording
```

### 6.3 Cloudflare R2 Adapter (Production)

```typescript
// src/services/adapters/r2Adapter.ts
import {
  S3Client, PutObjectCommand, GetObjectCommand,
  DeleteObjectCommand, ListObjectsV2Command,
} from '@aws-sdk/client-s3';

const r2Client = new S3Client({
  region:   'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;

export class R2Adapter implements StorageAdapter {
  private chunkKey(sessionId: string, index: number): string {
    return `chunks/${sessionId}/chunk-${String(index).padStart(5,'0')}.webm`;
  }

  private recordingKey(sessionId: string): string {
    return `recordings/${sessionId}.webm`;
  }

  async saveChunk(payload: ChunkPayload): Promise<void> {
    await r2Client.send(new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         this.chunkKey(payload.sessionId, payload.chunkIndex),
      Body:        payload.data,
      ContentType: payload.mimeType,
    }));
  }

  async finalizeRecording(sessionId: string): Promise<void> {
    const list = await r2Client.send(new ListObjectsV2Command({
      Bucket: BUCKET, Prefix: `chunks/${sessionId}/`,
    }));

    const keys   = (list.Contents ?? []).map(o => o.Key!).sort();
    const parts: Buffer[] = [];

    for (const key of keys) {
      const obj  = await r2Client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
      const data = await streamToBuffer(obj.Body as NodeJS.ReadableStream);
      parts.push(data);
    }

    await r2Client.send(new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         this.recordingKey(sessionId),
      Body:        Buffer.concat(parts),
      ContentType: 'video/webm',
    }));

    await this.cleanupChunks(sessionId);
  }

  async cleanupChunks(sessionId: string): Promise<void> {
    const list = await r2Client.send(new ListObjectsV2Command({
      Bucket: BUCKET, Prefix: `chunks/${sessionId}/`,
    }));
    for (const obj of list.Contents ?? []) {
      await r2Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: obj.Key! }));
    }
  }
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data',  d   => chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
    stream.on('end',   ()  => resolve(Buffer.concat(chunks)));
    stream.on('error', err => reject(err));
  });
}
```

### 6.4 Storage Service Factory

```typescript
// src/services/storageService.ts
function createAdapter(): StorageAdapter {
  switch (process.env.STORAGE_ADAPTER ?? 'local') {
    case 'r2':    return new R2Adapter();
    case 'local': return new LocalAdapter();
    default:
      throw new Error(`Unknown STORAGE_ADAPTER: "${process.env.STORAGE_ADAPTER}"`);
  }
}

export const storageService: StorageAdapter = createAdapter();
```

Switching adapters requires only one environment variable change — no code changes:

```env
STORAGE_ADAPTER=local   # Development
STORAGE_ADAPTER=r2      # Production
```

---

## 7. Recording Finalization Sequence

```
Client sends final chunk (isFinal=true)
        │
        ├─ storageService.saveChunk(finalChunk)
        │
        └─ storageService.finalizeRecording(sessionId)
                    │
                    ├─ Sort chunks by zero-padded index
                    ├─ Concatenate into single .webm file
                    ├─ Write to storage (local or R2)
                    └─ cleanupChunks(sessionId)
                                │
                                ▼
                    auditLogger.write({ event: 'recording_finalized' })
```

---

## 8. Security Considerations

| Concern                    | Mitigation                                                      |
|----------------------------|-----------------------------------------------------------------|
| Unauthorized upload        | Chunk endpoint requires valid `sexyshreya_session` cookie           |
| Session ID forgery         | Session ID validated against JWT `jti` claim                    |
| Path traversal in filenames| Session IDs are UUIDv4 — validated with regex before use        |
| Storage overflow           | Max chunk size enforced via `multer({ limits: { fileSize } })`  |
| R2 credential exposure     | Credentials in environment variables only; not in source control|
| Incomplete recordings      | Abandoned sessions cleaned up via TTL-based scheduled job       |

---

## 9. Production Dependencies

```json
{
  "dependencies": {
    "@aws-sdk/client-s3": "^3.0.0",
    "multer":             "^1.4.5",
    "uuid":               "^9.0.0"
  },
  "devDependencies": {
    "@types/multer": "^1.4.11"
  }
}
```
