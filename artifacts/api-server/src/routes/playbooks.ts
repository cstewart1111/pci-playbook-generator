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
import {
  anthropic,
  isAnthropicIntegrationUnavailableError,
} from "@workspace/integrations-anthropic-ai";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const result = await db.select().from(playbooks).orderBy(playbooks.createdAt);
    res.json(result);
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
        icpVerticals: body.icpVerticals || [],
        icpPersonas: body.icpPersonas || [],
        icpPainPoints: body.icpPainPoints || [],
        icpDifferentiators: body.icpDifferentiators || [],
        icpProofPoints: body.icpProofPoints || [],
        icpCompanySize: body.icpCompanySize || null,
      })
      .returning();
    return res.status(201).json(playbook);
  } catch (err) {
    req.log.error({ err }, "Failed to create playbook");
    return res.status(400).json({ error: "Failed to create playbook" });
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
    return res.json({
      ...playbook,
      patterns: patternRows,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get playbook");
    return res.status(500).json({ error: "Failed to get playbook" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.icpVerticals !== undefined) updates.icpVerticals = req.body.icpVerticals;
    if (req.body.icpPersonas !== undefined) updates.icpPersonas = req.body.icpPersonas;
    if (req.body.icpPainPoints !== undefined) updates.icpPainPoints = req.body.icpPainPoints;
    if (req.body.icpDifferentiators !== undefined) updates.icpDifferentiators = req.body.icpDifferentiators;
    if (req.body.icpProofPoints !== undefined) updates.icpProofPoints = req.body.icpProofPoints;
    if (req.body.icpCompanySize !== undefined) updates.icpCompanySize = req.body.icpCompanySize;

    const [updated] = await db
      .update(playbooks)
      .set(updates)
      .where(eq(playbooks.id, id))
      .returning();
    if (!updated) {
      return res.status(404).json({ error: "Playbook not found" });
    }
    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update playbook");
    return res.status(500).json({ error: "Failed to update playbook" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = DeletePlaybookParams.parse({ id: Number(req.params.id) });
    const [deleted] = await db.delete(playbooks).where(eq(playbooks.id, id)).returning();
    if (!deleted) {
      return res.status(404).json({ error: "Playbook not found" });
    }
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete playbook");
    return res.status(500).json({ error: "Failed to delete playbook" });
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
      // Strip markdown code fences if the model wraps JSON in ```json ... ```
      let jsonText = content.text.trim();
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }
      analysis = JSON.parse(jsonText);
    } catch (parseErr) {
      req.log.error({ text: content.text.slice(0, 500), parseErr }, "Failed to parse AI analysis response");
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

    return res.json({
      patterns: analysis.patterns,
      principles: analysis.principles,
      qualityScore: analysis.qualityScore,
    });
  } catch (err) {
    if (isAnthropicIntegrationUnavailableError(err)) {
      req.log.warn({ err }, "Anthropic integration unavailable for email analysis");
      return res.status(503).json({ error: "Claude integration is not configured" });
    }
    req.log.error({ err }, "Failed to analyze emails");
    return res.status(500).json({ error: "Failed to analyze emails" });
  }
});

export default router;
