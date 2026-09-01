import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

// Load environment variables early
dotenv.config();

import authRoutes from "./api/auth/authController";
import callRoutes from "./api/call/callController";
import galleryRoutes from "./api/gallery/galleryController";
import { auditLogMiddleware } from "./middleware/auditLog";
import { errorHandler } from "./middleware/errorHandler";
import { setupSignaling } from "./sockets/signaling";
import { auditLogger } from "./services/auditLogger";

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://sexyshreya.tech',
  'https://www.sexyshreya.tech',
  process.env.CLIENT_URL,
].filter(Boolean) as string[];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('.sexyshreya-client.pages.dev') ||
      origin.endsWith('.pages.dev') ||
      origin.includes('sexyshreya')
    ) {
      return callback(null, true);
    }
    return callback(new Error(`Blocked by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With'],
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions,
});

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      mediaSrc: ["blob:"],
    }
  },
  hsts: {
    maxAge: 63072000,
    includeSubDomains: true,
  },
  frameguard: { action: "deny" }
}));

app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());

// Audit Logging Interceptor
app.use(auditLogMiddleware);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/call", callRoutes);
app.use("/api/gallery", galleryRoutes);

// Test bypass endpoints
if (process.env.NODE_ENV === 'test') {
  app.post("/api/test/reset-rate-limit", (req, res) => {
    const { resetRateLimiter } = require("./middleware/rateLimiter");
    resetRateLimiter();
    res.json({ success: true });
  });
}

// Error Handling
app.use(errorHandler);

// WebRTC Signaling setup
setupSignaling(io);

const PORT = process.env.PORT || 3001;

server.on('error', (err) => {
  console.error('[Server Error]', err);
});

server.listen(PORT as number, '0.0.0.0', () => {
  console.log(`[Server] running on port ${PORT}`);
  auditLogger.write({ event: "server_start", port: PORT });
});

