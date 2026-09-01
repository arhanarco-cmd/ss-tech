import { Request, Response, NextFunction } from "express";
import { verifySession } from "../services/sessionService";

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = req.cookies?.sstech_session;
  if (!token) {
    res.status(401).json({ error: "No session" });
    return;
  }

  try {
    const payload = verifySession(token);
    (req as any).session = payload;
    next();
  } catch {
    res.clearCookie("sstech_session");
    res.status(401).json({ error: "Invalid or expired session" });
  }
}

export function requireRole(role: "user" | "admin") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const session = (req as any).session;
    if (!session || (role === "admin" && session.role !== "admin")) {
      res.status(403).json({ error: "Insufficient privileges" });
      return;
    }
    next();
  };
}

