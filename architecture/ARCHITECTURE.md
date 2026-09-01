# System Architecture Specification
**Project:** SStech — High-Security Interactive Web Gallery  
**Version:** 1.0.0  
**Date:** 2026-09-01  
**Classification:** Production-Grade Technical Specification

---

## 1. Overview

SStech is a full-stack, high-security interactive web gallery platform featuring:

- PIN-based dual-role authentication (User / Admin)
- Real-time 1-to-1 WebRTC video calling with server-side recording
- Role-driven dynamic UI theming
- Append-only tamper-evident audit logging
- Modular cloud-ready storage pipeline

---

## 2. Repository Structure

```
SStech/
├── architecture/                   # Technical specification documents
│   ├── ARCHITECTURE.md
│   ├── PIN_AUTH_SPEC.md
│   ├── STORAGE_PIPELINE.md
│   └── LOGGING_SCHEMA.md
│
├── main/
│   ├── client/                     # Frontend SPA (React + Vite)
│   │   ├── public/
│   │   ├── src/
│   │   │   ├── assets/
│   │   │   ├── components/
│   │   │   │   ├── auth/           # PIN entry, session guard
│   │   │   │   ├── gallery/        # Media grid, lightbox
│   │   │   │   ├── call/           # WebRTC video call UI
│   │   │   │   └── shared/         # Layout, nav, buttons
│   │   │   ├── hooks/              # useAuth, useWebRTC, useTheme
│   │   │   ├── store/              # Zustand global state
│   │   │   ├── themes/             # Theme token definitions
│   │   │   ├── services/           # API, socket clients
│   │   │   └── utils/
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── server/                     # Backend (Node.js + Express)
│       ├── src/
│       │   ├── api/
│       │   │   ├── auth/           # PIN verify, session routes
│       │   │   ├── gallery/        # Media CRUD routes
│       │   │   ├── call/           # Signaling + recording routes
│       │   │   └── admin/          # Admin-only management routes
│       │   ├── middleware/
│       │   │   ├── authenticate.ts # JWT session guard
│       │   │   ├── rateLimiter.ts  # In-memory exponential backoff
│       │   │   ├── auditLog.ts     # Request-level audit hook
│       │   │   └── errorHandler.ts
│       │   ├── services/
│       │   │   ├── pinService.ts   # Argon2 hash/verify
│       │   │   ├── sessionService.ts
│       │   │   ├── recordingService.ts
│       │   │   └── storageService.ts
│       │   ├── storage/
│       │   │   └── recordings/     # Local dev recording chunks
│       │   ├── logs/
│       │   │   └── audit.ndjson    # Append-only audit log
│       │   ├── config/
│       │   │   ├── env.ts
│       │   │   └── constants.ts
│       │   └── index.ts
│       ├── tsconfig.json
│       └── package.json
│
└── test/                           # End-to-end + integration test suite
    ├── e2e/
    │   ├── auth.spec.ts
    │   ├── gallery.spec.ts
    │   ├── call.spec.ts
    │   └── theme.spec.ts
    ├── integration/
    │   ├── pinService.test.ts
    │   ├── recordingService.test.ts
    │   └── auditLogger.test.ts
    ├── fixtures/
    └── playwright.config.ts
```

---

## 3. Frontend Architecture (`main/client/`)

### 3.1 Technology Stack

| Concern          | Technology                                 |
|------------------|--------------------------------------------|
| Framework        | React 18 + TypeScript                      |
| Build Tool       | Vite 5                                     |
| State Management | Zustand                                    |
| Real-time        | Socket.IO Client                           |
| WebRTC           | Native Browser APIs (RTCPeerConnection)    |
| Styling          | CSS Custom Properties + CSS Modules        |
| HTTP Client      | Axios (with interceptors)                  |
| Testing          | Vitest + Playwright (E2E)                  |

### 3.2 Application Layers

```
┌──────────────────────────────────────────────┐
│                  React UI Layer               │
│  (Components: Auth, Gallery, Call, Shared)    │
├──────────────────────────────────────────────┤
│               Custom Hooks Layer              │
│  useAuth · useWebRTC · useTheme · useAudit    │
├──────────────────────────────────────────────┤
│              Zustand Store Layer              │
│  authStore · callStore · themeStore           │
├──────────────────────────────────────────────┤
│             Services / Transport Layer        │
│  apiClient (Axios) · socketClient (Socket.IO) │
└──────────────────────────────────────────────┘
```

### 3.3 Client-Side Routing

```
/                  → Gallery view (requires User or Admin session)
/auth              → PIN entry page (unauthenticated)
/call/:sessionId   → Active video call room
/admin             → Admin dashboard (requires Admin session)
```

---

## 4. Backend Architecture (`main/server/`)

### 4.1 Technology Stack

| Concern            | Technology                           |
|--------------------|--------------------------------------|
| Runtime            | Node.js 20 LTS                       |
| Framework          | Express 5 + TypeScript               |
| Real-time          | Socket.IO Server                     |
| PIN Hashing        | argon2 (libsodium bindings)          |
| Session Tokens     | jsonwebtoken (RS256 asymmetric)      |
| Rate Limiting      | In-memory Map (custom middleware)    |
| Storage            | Local FS (dev) / Cloudflare R2 (prod)|
| Logging            | Custom NDJSON append-only writer     |
| Process Manager    | PM2 (production)                     |

### 4.2 Request Lifecycle

```
Incoming HTTP Request
        │
        ▼
┌───────────────────┐
│  auditLog (pre)   │  ← captures IP, UA, timestamp
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  rateLimiter      │  ← blocks after 5 failed PINs
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  authenticate     │  ← validates httpOnly JWT cookie
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  Route Handler    │  ← business logic
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  auditLog (post)  │  ← captures response status, duration
└────────┬──────────┘
         │
         ▼
     Response
```

### 4.3 WebSocket Signaling Architecture

```
Client A                  Server (Socket.IO)             Client B
   │                             │                            │
   │── join-room ───────────────▶│                            │
   │                             │◀──── join-room ────────────│
   │── offer (SDP) ─────────────▶│──────── offer (SDP) ──────▶│
   │◀─ answer (SDP) ─────────────│◀─────── answer (SDP) ──────│
   │── ice-candidate ───────────▶│──────── ice-candidate ─────▶│
   │◀─ ice-candidate ────────────│◀──────── ice-candidate ─────│
   │── recording-chunk (blob) ──▶│ → storageService.save()    │
```

---

## 5. Role-Based Theme System

### 5.1 Theme States

| State                  | Condition                              | Primary Color | Accent  |
|------------------------|----------------------------------------|---------------|---------|
| **Default**            | No authenticated session               | Purple        | Violet  |
| **User Authenticated** | Valid User PIN session active          | Pink          | Rose    |
| **Admin Online**       | Valid Admin PIN session active         | Orange        | Amber   |

### 5.2 Chat / Call Action Button — Glow State

The primary call-to-action button applies a **Green glow** whenever an Admin session is connected via WebSocket, providing real-time visual feedback of admin presence.

```
Admin Socket Connected    → themeStore.setAdminLive(true)
                          → ButtonGlow: box-shadow: 0 0 18px 4px #22c55e
Admin Socket Disconnected → themeStore.setAdminLive(false)
                          → ButtonGlow: none
```

### 5.3 CSS Custom Property Implementation

```css
/* themes/base.css */
:root[data-theme="default"] {
  --color-primary:  #7c3aed;  /* Purple-600 */
  --color-accent:   #8b5cf6;  /* Violet-500 */
  --color-surface:  #1e1b4b;
  --color-text:     #ede9fe;
}

:root[data-theme="user"] {
  --color-primary:  #db2777;  /* Pink-600   */
  --color-accent:   #f43f5e;  /* Rose-500   */
  --color-surface:  #4c0519;
  --color-text:     #fce7f3;
}

:root[data-theme="admin"] {
  --color-primary:  #ea580c;  /* Orange-600 */
  --color-accent:   #f59e0b;  /* Amber-400  */
  --color-surface:  #431407;
  --color-text:     #ffedd5;
}

/* Green glow when admin is live */
[data-admin-live="true"] .btn-call {
  box-shadow:   0 0 18px 4px #22c55e, 0 0 6px 1px #16a34a;
  border-color: #22c55e;
  transition:   box-shadow 0.4s ease, border-color 0.4s ease;
}
```

### 5.4 Theme Transition Flow

```
App Bootstrap
    │
    ├─ No session cookie      → data-theme="default" (Purple)
    ├─ Valid User JWT          → data-theme="user"    (Pink)
    └─ Valid Admin JWT         → data-theme="admin"   (Orange)
                                        │
                                        └─ Admin socket connects
                                           → data-admin-live="true"
                                           → Call button glows Green
```

---

## 6. Test Suite (`test/`)

### 6.1 Testing Strategy

| Layer       | Tool                 | Scope                               |
|-------------|----------------------|-------------------------------------|
| Unit        | Vitest               | Services, utilities, hooks          |
| Integration | Vitest + Supertest   | API routes, middleware chains       |
| E2E         | Playwright           | Full user journeys across all roles |
| Security    | Custom scripts       | Rate limiting, JWT tampering        |

### 6.2 Critical Test Scenarios

**Authentication:**
- Correct PIN grants session cookie with correct role claim
- 5th wrong attempt triggers rate-limit lockout
- Tampered JWT rejected with 401; expired JWT rejected with 401

**Theme:**
- Default (Purple) renders for unauthenticated routes
- User session switches theme to Pink
- Admin session switches theme to Orange
- Admin WebSocket connect → call button acquires green glow
- Admin WebSocket disconnect → glow removed within 500ms

**Recording:**
- 5-second chunk arrives at POST `/api/call/chunk`
- Chunk appended to correct session file
- Session finalize assembles chunks into complete recording
- Audit log captures `media_upload` event per chunk

**Audit Log:**
- Every failed PIN attempt writes a `pin_fail` entry
- Every session start writes a `session_start` entry
- Log file is append-only (never overwritten on rotate)

---

## 7. Environment Variables

```env
# Server
NODE_ENV=production
PORT=3001
JWT_PRIVATE_KEY=<RS256 PEM>
JWT_PUBLIC_KEY=<RS256 PEM>
ARGON2_MEMORY_COST=65536
ARGON2_TIME_COST=3
ARGON2_PARALLELISM=2

# PIN hashes (never plaintext)
USER_PIN_HASH=<argon2id hash>
ADMIN_PIN_HASH=<argon2id hash>

# Storage
STORAGE_ADAPTER=local     # local | r2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=

# Logging
AUDIT_LOG_PATH=./src/logs/audit.ndjson
AUDIT_LOG_REQUESTS=false
```

---

## 8. Security Headers (Helmet.js)

```
Content-Security-Policy:   default-src 'self'; media-src blob:
Strict-Transport-Security: max-age=63072000; includeSubDomains
X-Content-Type-Options:    nosniff
X-Frame-Options:           DENY
Referrer-Policy:           no-referrer
Permissions-Policy:        camera=(), microphone=()
```

> Camera/microphone permissions are opened client-side only within `/call/:sessionId` via `getUserMedia()` — not granted globally.

---

## 9. Document Versions

| Document             | Version | Last Updated |
|----------------------|---------|--------------|
| ARCHITECTURE.md      | 1.0.0   | 2026-09-01   |
| PIN_AUTH_SPEC.md     | 1.0.0   | 2026-09-01   |
| STORAGE_PIPELINE.md  | 1.0.0   | 2026-09-01   |
| LOGGING_SCHEMA.md    | 1.0.0   | 2026-09-01   |
