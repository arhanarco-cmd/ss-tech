import fs from "fs";
import path from "path";

const LOG_PATH = process.env.AUDIT_LOG_PATH ?? path.resolve(__dirname, "../../logs/audit.ndjson");

// Ensure the directory exists before opening the write stream
const logDir = path.dirname(LOG_PATH);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logStream = fs.createWriteStream(LOG_PATH, {
  flags: "a",
  encoding: "utf8",
});

logStream.on("error", (err) => {
  console.error("[AuditLogger] CRITICAL: Write failed:", err.message);
});

export const auditLogger = {
  write(event: Record<string, unknown>): void {
    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      ...event,
    });
    logStream.write(entry + "\n");
  },
};

process.on("SIGTERM", () => { logStream.end(); });
process.on("SIGINT", () => { logStream.end(); });