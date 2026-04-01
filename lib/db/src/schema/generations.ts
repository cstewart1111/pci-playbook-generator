import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playbooks } from "./playbooks";

export const generations = pgTable("generations", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  company: text("company"),
  role: text("role"),
  output: text("output").notNull(),
  playbookId: integer("playbook_id").references(() => playbooks.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertGenerationSchema = createInsertSchema(generations).omit({
  id: true,
  createdAt: true,
});

export type Generation = typeof generations.$inferSelect;
export type InsertGeneration = z.infer<typeof insertGenerationSchema>;
