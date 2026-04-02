import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const playbooks = pgTable("playbooks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  qualityScore: integer("quality_score"),
  emailCount: integer("email_count").notNull().default(0),
  principles: text("principles").array().notNull().default([]),
  icpVerticals: text("icp_verticals").array().notNull().default([]),
  icpPersonas: text("icp_personas").array().notNull().default([]),
  icpPainPoints: text("icp_pain_points").array().notNull().default([]),
  icpDifferentiators: text("icp_differentiators").array().notNull().default([]),
  icpProofPoints: text("icp_proof_points").array().notNull().default([]),
  icpCompanySize: text("icp_company_size"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertPlaybookSchema = createInsertSchema(playbooks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Playbook = typeof playbooks.$inferSelect;
export type InsertPlaybook = z.infer<typeof insertPlaybookSchema>;
