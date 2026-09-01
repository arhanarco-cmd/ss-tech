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
import { auditLogMiddleware } from "./middleware/auditLog";
import { errorHandler } from "./middleware/errorHandler";
import { setupSignaling } from "./sockets/signaling";
import { auditLogger } from "./services/auditLogger";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  },
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

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// Audit Logging Interceptor
app.use(auditLogMiddleware);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/call", callRoutes);

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

