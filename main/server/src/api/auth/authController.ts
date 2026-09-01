import express from "express";
import { verifyPin } from "../../services/pinService";
import { issueSession } from "../../services/sessionService";
import {
  rateLimiterMiddleware,
  recordFailedAttempt,
  clearAttempts,
} from "../../middleware/rateLimiter";
import { auditLogger } from "../../services/auditLogger";
import { extractGeo } from "../../utils/geo";

const router = express.Router();

router.post("/login", rateLimiterMiddleware, async (req, res) => {
  const { pin } = req.body;
  const ip = (req as any).__rateIp ?? req.ip ?? "0.0.0.0";

  if (!pin) {
    return res.status(400).json({ error: "PIN is required" });
  }

  let role: "user" | "admin" | null = null;
  if (await verifyPin(pin, "user")) role = "user";
  else if (await verifyPin(pin, "admin")) role = "admin";

  if (!role) {
    recordFailedAttempt(ip);
    auditLogger.write({
      event: "pin_fail",
      ip,
      ua: req.headers["user-agent"] ?? "unknown",
      geo: extractGeo(req),
    });
    return res.status(401).json({ error: "Invalid PIN" });
  }

  clearAttempts(ip);

  const token = issueSession(ip, role);
  const maxAge = role === "admin" ? 3_600_000 : 14_400_000;
  const expiresAt = new Date(Date.now() + maxAge).toISOString();

  auditLogger.write({
    event: "session_start",
    role,
    ip,
    ua: req.headers["user-agent"] ?? "unknown",
    geo: extractGeo(req),
    expiresAt,
  });

  res.cookie("sexyshreya_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge,
  });

  res.status(200).json({ role, expiresAt });
});

router.post("/logout", (req, res) => {
  res.clearCookie("sexyshreya_session");
  res.status(200).json({ message: "Logged out" });
});

router.get("/session", (req, res) => {
  const session = (req as any).session;
  if (!session) {
    return res.status(401).json({ error: "No active session" });
  }
  res.status(200).json({ role: session.role, expiresAt: new Date(session.exp * 1000).toISOString() });
});

export default router;
