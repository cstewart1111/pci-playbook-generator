import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playbooks } from "./playbooks";

export const patterns = pgTable("patterns", {
  id: serial("id").primaryKey(),
  playbookId: integer("playbook_id")
    .notNull()
    .references(() => playbooks.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  text: text("text").notNull(),
  examples: text("examples").array().notNull().default([]),
});

export const insertPatternSchema = createInsertSchema(patterns).omit({
  id: true,
});

export type Pattern = typeof patterns.$inferSelect;
export type InsertPattern = z.infer<typeof insertPatternSchema>;
