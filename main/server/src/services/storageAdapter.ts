import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

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

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || 'demo-account';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || 'demo-access-key';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || 'demo-secret-key';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'sstech-storage';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || `https://pub-${R2_ACCOUNT_ID}.r2.dev`;

export const s3 = new S3Client({
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  region: 'auto',
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export async function uploadMedia(fileBuffer: Buffer, originalName: string, mimeType: string, isPrivate: boolean) {
  const uuid = uuidv4();
  const folder = isPrivate ? 'private' : 'public';
  const key = `${folder}/${uuid}-${originalName}`;
  
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: mimeType,
  });

  await s3.send(command);
  
  // Use direct proxy route to bypass R2 public bucket rules
  return `/api/gallery/media/${key}`;
}

export async function getMediaStream(key: string) {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });
  return s3.send(command);
}

export async function deleteMedia(key: string) {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });
  return s3.send(command);
}

export async function listMedia(includePrivate: boolean) {
  const command = new ListObjectsV2Command({
    Bucket: R2_BUCKET_NAME,
  });
  
  let result: any[] = [];
  try {
    const response = await s3.send(command);
    const items = response.Contents || [];
    
    result = items.map(item => {
      const isPriv = item.Key?.startsWith('private/') || false;
      return {
        id: item.Key,
        url: `/api/gallery/media/${item.Key}`, // Proxy through backend
        title: item.Key?.split('-').slice(1).join('-') || 'Untitled',
        isPrivate: isPriv,
        createdAt: item.LastModified?.toISOString(),
      };
    });
    
    // Sort descending by created date
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.error('S3 list err:', err);
  }

  if (!includePrivate) {
    return result.filter(r => !r.isPrivate);
  }
  
  return result;
}

export async function uploadCallChunk(buffer: Buffer, callId: string, chunkIndex: number) {
  const key = `calls/${callId}/chunk_${chunkIndex}.webm`;
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: 'video/webm',
  });
  await s3.send(command);
  return `/api/gallery/media/${key}`;
}
