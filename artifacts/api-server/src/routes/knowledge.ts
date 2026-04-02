import { Router, type IRouter } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { knowledgeDocs } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "audio/mpeg",
      "audio/wav",
      "audio/ogg",
      "audio/mp4",
      "audio/webm",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  },
});

// List all knowledge documents (optionally filtered by playbookId)
router.get("/", async (req, res) => {
  try {
    const playbookId = req.query.playbookId ? Number(req.query.playbookId) : null;
    let result;
    if (playbookId) {
      result = await db.select().from(knowledgeDocs).where(eq(knowledgeDocs.playbookId, playbookId));
    } else {
      result = await db.select().from(knowledgeDocs);
    }
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to list knowledge documents");
    res.status(500).json({ error: "Failed to list knowledge documents" });
  }
});

// Create a knowledge document
router.post("/", async (req, res) => {
  try {
    const { title, type, content, playbookId } = req.body;
    if (!title || !type || !content) {
      res.status(400).json({ error: "title, type, and content are required" });
      return;
    }
    const [doc] = await db
      .insert(knowledgeDocs)
      .values({
        title,
        type,
        content,
        playbookId: playbookId || null,
      })
      .returning();
    res.status(201).json(doc);
  } catch (err) {
    req.log.error({ err }, "Failed to create knowledge document");
    res.status(500).json({ error: "Failed to create knowledge document" });
  }
});

// Upload a file as a knowledge document
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const { title, type, playbookId } = req.body;
    if (!title || !type) {
      res.status(400).json({ error: "title and type are required" });
      return;
    }

    const base64Content = file.buffer.toString("base64");

    const [doc] = await db
      .insert(knowledgeDocs)
      .values({
        title,
        type,
        content: base64Content,
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        playbookId: playbookId ? Number(playbookId) : null,
      })
      .returning();

    res.status(201).json(doc);
  } catch (err) {
    req.log.error({ err }, "Failed to upload knowledge document");
    const message = err instanceof Error ? err.message : "Failed to upload knowledge document";
    res.status(500).json({ error: message });
  }
});

// Download a knowledge document file
router.get("/:id/download", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [doc] = await db.select().from(knowledgeDocs).where(eq(knowledgeDocs.id, id));
    if (!doc) {
      res.status(404).json({ error: "Knowledge document not found" });
      return;
    }
    if (!doc.fileName || !doc.fileType) {
      res.status(400).json({ error: "This document does not have an associated file" });
      return;
    }

    const buffer = Buffer.from(doc.content, "base64");
    res.setHeader("Content-Type", doc.fileType);
    res.setHeader("Content-Disposition", `attachment; filename="${doc.fileName}"`);
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (err) {
    req.log.error({ err }, "Failed to download knowledge document");
    res.status(500).json({ error: "Failed to download knowledge document" });
  }
});

// Get a single knowledge document
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [doc] = await db.select().from(knowledgeDocs).where(eq(knowledgeDocs.id, id));
    if (!doc) {
      res.status(404).json({ error: "Knowledge document not found" });
      return;
    }
    res.json(doc);
  } catch (err) {
    req.log.error({ err }, "Failed to get knowledge document");
    res.status(500).json({ error: "Failed to get knowledge document" });
  }
});

// Delete a knowledge document
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [deleted] = await db.delete(knowledgeDocs).where(eq(knowledgeDocs.id, id)).returning();
    if (!deleted) {
      res.status(404).json({ error: "Knowledge document not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete knowledge document");
    res.status(500).json({ error: "Failed to delete knowledge document" });
  }
});

export default router;
