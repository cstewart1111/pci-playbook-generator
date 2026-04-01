import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { playbooks, patterns, insertPlaybookSchema } from "@workspace/db";
import {
  CreatePlaybookBody,
  GetPlaybookParams,
  DeletePlaybookParams,
  AnalyzeEmailsParams,
  AnalyzeEmailsBody,
} from "@workspace/api-zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const result = await db.select().from(playbooks).orderBy(playbooks.createdAt);
    res.json(result.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      qualityScore: p.qualityScore,
      emailCount: p.emailCount,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list playbooks");
    res.status(500).json({ error: "Failed to list playbooks" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = CreatePlaybookBody.parse(req.body);
    const [playbook] = await db
      .insert(playbooks)
      .values({
        name: body.name,
        description: body.description,
        emailCount: 0,
      })
      .returning();
    res.status(201).json({
      id: playbook.id,
      name: playbook.name,
      description: playbook.description,
      qualityScore: playbook.qualityScore,
      emailCount: playbook.emailCount,
      createdAt: playbook.createdAt,
      updatedAt: playbook.updatedAt,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create playbook");
    res.status(400).json({ error: "Failed to create playbook" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = GetPlaybookParams.parse({ id: Number(req.params.id) });
    const [playbook] = await db.select().from(playbooks).where(eq(playbooks.id, id));
    if (!playbook) {
      return res.status(404).json({ error: "Playbook not found" });
    }
    const patternRows = await db.select().from(patterns).where(eq(patterns.playbookId, id));
    res.json({
      id: playbook.id,
      name: playbook.name,
      description: playbook.description,
      qualityScore: playbook.qualityScore,
      emailCount: playbook.emailCount,
      createdAt: playbook.createdAt,
      updatedAt: playbook.updatedAt,
      patterns: patternRows.map(p => ({
        id: p.id,
        playbookId: p.playbookId,
        type: p.type,
        text: p.text,
        examples: p.examples,
      })),
      principles: playbook.principles,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get playbook");
    res.status(500).json({ error: "Failed to get playbook" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = DeletePlaybookParams.parse({ id: Number(req.params.id) });
    const [deleted] = await db.delete(playbooks).where(eq(playbooks.id, id)).returning();
    if (!deleted) {
      return res.status(404).json({ error: "Playbook not found" });
    }
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete playbook");
    res.status(500).json({ error: "Failed to delete playbook" });
  }
});

router.post("/:id/analyze", async (req, res) => {
  try {
    const { id } = AnalyzeEmailsParams.parse({ id: Number(req.params.id) });
    const body = AnalyzeEmailsBody.parse(req.body);

    const [playbook] = await db.select().from(playbooks).where(eq(playbooks.id, id));
    if (!playbook) {
      return res.status(404).json({ error: "Playbook not found" });
    }

    const emailsText = body.emails.map((e, i) => `Email ${i + 1}:\n${e}`).join("\n\n---\n\n");

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: `You are an expert in consultative enterprise sales methodology. Analyze the following winning sales emails and extract reusable patterns.

${emailsText}

Return a JSON object with this exact structure:
{
  "patterns": [
    {
      "type": "opening_hook|core_message|value_proposition|social_proof|call_to_action|closing_tactic|personalization|objection_handling",
      "text": "Description of the pattern",
      "examples": ["Direct quote or paraphrase from the emails showing this pattern in action"]
    }
  ],
  "principles": ["List of high-level consultative selling principles evident in these emails"],
  "qualityScore": <integer 0-100 based on how consultative, research-based, and effective these emails appear>
}

Return only valid JSON, no markdown.`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from AI");
    }

    let analysis: { patterns: Array<{ type: string; text: string; examples: string[] }>; principles: string[]; qualityScore: number };
    try {
      analysis = JSON.parse(content.text);
    } catch {
      throw new Error("Failed to parse AI analysis response");
    }

    // Delete old patterns for this playbook
    await db.delete(patterns).where(eq(patterns.playbookId, id));

    // Insert new patterns
    if (analysis.patterns.length > 0) {
      await db.insert(patterns).values(
        analysis.patterns.map(p => ({
          playbookId: id,
          type: p.type,
          text: p.text,
          examples: p.examples,
        }))
      );
    }

    // Update playbook with new data
    await db
      .update(playbooks)
      .set({
        qualityScore: analysis.qualityScore,
        emailCount: playbook.emailCount + body.emails.length,
        principles: analysis.principles,
        updatedAt: new Date(),
      })
      .where(eq(playbooks.id, id));

    res.json({
      patterns: analysis.patterns,
      principles: analysis.principles,
      qualityScore: analysis.qualityScore,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to analyze emails");
    res.status(500).json({ error: "Failed to analyze emails" });
  }
});

export default router;
