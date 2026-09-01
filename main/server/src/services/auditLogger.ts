import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { s3 } from './storageAdapter';

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'sstech-storage';

const memBuffer = new Map<string, string>();

async function flushToR2(dateStr: string) {
  const key = `logs/audit-${dateStr}.ndjson`;
  let existing = '';
  
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    existing = await res.Body?.transformToString() || '';
  } catch (err: any) {
    // Ignore NoSuchKey
  }

  const newData = memBuffer.get(dateStr) || '';
  if (!newData && !existing) return;

  const combined = existing + newData;
  
  try {
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: combined,
      ContentType: 'application/x-ndjson'
    }));
    // Clear buffer after successful upload
    memBuffer.set(dateStr, '');
  } catch (err) {
    console.error('[AuditLogger] CRITICAL: R2 upload failed:', err);
  }
}

export const auditLogger = {
  write(event: Record<string, unknown>): void {
    const ts = new Date();
    const dateStr = ts.toISOString().split('T')[0];
    const entry = JSON.stringify({ ts: ts.toISOString(), ...event }) + '\n';
    
    const current = memBuffer.get(dateStr) || '';
    memBuffer.set(dateStr, current + entry);
    
    // Fire and forget upload (or await if you wanted blocking)
    flushToR2(dateStr).catch(() => {});
  },
};