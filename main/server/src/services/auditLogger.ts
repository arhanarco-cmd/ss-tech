import fs from "fs";
import path from "path";

const LOG_PATH = process.env.AUDIT_LOG_PATH ?? path.resolve(__dirname, "../../logs/audit.ndjson");

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

