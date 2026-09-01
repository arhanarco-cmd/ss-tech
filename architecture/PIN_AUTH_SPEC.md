# PIN Authentication Specification
**Project:** sexyshreya — High-Security Interactive Web Gallery  
**Document:** PIN_AUTH_SPEC.md  
**Version:** 1.0.0  
**Date:** 2026-09-01  
**Classification:** Security-Critical

---

## 1. Overview

sexyshreya uses a dual-role PIN authentication system. There are exactly two roles:

| Role    | Access Level                                                      |
|---------|-------------------------------------------------------------------|
| `user`  | View gallery, initiate call request, participate in calls         |
| `admin` | All user access + manage gallery, accept/reject calls, view logs  |

No username is required. Each role has an independent PIN.

> **Security Principle:** PINs are never stored in plaintext. Only Argon2id hashes are persisted. The plaintext PIN exists only in-memory during the verification window.

---

## 2. PIN Policy

| Property          | Requirement                                     |
|-------------------|-------------------------------------------------|
| Minimum length    | 8 characters                                    |
| Maximum length    | 64 characters                                   |
| Character set     | Alphanumeric + special characters (`!@#$%^&*`) |
| Complexity        | At least 1 digit + 1 special character          |
| Separate PINs     | User PIN and Admin PIN are independent          |
| PIN rotation      | Via environment variable update + server restart|
| PIN transmission  | HTTPS only; never logged                        |

---

## 3. PIN Hashing — Argon2id

### 3.1 Algorithm Selection

**Argon2id** is chosen for resistance against:
- **Side-channel attacks** (time-hardness from Argon2i)
- **GPU/ASIC brute-force attacks** (memory-hardness from Argon2d)

Library: `argon2` (npm) — Node.js bindings to the reference C implementation.

### 3.2 Hashing Parameters (Production)

```typescript
// src/config/constants.ts
export const ARGON2_OPTIONS = {
  type:        argon2.argon2id,
  memoryCost:  65536,   // 64 MiB RAM per hash operation
  timeCost:    3,       // 3 iterations
  parallelism: 2,       // 2 parallel lanes
  hashLength:  32,      // 256-bit output
  saltLength:  16,      // 128-bit random salt (auto-generated)
};
```

### 3.3 Hash Generation (PIN Setup)

```typescript
// tools/hashPin.ts — one-time setup utility
import argon2 from 'argon2';

async function hashPin(plainPin: string): Promise<string> {
  return argon2.hash(plainPin, ARGON2_OPTIONS);
}
// Output: $argon2id$v=19$m=65536,t=3,p=2$<salt_b64>$<hash_b64>
// Store in env: USER_PIN_HASH or ADMIN_PIN_HASH
```

### 3.4 Hash Verification (Login Request)

```typescript
// src/services/pinService.ts
import argon2 from 'argon2';

export async function verifyPin(
  submittedPin: string,
  role: 'user' | 'admin'
): Promise<boolean> {
  const storedHash =
    role === 'admin'
      ? process.env.ADMIN_PIN_HASH!
      : process.env.USER_PIN_HASH!;

  try {
    return await argon2.verify(storedHash, submittedPin);
  } catch {
    return false; // Malformed hash — treat as failure
  }
}
```

> **Timing Safety:** `argon2.verify()` performs constant-time comparison internally.

### 3.5 Bcrypt as Fallback

If `argon2` native compilation is unavailable:

```typescript
import bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12; // ~250ms on reference hardware

export async function hashPinBcrypt(pin: string): Promise<string> {
  return bcrypt.hash(pin, BCRYPT_ROUNDS);
}

export async function verifyPinBcrypt(
  submitted: string,
  stored: string
): Promise<boolean> {
  return bcrypt.compare(submitted, stored);
}
```

> Prefer Argon2id. Bcrypt is permissible only when native bindings cannot be built.

---

## 4. Rate Limiting — In-Memory Exponential Backoff

### 4.1 Design Rationale

Custom in-memory middleware keyed per IP address. Provides full control over backoff logic without external dependencies for security-critical throttling.

### 4.2 Attempt Tracker Data Structure

```typescript
// src/middleware/rateLimiter.ts

interface AttemptRecord {
  count:       number;  // Consecutive failed attempts
  lockedUntil: number;  // Unix ms timestamp — 0 if not locked
  lastAttempt: number;  // Unix ms timestamp of last attempt
}

const attemptMap = new Map<string, AttemptRecord>();
```

### 4.3 Exponential Backoff Schedule

| Failed Attempt # | Lockout Duration         |
|------------------|--------------------------|
| 1–4              | No lockout               |
| 5                | 30 seconds               |
| 6                | 60 seconds (1 min)       |
| 7                | 300 seconds (5 min)      |
| 8                | 900 seconds (15 min)     |
| 9                | 3600 seconds (1 hour)    |
| 10+              | 86400 seconds (24 hours) |

```typescript
const BACKOFF_SCHEDULE: number[] = [
  0, 0, 0, 0,   // attempts 1–4: no lockout
  30,            // attempt 5
  60,            // attempt 6
  300,           // attempt 7
  900,           // attempt 8
  3600,          // attempt 9
  86400,         // attempt 10+
];

function getLockoutSeconds(failCount: number): number {
  const idx = Math.min(failCount - 1, BACKOFF_SCHEDULE.length - 1);
  return BACKOFF_SCHEDULE[idx];
}
```

### 4.4 Middleware Implementation

```typescript
// src/middleware/rateLimiter.ts

export function rateLimiterMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const ip  = req.ip ?? '0.0.0.0';
  const now = Date.now();
  const record = attemptMap.get(ip) ?? {
    count: 0, lockedUntil: 0, lastAttempt: 0
  };

  if (record.lockedUntil > now) {
    const retryAfterSec = Math.ceil((record.lockedUntil - now) / 1000);
    auditLogger.write({ event: 'rate_limit_blocked', ip, retryAfterSec });
    res.setHeader('Retry-After', String(retryAfterSec));
    res.status(429).json({
      error: 'Too many failed attempts. Try again later.',
      retryAfterSeconds: retryAfterSec,
    });
    return;
  }

  (req as any).__rateIp = ip;
  next();
}

/** Call after a FAILED PIN attempt */
export function recordFailedAttempt(ip: string): void {
  const now  = Date.now();
  const prev = attemptMap.get(ip) ?? { count: 0, lockedUntil: 0, lastAttempt: 0 };
  const newCount    = prev.count + 1;
  const lockSec     = getLockoutSeconds(newCount);
  const lockedUntil = lockSec > 0 ? now + lockSec * 1000 : 0;
  attemptMap.set(ip, { count: newCount, lockedUntil, lastAttempt: now });
}

/** Call after a SUCCESSFUL PIN attempt — resets counter */
export function clearAttempts(ip: string): void {
  attemptMap.delete(ip);
}

// Housekeeping: purge stale records every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of attemptMap.entries()) {
    if (rec.lockedUntil < now && now - rec.lastAttempt > 7_200_000) {
      attemptMap.delete(ip);
    }
  }
}, 600_000);
```

---

## 5. Session Tokens — JWT in httpOnly Cookies

### 5.1 Algorithm

**RS256** (RSA + SHA-256, 2048-bit key pair).

```bash
# Key generation (one-time setup)
openssl genrsa -out jwt_private.pem 2048
openssl rsa -in jwt_private.pem -pubout -out jwt_public.pem
```

Store PEM strings in environment variables. Never commit to source control.

### 5.2 JWT Payload Structure

```typescript
interface SessionPayload {
  sub:  string;           // Client IP (pseudonymous subject)
  role: 'user' | 'admin';
  iat:  number;           // Issued-at (Unix seconds)
  exp:  number;           // Expiry (Unix seconds)
  jti:  string;           // Unique token ID (UUIDv4)
}
```

### 5.3 Token Lifetimes

| Role    | Session Duration | Renewal Policy                    |
|---------|------------------|------------------------------------|
| `user`  | 4 hours          | Silent refresh at 75% of lifetime |
| `admin` | 1 hour           | Silent refresh at 75% of lifetime |

### 5.4 Token Issuance

```typescript
// src/services/sessionService.ts
import jwt    from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const PRIVATE_KEY = process.env.JWT_PRIVATE_KEY!.replace(/\\n/g, '\n');
const PUBLIC_KEY  = process.env.JWT_PUBLIC_KEY!.replace(/\\n/g, '\n');

const EXPIRY_MAP: Record<string, string> = {
  user:  '4h',
  admin: '1h',
};

export function issueSession(clientIp: string, role: 'user' | 'admin'): string {
  return jwt.sign(
    { sub: clientIp, role, jti: uuidv4() },
    PRIVATE_KEY,
    { algorithm: 'RS256', expiresIn: EXPIRY_MAP[role] }
  );
}

export function verifySession(token: string): SessionPayload {
  return jwt.verify(token, PUBLIC_KEY, {
    algorithms: ['RS256'],
  }) as SessionPayload;
}
```

### 5.5 Cookie Configuration

```typescript
const COOKIE_OPTIONS = {
  httpOnly: true,               // Not accessible via document.cookie
  secure:   true,               // HTTPS only
  sameSite: 'strict' as const,  // CSRF protection
  path:     '/',
};

res.cookie('sexyshreya_session', token, {
  ...COOKIE_OPTIONS,
  maxAge: role === 'admin' ? 3_600_000 : 14_400_000,
});
```

### 5.6 Session Verification Middleware

```typescript
// src/middleware/authenticate.ts
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.sexyshreya_session;
  if (!token) { res.status(401).json({ error: 'No session' }); return; }

  try {
    const payload = verifySession(token);
    (req as any).session = payload;
    next();
  } catch {
    res.clearCookie('sexyshreya_session');
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

/** Role guard factory */
export function requireRole(role: 'user' | 'admin') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const session = (req as any).session;
    if (!session || (role === 'admin' && session.role !== 'admin')) {
      res.status(403).json({ error: 'Insufficient privileges' }); return;
    }
    next();
  };
}
```

---

## 6. Authentication API Routes

### `POST /api/auth/login`

**Request:**
```json
{ "pin": "MyS3cur3PIN!" }
```

**Success (200):**
```json
{ "role": "user", "expiresAt": "2026-09-01T12:00:00Z" }
```
Sets `sexyshreya_session` httpOnly cookie.

**Failure (401):**
```json
{ "error": "Invalid PIN" }
```
Increments rate-limit counter for requesting IP.

---

### `POST /api/auth/logout`

Clears `sexyshreya_session` cookie server-side.

**Response (200):**
```json
{ "message": "Logged out" }
```

---

### `GET /api/auth/session`

Returns current session info.

**Response (200):**
```json
{ "role": "admin", "expiresAt": "2026-09-01T09:00:00Z" }
```

---

## 7. Security Threat Model

| Threat                  | Mitigation                                                        |
|-------------------------|-------------------------------------------------------------------|
| Brute-force PIN         | Argon2id cost + exponential backoff rate limiting                 |
| Token forgery           | RS256 JWT — private key never exposed                             |
| Token theft (XSS)       | `httpOnly` cookie inaccessible to JavaScript                      |
| CSRF                    | `SameSite=Strict` cookie policy                                   |
| Session fixation        | New `jti` UUID on every successful login                          |
| Replay attack           | Token expiry enforced server-side; short admin sessions           |
| Timing oracle on verify | `argon2.verify()` is constant-time internally                     |
| Plaintext PIN in logs   | PIN field is never included in any log entry                      |
| Man-in-the-middle       | HTTPS enforced via `Secure` cookie flag + HSTS header             |
