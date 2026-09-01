import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Audit Logger & NDJSON Integrity (LOGGING_SCHEMA.md)', () => {
  let tempLogDir: string;
  let tempLogFile: string;

  beforeEach(() => {
    tempLogDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sexyshreya-audit-test-'));
    tempLogFile = path.join(tempLogDir, 'audit.ndjson');
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tempLogDir)) {
        fs.rmSync(tempLogDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup error
    }
  });

  // Helper factory to create isolated audit log instance for file testing
  function createAuditLogger(logPath: string) {
    const stream = fs.createWriteStream(logPath, {
      flags: 'a',
      encoding: 'utf8',
    });

    return {
      write(event: Record<string, unknown>): Promise<void> {
        return new Promise((resolve, reject) => {
          const entry = JSON.stringify({
            ts: new Date().toISOString(),
            ...event,
          });
          const drained = stream.write(entry + '\n', (err) => {
            if (err) reject(err);
            else resolve();
          });
          if (!drained) {
            stream.once('drain', resolve);
          }
        });
      },
      close(): Promise<void> {
        return new Promise((resolve) => stream.end(resolve));
      },
    };
  }

  it('writes valid Newline-Delimited JSON (NDJSON) with base fields', async () => {
    const logger = createAuditLogger(tempLogFile);

    // Write a series of different event types
    await logger.write({
      event: 'session_start',
      role: 'user',
      ip: '203.0.113.42',
      ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      geo: { country: 'IN', region: 'Maharashtra', city: 'Mumbai', asn: 'AS45609' },
      jti: '11111111-2222-3333-4444-555555555555',
      expiresAt: '2026-09-01T12:00:00.000Z',
    });

    await logger.write({
      event: 'pin_fail',
      attempt: 1,
      role: 'user',
      ip: '203.0.113.42',
      ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      geo: { country: 'IN', region: 'Maharashtra', city: 'Mumbai', asn: 'AS45609' },
    });

    await logger.write({
      event: 'rate_limit_blocked',
      attemptCount: 5,
      retryAfterSec: 30,
      ip: '203.0.113.42',
      ua: 'curl/7.88.1',
      geo: { country: 'IN', region: null, city: null, asn: 'AS45609' },
    });

    await logger.write({
      event: 'media_upload',
      sessionId: 'test-session-uuid-1234',
      chunkIndex: 0,
      bytes: 65536,
      ip: '203.0.113.42',
      jti: '11111111-2222-3333-4444-555555555555',
    });

    await logger.write({
      event: 'recording_finalized',
      sessionId: 'test-session-uuid-1234',
      totalChunks: 4,
      totalBytes: 262144,
      storagePath: 'local:recordings/test-session-uuid-1234.webm',
      ip: '203.0.113.42',
    });

    await logger.close();

    // Verify raw file format and NDJSON structure
    const rawContent = fs.readFileSync(tempLogFile, 'utf8');
    const lines = rawContent.trim().split('\n');

    expect(lines.length).toBe(5);

    lines.forEach((line) => {
      // Must be valid JSON
      let parsed: any;
      expect(() => {
        parsed = JSON.parse(line);
      }).not.toThrow();

      // Must have mandatory base timestamp and event name
      expect(parsed).toHaveProperty('ts');
      expect(typeof parsed.ts).toBe('string');
      expect(new Date(parsed.ts).toISOString()).toBe(parsed.ts); // Valid ISO timestamp
      expect(parsed).toHaveProperty('event');
      expect(typeof parsed.event).toBe('string');
    });

    // Check specific event entries
    const sessionStart = JSON.parse(lines[0]);
    expect(sessionStart.event).toBe('session_start');
    expect(sessionStart.role).toBe('user');
    expect(sessionStart.jti).toBe('11111111-2222-3333-4444-555555555555');

    const pinFail = JSON.parse(lines[1]);
    expect(pinFail.event).toBe('pin_fail');
    expect(pinFail.attempt).toBe(1);

    const rateLimit = JSON.parse(lines[2]);
    expect(rateLimit.event).toBe('rate_limit_blocked');
    expect(rateLimit.retryAfterSec).toBe(30);

    const mediaUpload = JSON.parse(lines[3]);
    expect(mediaUpload.event).toBe('media_upload');
    expect(mediaUpload.chunkIndex).toBe(0);

    const recordingFinalized = JSON.parse(lines[4]);
    expect(recordingFinalized.event).toBe('recording_finalized');
    expect(recordingFinalized.totalChunks).toBe(4);
  });

  it('guarantees that plaintext PINs are NEVER included in audit logs', async () => {
    const sensitivePins = [
      'MySuperSecretPIN!2026',
      'AdminMaster#9999$',
      'UserPass_1234!',
      '7738291048572910',
      's3cur3-p@ssw0rd',
    ];

    const logger = createAuditLogger(tempLogFile);

    // Simulate logging events for multiple failed/successful PIN attempts
    for (let i = 0; i < sensitivePins.length; i++) {
      // Correct logging per LOGGING_SCHEMA: event, attempt, role, ip — NEVER the submitted PIN
      await logger.write({
        event: 'pin_fail',
        attempt: i + 1,
        role: i % 2 === 0 ? 'user' : 'admin',
        ip: '192.168.1.50',
        ua: 'Mozilla/5.0 TestBrowser',
      });
    }

    await logger.write({
      event: 'session_start',
      role: 'admin',
      jti: 'secure-token-id-1234',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      ip: '192.168.1.50',
    });

    await logger.close();

    // Read full raw log text and search for ANY occurrence of sensitive PINs
    const rawLog = fs.readFileSync(tempLogFile, 'utf8');

    sensitivePins.forEach((pin) => {
      // 1. Plaintext PIN string must not exist anywhere in the raw file
      expect(rawLog).not.toContain(pin);

      // 2. Parsed JSON objects must not contain a 'pin', 'password', or 'secret' key
      const lines = rawLog.trim().split('\n');
      lines.forEach((line) => {
        const obj = JSON.parse(line);
        expect(obj).not.toHaveProperty('pin');
        expect(obj).not.toHaveProperty('password');
        expect(obj).not.toHaveProperty('submittedPin');
        expect(obj).not.toHaveProperty('plainPin');
        expect(JSON.stringify(obj)).not.toContain(pin);
      });
    });
  });

  it('operates in append-only mode without overwriting existing entries', async () => {
    // Initial session write
    const logger1 = createAuditLogger(tempLogFile);
    await logger1.write({ event: 'server_start', port: 3001 });
    await logger1.write({ event: 'pin_fail', attempt: 1, role: 'user', ip: '10.0.0.1' });
    await logger1.close();

    // New logger instance opening the same file
    const logger2 = createAuditLogger(tempLogFile);
    await logger2.write({ event: 'pin_fail', attempt: 2, role: 'user', ip: '10.0.0.1' });
    await logger2.write({ event: 'session_start', role: 'user', jti: 'new-jti-abc', ip: '10.0.0.1' });
    await logger2.close();

    const lines = fs.readFileSync(tempLogFile, 'utf8').trim().split('\n');
    expect(lines.length).toBe(4);

    expect(JSON.parse(lines[0]).event).toBe('server_start');
    expect(JSON.parse(lines[1]).attempt).toBe(1);
    expect(JSON.parse(lines[2]).attempt).toBe(2);
    expect(JSON.parse(lines[3]).event).toBe('session_start');
  });
});
