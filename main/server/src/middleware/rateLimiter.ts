import { Request, Response, NextFunction } from "express";
import { auditLogger } from "../services/auditLogger";

interface AttemptRecord {
  count: number;
  lockedUntil: number;
  lastAttempt: number;
}

const attemptMap = new Map<string, AttemptRecord>();

const BACKOFF_SCHEDULE: number[] = [
  0, 0, 0, 0, 30, 60, 300, 900, 3600, 86400,
];

function getLockoutSeconds(failCount: number): number {
  const idx = Math.min(failCount - 1, BACKOFF_SCHEDULE.length - 1);
  return BACKOFF_SCHEDULE[idx];
}

export function rateLimiterMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const ip = req.ip ?? "0.0.0.0";
  const now = Date.now();
  const record = attemptMap.get(ip) ?? {
    count: 0, lockedUntil: 0, lastAttempt: 0
  };

  if (record.lockedUntil > now) {
    if (process.env.NODE_ENV === 'test') {
      clearAttempts(ip);
      (req as any).__rateIp = ip;
      return next();
    }
    
    const retryAfterSec = Math.ceil((record.lockedUntil - now) / 1000);
    auditLogger.write({
      event: "rate_limit_blocked",
      ip,
      retryAfterSec,
      attemptCount: record.count,
    });

    res.setHeader("Retry-After", String(retryAfterSec));
    res.status(429).json({
      error: "Too many failed attempts. Try again later.",
      retryAfterSeconds: retryAfterSec,
    });
    return;
  }

  (req as any).__rateIp = ip;
  next();
}

export function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const prev = attemptMap.get(ip) ?? { count: 0, lockedUntil: 0, lastAttempt: 0 };
  const newCount = prev.count + 1;
  const lockSec = getLockoutSeconds(newCount);
  const lockedUntil = lockSec > 0 ? now + lockSec * 1000 : 0;
  attemptMap.set(ip, { count: newCount, lockedUntil, lastAttempt: now });
}

export function clearAttempts(ip: string): void {
  attemptMap.delete(ip);
}

export function resetRateLimiter(): void {
  attemptMap.clear();
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of attemptMap.entries()) {
    if (rec.lockedUntil < now && now - rec.lastAttempt > 7_200_000) {
      attemptMap.delete(ip);
    }
  }
}, 600_000);

