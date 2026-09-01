import multer from "multer";
import express from "express";
import { storageService } from "../../services/storageService";
import { auditLogger } from "../../services/auditLogger";
import { authenticate } from "../../middleware/authenticate";

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

router.post(
  "/chunk",
  authenticate,
  upload.single("chunk"),
  async (req, res) => {
    const { sessionId, chunkIndex, isFinal } = req.body;
    const chunkBuffer = req.file?.buffer;

    if (!sessionId || chunkIndex === undefined || !chunkBuffer) {
      return res.status(400).json({ error: "Invalid chunk payload" });
    }

    try {
      await storageService.saveChunk({
        sessionId,
        chunkIndex: Number(chunkIndex),
        data: chunkBuffer,
        mimeType: req.file!.mimetype,
      });

      auditLogger.write({
        event: "media_upload",
        sessionId,
        chunkIndex: Number(chunkIndex),
        bytes: chunkBuffer.byteLength,
        ip: req.ip,
        jti: (req as any).session?.jti,
      });

      if (isFinal === "true") {
        await storageService.finalizeRecording(sessionId);
        auditLogger.write({ event: "recording_finalized", sessionId });
      }

      res.status(200).json({ received: true });
    } catch (err) {
      console.error("[callController] chunk save error:", err);
      res.status(500).json({ error: "Storage failure" });
    }
  }
);

export default router;

