import { API_BASE } from './api';

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

export class CallRecorder {
  private recorder: MediaRecorder | null = null;
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
      videoBitsPerSecond: 1_500_000, // 1.5 Mbps
      audioBitsPerSecond: 128_000, // 128 kbps
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
    formData.append('sessionId', this.sessionId);
    formData.append('chunkIndex', String(index));
    formData.append('chunk', blob, `chunk-${index}.webm`);
    formData.append('isFinal', String(this.recorder?.state === 'inactive'));

    try {
      await fetch(`${API_BASE}/api/call/chunk`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
    } catch (err) {
      console.error(`[CallRecorder] Failed to upload chunk ${index}:`, err);
    }
  }
}