# Audit Logging Schema
**Project:** sexyshreya — High-Security Interactive Web Gallery  
**Document:** LOGGING_SCHEMA.md  
**Version:** 1.0.0  
**Date:** 2026-09-01  
**Classification:** Security-Critical / Compliance

---

## 1. Overview

The sexyshreya audit logger is an **append-only, structured event logger** capturing all security-relevant system activity.

**Primary purposes:**
- **Security forensics:** Reconstruct attack sequences from failed PIN attempts, IP patterns, session anomalies
- **Compliance:** Tamper-evident record of system access
- **Operational monitoring:** Recording pipeline health and storage events

> **Immutability Guarantee:** The audit log file is only ever opened in append mode (`flags: 'a'`). No rotation mechanism truncates or overwrites existing entries.

---

## 2. Output Format — NDJSON

All audit events are written as **Newline-Delimited JSON (NDJSON)**, one JSON object per line.

**File path (default):** `main/server/src/logs/audit.ndjson`

**Example entries:**
```ndjson
{"ts":"2026-09-01T07:53:43.221Z","event":"session_start","role":"user","ip":"203.0.113.42","ua":"Mozilla/5.0...","geo":{"country":"IN","region":"Maharashtra","city":"Mumbai","asn":"AS45609"}}
{"ts":"2026-09-01T07:54:11.004Z","event":"pin_fail","ip":"203.0.113.42","ua":"Mozilla/5.0...","attempt":1,"role":"user"}
{"ts":"2026-09-01T07:54:30.882Z","event":"media_upload","sessionId":"a1b2c3d4","chunkIndex":3,"bytes":182344,"ip":"203.0.113.42"}
```

NDJSON is chosen because:
- Each line is independently parseable
- `tail -f` streaming works natively
- Compatible with `jq`, Splunk, Loki, and all log aggregation platforms
- Append-safe: a partial final line from a crash does not corrupt prior entries

---

## 3. Base Event Schema

Every audit event shares these base fields:

| Field   | Type   | Required | Description                                    |
|---------|--------|----------|------------------------------------------------|
| `ts`    | string | Yes      | ISO 8601 UTC timestamp with milliseconds       |
| `event` | string | Yes      | Event type identifier (see §4)                 |
| `ip`    | string | Yes      | Client IP address (IPv4 or IPv6)               |
| `ua`    | string | Yes      | User-Agent header string                       |
| `geo`   | object | Yes      | Geolocation from headers (see §3.1)            |
| `reqId` | string | No       | Unique request ID (UUIDv4) for tracing         |

### 3.1 Geolocation Object

Populated from Cloudflare or reverse-proxy headers; falls back to `null` if unavailable.

| Field     | Type          | Source Header    | Example         |
|-----------|---------------|------------------|-----------------|
| `country` | string / null | `CF-IPCountry`   | `"IN"`          |
| `region`  | string / null | `CF-Region`      | `"Maharashtra"` |
| `city`    | string / null | `CF-IPCity`      | `"Mumbai"`      |
| `asn`     | string / null | `CF-ASN`         | `"AS13335"`     |

```typescript
function extractGeo(req: Request): GeoInfo {
  return {
    country: req.headers['cf-ipcountry']  as string ?? null,
    region:  req.headers['cf-region']     as string ?? null,
    city:    req.headers['cf-ipcity']     as string ?? null,
    asn:     req.headers['cf-asn']        as string ?? null,
  };
}
```

---

## 4. Event Catalog

### 4.1 `pin_fail` — Failed PIN Attempt

Emitted every time PIN verification fails.

```typescript
interface PinFailEvent extends BaseEvent {
  event:   'pin_fail';
  attempt: number;                         // Consecutive failures for this IP
  role:    'user' | 'admin' | 'unknown';   // Role attempted
}
```

**Example:**
```json
{
  "ts":      "2026-09-01T07:54:11.004Z",
  "event":   "pin_fail",
  "ip":      "203.0.113.42",
  "ua":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "geo":     { "country": "IN", "region": "Maharashtra", "city": "Mumbai", "asn": "AS45609" },
  "attempt": 3,
  "role":    "user"
}
```

> **Security Note:** The submitted PIN value is **never** included in any log entry.

---

### 4.2 `rate_limit_blocked` — Rate Limit Triggered

Emitted when a request is rejected due to accumulated failed attempts.

```typescript
interface RateLimitBlockedEvent extends BaseEvent {
  event:         'rate_limit_blocked';
  attemptCount:  number;  // Total accumulated failures for this IP
  retryAfterSec: number;  // Seconds until lockout expires
}
```

**Example:**
```json
{
  "ts":            "2026-09-01T07:54:45.781Z",
  "event":         "rate_limit_blocked",
  "ip":            "203.0.113.42",
  "ua":            "curl/7.88.1",
  "geo":           { "country": "IN", "region": null, "city": null, "asn": "AS45609" },
  "attemptCount":  5,
  "retryAfterSec": 30
}
```

---

### 4.3 `session_start` — Successful Login

Emitted when a PIN is verified and a JWT session cookie is issued.

```typescript
interface SessionStartEvent extends BaseEvent {
  event:     'session_start';
  role:      'user' | 'admin';
  jti:       string;  // JWT ID — links to all subsequent session events
  expiresAt: string;  // ISO 8601 timestamp of token expiry
}
```

**Example:**
```json
{
  "ts":        "2026-09-01T08:00:00.000Z",
  "event":     "session_start",
  "ip":        "203.0.113.42",
  "ua":        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  "geo":       { "country": "IN", "region": "Delhi", "city": "New Delhi", "asn": "AS55836" },
  "role":      "admin",
  "jti":       "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "expiresAt": "2026-09-01T09:00:00.000Z"
}
```

---

### 4.4 `session_end` — Logout or Expiry

Emitted on explicit logout, expired token detection, or tamper detection.

```typescript
interface SessionEndEvent extends BaseEvent {
  event:           'session_end';
  role:            'user' | 'admin';
  jti:             string;
  durationSeconds: number;  // Seconds from session_start to session_end
  reason:          'logout' | 'expired' | 'tampered';
}
```

**Example:**
```json
{
  "ts":              "2026-09-01T08:47:12.332Z",
  "event":           "session_end",
  "ip":              "203.0.113.42",
  "ua":              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  "geo":             { "country": "IN", "region": "Delhi", "city": "New Delhi", "asn": "AS55836" },
  "role":            "admin",
  "jti":             "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "durationSeconds": 2832,
  "reason":          "logout"
}
```

---

### 4.5 `media_upload` — Recording Chunk Received

Emitted for every successfully stored recording chunk.

```typescript
interface MediaUploadEvent extends BaseEvent {
  event:      'media_upload';
  sessionId:  string;  // Call session UUID
  chunkIndex: number;  // Zero-based sequence number
  bytes:      number;  // Size of the received chunk in bytes
  jti:        string;  // JWT ID of the uploading session
}
```

**Example:**
```json
{
  "ts":         "2026-09-01T08:15:37.441Z",
  "event":      "media_upload",
  "ip":         "203.0.113.42",
  "ua":         "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  "geo":        { "country": "IN", "region": "Maharashtra", "city": "Pune", "asn": "AS45609" },
  "sessionId":  "b8e3f7c1-9a2d-4e5b-8c0f-1d2e3a4b5c6d",
  "chunkIndex": 7,
  "bytes":      184320,
  "jti":        "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

### 4.6 `recording_finalized` — Recording Assembly Complete

Emitted when all chunks are assembled into a final recording file.

```typescript
interface RecordingFinalizedEvent extends BaseEvent {
  event:       'recording_finalized';
  sessionId:   string;
  totalChunks: number;
  totalBytes:  number;
  storagePath: string;  // "local:recordings/<id>.webm" or "r2:recordings/<id>.webm"
}
```

**Example:**
```json
{
  "ts":          "2026-09-01T08:22:05.119Z",
  "event":       "recording_finalized",
  "ip":          "203.0.113.42",
  "ua":          "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  "geo":         { "country": "IN", "region": "Maharashtra", "city": "Pune", "asn": "AS45609" },
  "sessionId":   "b8e3f7c1-9a2d-4e5b-8c0f-1d2e3a4b5c6d",
  "totalChunks": 8,
  "totalBytes":  1474560,
  "storagePath": "local:recordings/b8e3f7c1-9a2d-4e5b-8c0f-1d2e3a4b5c6d.webm"
}
```

---

### 4.7 `request` — General HTTP Request (Optional / Debug)

Emitted for all `/api/*` requests when `AUDIT_LOG_REQUESTS=true`. Disabled by default in production.

```typescript
interface RequestEvent extends BaseEvent {
  event:      'request';
  method:     string;
  path:       string;
  statusCode: number;
  durationMs: number;
}
```

---

## 5. Audit Logger Implementation

```typescript
// src/services/auditLogger.ts
import fs   from 'fs';
import path from 'path';

const LOG_PATH = process.env.AUDIT_LOG_PATH
  ?? path.resolve(__dirname, '../logs/audit.ndjson');

// Open in append mode — never truncate
const logStream = fs.createWriteStream(LOG_PATH, {
  flags:    'a',
  encoding: 'utf8',
});

logStream.on('error', (err) => {
  // Surface to stderr; must not crash the application
  console.error('[AuditLogger] CRITICAL: Write failed:', err.message);
});

export const auditLogger = {
  write(event: Record<string, unknown>): void {
    const entry = JSON.stringify({ ts: new Date().toISOString(), ...event });
    logStream.write(entry + '\n');
  },
};

process.on('SIGTERM', () => { logStream.end(); });
process.on('SIGINT',  () => { logStream.end(); });
```

### 5.1 Express Middleware Integration

```typescript
// src/middleware/auditLog.ts
export function auditLogMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startMs = Date.now();

  res.on('finish', () => {
    if (req.path.startsWith('/api/')) {
      auditLogger.write({
        event:      'request',
        method:     req.method,
        path:       req.path,
        statusCode: res.statusCode,
        durationMs: Date.now() - startMs,
        ip:         req.ip,
        ua:         req.headers['user-agent'] ?? 'unknown',
        geo:        extractGeo(req),
        reqId:      req.headers['x-request-id'] ?? undefined,
      });
    }
  });

  next();
}
```

---

## 6. Log Rotation Policy

| Property             | Value                                   |
|----------------------|-----------------------------------------|
| Rotation trigger     | Daily at 00:00 UTC or file > 500 MB     |
| Rotation strategy    | Rename current file, open new file      |
| Archived filename    | `audit-YYYY-MM-DD.ndjson`              |
| Retention period     | 90 days minimum                         |
| Compression          | `gzip` applied after 24 hours           |
| Original file action | Archive only — **never deleted**        |

```typescript
// tools/rotateLog.ts — run via cron at midnight UTC
async function rotateLogs(): Promise<void> {
  const logPath     = process.env.AUDIT_LOG_PATH!;
  const date        = new Date().toISOString().slice(0, 10);
  const archivePath = path.join(path.dirname(logPath), `audit-${date}.ndjson`);

  await fs.rename(logPath, archivePath);
  // Server creates a new audit.ndjson on next write automatically
}
```

---

## 7. Querying the Audit Log

### Using `jq`

```bash
# All failed PIN attempts from a specific IP
jq 'select(.event == "pin_fail" and .ip == "203.0.113.42")' audit.ndjson

# All admin session starts
jq 'select(.event == "session_start" and .role == "admin")' audit.ndjson

# Total bytes uploaded per call session
jq -s 'group_by(.sessionId)[] |
  { sessionId: .[0].sessionId, totalBytes: map(.bytes // 0) | add }' audit.ndjson

# All events belonging to a specific JWT session
jq 'select(.jti == "f47ac10b-58cc-4372-a567-0e02b2c3d479")' audit.ndjson

# Rate-limit events in the last hour
jq --arg cutoff "$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)" \
  'select(.event == "rate_limit_blocked" and .ts > $cutoff)' audit.ndjson
```

### Using `grep` (Quick Scans)

```bash
grep -c '"event":"pin_fail"'          audit.ndjson   # Count failures
grep '"ip":"198.51.100.23"'           audit.ndjson   # Events from IP
grep '"event":"recording_finalized"'  audit.ndjson   # Finalized recordings
```

---

## 8. Privacy & Data Handling

| Data Point  | Stored As                   | Rationale                                             |
|-------------|-----------------------------|---------------------------------------------------------|
| IP Address  | Full IPv4/IPv6 string       | Required for rate-limit correlation and forensics       |
| User-Agent  | Full UA string              | Device/browser fingerprinting for anomaly detection     |
| Geolocation | Country / Region / City     | Broad geo only; no GPS or precise location              |
| PIN value   | **Never stored**            | Only success/failure is recorded                        |
| JWT content | `jti` only (opaque UUID)    | Links events without logging claims                     |
| Recording   | Session ID + byte counts    | No content metadata; only storage path                  |

> All audit log files are **sensitive security data** — restrict access to authorized administrators only.

---

## 9. Alerting Thresholds (Recommended)

| Condition                                     | Threshold        | Suggested Action                  |
|-----------------------------------------------|------------------|-----------------------------------|
| `pin_fail` events from a single IP            | > 5 in 10 min    | Alert security team               |
| `rate_limit_blocked` events total             | > 20 in 1 hour   | Investigate potential DDoS        |
| `session_start` with `role=admin`             | Any occurrence   | Always notify via out-of-band     |
| `media_upload` `bytes` < 1000                | 3 consecutive+   | Potential corrupt stream          |
| Gap in `chunkIndex` sequence for a sessionId  | Any gap          | Recording integrity alert         |

---

## 10. Event Summary Table

| Event                  | Trigger                                     | Security Severity |
|------------------------|---------------------------------------------|-------------------|
| `pin_fail`             | Wrong PIN submitted                         | Medium            |
| `rate_limit_blocked`   | 5+ failures; lockout active                 | High              |
| `session_start`        | Successful PIN + JWT issued                 | Medium            |
| `session_end`          | Logout / expiry / tamper detection          | Medium            |
| `media_upload`         | Recording chunk received                    | Low               |
| `recording_finalized`  | All chunks assembled into file              | Low               |
| `request` *(optional)* | Any HTTP request to `/api/*`                | Informational     |
