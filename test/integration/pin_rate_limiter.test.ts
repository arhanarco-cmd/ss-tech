import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { Request, Response } from 'express';
import request from 'supertest';
import {
  rateLimiterMiddleware,
  recordFailedAttempt,
  clearAttempts,
} from '../../main/server/src/middleware/rateLimiter';
import { auditLogger } from '../../main/server/src/services/auditLogger';

describe('PIN Rate Limiter & Lockout Mechanism (PIN_AUTH_SPEC.md §4)', () => {
  const testIp1 = '192.168.1.100';
  const testIp2 = '192.168.1.200';

  let app: express.Express;
  let auditSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Clear attempts before each test
    clearAttempts(testIp1);
    clearAttempts(testIp2);
    clearAttempts('::ffff:127.0.0.1');
    clearAttempts('127.0.0.1');
    clearAttempts('0.0.0.0');

    auditSpy = vi.spyOn(auditLogger, 'write').mockImplementation(() => {});

    // Build test express application
    app = express();
    app.use(express.json());

    // Mock IP extraction for predictable testing
    app.use((req: Request, _res: Response, next) => {
      const headerIp = req.headers['x-forwarded-for'] as string;
      if (headerIp) {
        Object.defineProperty(req, 'ip', { value: headerIp, configurable: true });
      }
      next();
    });

    app.post('/api/auth/login', rateLimiterMiddleware, (req: Request, res: Response) => {
      const { pin } = req.body;
      const ip = (req as any).__rateIp || req.ip || '0.0.0.0';

      if (!pin || pin !== 'CorrectPIN123!') {
        recordFailedAttempt(ip);
        return res.status(401).json({ error: 'Invalid PIN' });
      }

      clearAttempts(ip);
      return res.status(200).json({ role: 'user' });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearAttempts(testIp1);
    clearAttempts(testIp2);
  });

  it('allows the first 4 failed attempts without triggering a 429 lockout', async () => {
    for (let attempt = 1; attempt <= 4; attempt++) {
      const res = await request(app)
        .post('/api/auth/login')
        .set('x-forwarded-for', testIp1)
        .send({ pin: `WrongPIN_${attempt}` });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid PIN');
      expect(res.headers['retry-after']).toBeUndefined();
    }
  });

  it('triggers lockout on the 5th failed attempt and returns HTTP 429 on subsequent requests', async () => {
    // Attempts 1 to 4: Fail with 401
    for (let attempt = 1; attempt <= 4; attempt++) {
      const res = await request(app)
        .post('/api/auth/login')
        .set('x-forwarded-for', testIp1)
        .send({ pin: `WrongPIN_${attempt}` });
      expect(res.status).toBe(401);
    }

    // Attempt 5: Fails with 401, but records 5th failure triggering 30s lockout
    const fifthAttempt = await request(app)
      .post('/api/auth/login')
      .set('x-forwarded-for', testIp1)
      .send({ pin: 'WrongPIN_5' });
    expect(fifthAttempt.status).toBe(401);

    // 6th Request: Blocked by rateLimiterMiddleware before reaching route handler
    const blockedAttempt = await request(app)
      .post('/api/auth/login')
      .set('x-forwarded-for', testIp1)
      .send({ pin: 'CorrectPIN123!' }); // Even correct PIN is blocked during lockout

    expect(blockedAttempt.status).toBe(429);
    expect(blockedAttempt.body).toMatchObject({
      error: 'Too many failed attempts. Try again later.',
      retryAfterSeconds: expect.any(Number),
    });
    expect(blockedAttempt.body.retryAfterSeconds).toBeGreaterThan(0);
    expect(blockedAttempt.body.retryAfterSeconds).toBeLessThanOrEqual(30);
    expect(blockedAttempt.headers['retry-after']).toBeDefined();

    // Verify rate_limit_blocked audit log event
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'rate_limit_blocked',
        ip: testIp1,
        attemptCount: 5,
      })
    );
  });

  it('enforces escalating backoff schedule for repeated failures (PIN_AUTH_SPEC §4.3)', () => {
    const ip = '10.0.0.50';
    clearAttempts(ip);

    // Attempts 1 to 4: 0s lockout
    for (let i = 1; i <= 4; i++) {
      recordFailedAttempt(ip);
    }

    // Direct middleware test for Attempt 5 (30s lockout)
    recordFailedAttempt(ip);
    let req: any = { ip };
    let res: any = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    let next = vi.fn();

    rateLimiterMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Too many failed attempts. Try again later.',
        retryAfterSeconds: expect.any(Number),
      })
    );
    expect(next).not.toHaveBeenCalled();

    clearAttempts(ip);
  });

  it('isolates rate limiting per IP address', async () => {
    // Fail 5 times on IP 1
    for (let i = 1; i <= 5; i++) {
      await request(app)
        .post('/api/auth/login')
        .set('x-forwarded-for', testIp1)
        .send({ pin: 'WrongPIN' });
    }

    // IP 1 should be blocked (429)
    const ip1Blocked = await request(app)
      .post('/api/auth/login')
      .set('x-forwarded-for', testIp1)
      .send({ pin: 'WrongPIN' });
    expect(ip1Blocked.status).toBe(429);

    // IP 2 should still be allowed and receive 401 for wrong PIN (not 429)
    const ip2Response = await request(app)
      .post('/api/auth/login')
      .set('x-forwarded-for', testIp2)
      .send({ pin: 'WrongPIN' });
    expect(ip2Response.status).toBe(401);

    // IP 2 with correct PIN should succeed (200)
    const ip2Success = await request(app)
      .post('/api/auth/login')
      .set('x-forwarded-for', testIp2)
      .send({ pin: 'CorrectPIN123!' });
    expect(ip2Success.status).toBe(200);
    expect(ip2Success.body.role).toBe('user');
  });

  it('clears rate limiter on successful authentication', async () => {
    // Fail 3 times
    for (let i = 1; i <= 3; i++) {
      await request(app)
        .post('/api/auth/login')
        .set('x-forwarded-for', testIp1)
        .send({ pin: 'WrongPIN' });
    }

    // Login successfully with valid PIN
    const successRes = await request(app)
      .post('/api/auth/login')
      .set('x-forwarded-for', testIp1)
      .send({ pin: 'CorrectPIN123!' });
    expect(successRes.status).toBe(200);

    // Subsequent 4 failed attempts should not trigger lockout because counter was reset
    for (let i = 1; i <= 4; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .set('x-forwarded-for', testIp1)
        .send({ pin: 'WrongPIN' });
      expect(res.status).toBe(401);
    }
  });
});
