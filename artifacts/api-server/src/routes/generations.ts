import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { generations, playbooks, patterns } from "@workspace/db";
import {
  GenerateEmailBody,
  GenerateScriptBody,
  SuggestEditsBody,
} from "@workspace/api-zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

async function getPlaybookContext(playbookId?: number | null): Promise<string> {
  if (!playbookId) return "";
  const [playbook] = await db.select().from(playbooks).where(eq(playbooks.id, playbookId));
  if (!playbook) return "";
  const patternRows = await db.select().from(patterns).where(eq(patterns.playbookId, playbookId));

  let context = `\n\nPLAYBOOK: "${playbook.name}"\n`;
  if (playbook.principles.length > 0) {
    context += `\nPrinciples:\n${playbook.principles.map(p => `- ${p}`).join("\n")}`;
  }
  if (patternRows.length > 0) {
    context += `\n\nPatterns:\n${patternRows.map(p => `- [${p.type}] ${p.text}\n  Examples: ${p.examples.slice(0, 2).join("; ")}`).join("\n")}`;
  }
  return context;
}

router.get("/", async (req, res) => {
  try {
    const result = await db
      .select()
      .from(generations)
      .orderBy(desc(generations.createdAt))
      .limit(50);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to list generations");
    res.status(500).json({ error: "Failed to list generations" });
  }
});

router.post("/email", async (req, res) => {
  try {
    const body = GenerateEmailBody.parse(req.body);
    const playbookContext = await getPlaybookContext(body.playbookId);

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: `You are an expert consultative enterprise sales writer. Generate a highly personalized, research-based cold sales email.
${playbookContext}

Target Details:
- Company: ${body.company}
- Role: ${body.role}
- Problem Hypothesis: ${body.problemHypothesis}
- Recent Hook/Trigger: ${body.recentHook}
- Context: ${body.context}

Write a concise, compelling sales email (150-250 words). Use the playbook patterns if provided. The email should:
1. Open with a specific, research-based observation (not generic flattery)
2. Connect it to a relevant business pain
3. Position your value precisely
4. Have a low-friction CTA

Return only the email text, no subject line wrapper or explanation.`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected AI response");

    const [generation] = await db
      .insert(generations)
      .values({
        type: "email",
        company: body.company,
        role: body.role,
        output: content.text,
        playbookId: body.playbookId ?? null,
      })
      .returning();

    res.json({ output: content.text, generationId: generation.id });
  } catch (err) {
    req.log.error({ err }, "Failed to generate email");
    res.status(500).json({ error: "Failed to generate email" });
  }
});

router.post("/script", async (req, res) => {
  try {
    const body = GenerateScriptBody.parse(req.body);
    const playbookContext = await getPlaybookContext(body.playbookId);

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: `You are an expert in consultative enterprise sales call coaching. Generate a structured call script.
${playbookContext}

Objective: ${body.objective}
Context: ${body.context}

Generate a structured call script with these sections (use ALL of these):
OPENING: (30-second opener)
DISCOVERY QUESTIONS: (4-6 probing questions)
CORE MESSAGE: (your value framing)
OBJECTION HANDLES: (3-4 common objections with responses)
CLOSING: (next step ask)

Be specific to the context provided. Return only the script, no preamble.`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected AI response");

    const [generation] = await db
      .insert(generations)
      .values({
        type: "script",
        company: null,
        role: body.objective,
        output: content.text,
        playbookId: body.playbookId ?? null,
      })
      .returning();

    res.json({ output: content.text, generationId: generation.id });
  } catch (err) {
    req.log.error({ err }, "Failed to generate script");
    res.status(500).json({ error: "Failed to generate script" });
  }
});

router.post("/suggest-edits", async (req, res) => {
  try {
    const body = SuggestEditsBody.parse(req.body);
    const playbookContext = await getPlaybookContext(body.playbookId);

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: `You are an expert consultative sales coach. Review this draft email and provide structured feedback.
${playbookContext}

DRAFT EMAIL:
${body.draftEmail}

Provide feedback in this exact format:
STRENGTHS:
- [what works well, be specific]

GAPS:
- [what's missing or weak]

SPECIFIC IMPROVEMENTS:
- [Actionable, line-by-line suggestions]

REWRITE SUGGESTION:
[Optionally provide a quick improved version of the opening line or CTA if significantly weak]

Return only the feedback, no preamble.`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected AI response");

    const [generation] = await db
      .insert(generations)
      .values({
        type: "edits",
        company: null,
        role: null,
        output: content.text,
        playbookId: body.playbookId ?? null,
      })
      .returning();

    res.json({ output: content.text, generationId: generation.id });
  } catch (err) {
    req.log.error({ err }, "Failed to suggest edits");
    res.status(500).json({ error: "Failed to suggest edits" });
  }
});

export default router;
