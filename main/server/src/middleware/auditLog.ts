import { Request, Response, NextFunction } from "express";
import { auditLogger } from "../services/auditLogger";
import { extractGeo } from "../utils/geo";

export function auditLogMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startMs = Date.now();

  res.on("finish", () => {
    if (req.path.startsWith("/api/") && process.env.AUDIT_LOG_REQUESTS === "true") {
      auditLogger.write({
        event: "request",
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Date.now() - startMs,
        ip: req.ip ?? "0.0.0.0",
        ua: req.headers["user-agent"] ?? "unknown",
        geo: extractGeo(req),
        reqId: req.headers["x-request-id"] ?? undefined,
      });
    }
  });

  next();
}

