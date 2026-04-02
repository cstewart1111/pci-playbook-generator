import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playbooks } from "./playbooks";

export const knowledgeDocs = pgTable("knowledge_documents", {
  id: serial("id").primaryKey(),
  playbookId: integer("playbook_id").references(() => playbooks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  type: text("type").notNull(),
  content: text("content").notNull(),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertKnowledgeDocSchema = createInsertSchema(knowledgeDocs).omit({
  id: true,
  createdAt: true,
});

export type KnowledgeDoc = typeof knowledgeDocs.$inferSelect;
export type InsertKnowledgeDoc = z.infer<typeof insertKnowledgeDocSchema>;
