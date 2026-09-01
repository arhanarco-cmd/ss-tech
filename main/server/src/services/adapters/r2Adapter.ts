import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { StorageAdapter, ChunkPayload } from "../storageAdapter";

export class R2Adapter implements StorageAdapter {
  private r2Client: S3Client;
  private bucket: string;

  constructor() {
    this.r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
    this.bucket = process.env.R2_BUCKET_NAME!;
  }

  private chunkKey(sessionId: string, chunkIndex: number): string {
    return `chunks/${sessionId}/chunk-${String(chunkIndex).padStart(
      5,
      "0"
    )}.webm`;
  }

  private recordingKey(sessionId: string): string {
    return `recordings/${sessionId}.webm`;
  }

  async saveChunk(payload: ChunkPayload): Promise<void> {
    await this.r2Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.chunkKey(payload.sessionId, payload.chunkIndex),
        Body: payload.data,
        ContentType: payload.mimeType,
      })
    );
  }

  async finalizeRecording(sessionId: string): Promise<void> {
    const list = await this.r2Client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: `chunks/${sessionId}/`,
      })
    );

    const keys = (list.Contents ?? []).map((o) => o.Key!).sort();
    const parts: Buffer[] = [];

    for (const key of keys) {
      const obj = await this.r2Client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );
      const data = await streamToBuffer(obj.Body as NodeJS.ReadableStream);
      parts.push(data);
    }

    const assembled = Buffer.concat(parts);

    await this.r2Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.recordingKey(sessionId),
        Body: assembled,
        ContentType: "video/webm",
      })
    );

    await this.cleanupChunks(sessionId);
  }

  async cleanupChunks(sessionId: string): Promise<void> {
    const list = await this.r2Client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: `chunks/${sessionId}/`,
      })
    );

    for (const obj of list.Contents ?? []) {
      await this.r2Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: obj.Key!,
        })
      );
    }
  }
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (d) =>
      chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d))
    );
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", (err) => reject(err));
  });
}

