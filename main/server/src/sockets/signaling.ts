import { Server, Socket } from "socket.io";
import { verifySession } from "../services/sessionService";

export function setupSignaling(io: Server) {
  let adminCount = 0;

  io.use((socket, next) => {
    try {
      const cookieStr = socket.request.headers.cookie || "";
      const match = cookieStr.match(/sexyshreya_session=([^;]+)/);
      if (match) {
        const payload = verifySession(match[1]);
        (socket as any).session = payload;
      }
      next();
    } catch {
      next();
    }
  });

  io.on("connection", (socket: Socket) => {
    const session = (socket as any).session;
    const isAdmin = session?.role === "admin";

    if (isAdmin) {
      adminCount++;
      io.emit("admin:status", { isLive: adminCount > 0 });
    }

    // Immediately inform newly connected client of admin status
    socket.emit("admin:status", { isLive: adminCount > 0 });

    socket.on("admin:login", () => {
      // Allow forced sync from client
      io.emit("admin:status", { isLive: true });
    });

    socket.on("join-room", (sessionId: string) => {
      socket.join(sessionId);
    });

    socket.on("offer", (payload: { sessionId: string; sdp: any }) => {
      socket.to(payload.sessionId).emit("offer", payload.sdp);
    });

    socket.on("answer", (payload: { sessionId: string; sdp: any }) => {
      socket.to(payload.sessionId).emit("answer", payload.sdp);
    });

    socket.on("ice-candidate", (payload: { sessionId: string; candidate: any }) => {
      socket.to(payload.sessionId).emit("ice-candidate", payload.candidate);
    });

    socket.on("disconnect", () => {
      if (isAdmin) {
        adminCount--;
        io.emit("admin:status", { isLive: adminCount > 0 });
      }
    });
  });
}
