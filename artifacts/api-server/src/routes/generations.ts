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

const FORMATTING_RULES = `
FORMATTING RULES - follow these exactly:
- Write in plain text only. No asterisks, pound signs, hashtags, or any markdown.
- Never use em dashes or long dashes. Use commas, periods, or a short hyphen where needed.
- Do not use bullet points with hyphens or asterisks. Write in full sentences or numbered points.
- Do not invent or assume any facts not provided to you.
- Write professionally, conversationally, and concisely.
- Output should paste cleanly into Outlook or HubSpot with no cleanup needed.
`;

async function getPlaybookContext(playbookId?: number | null): Promise<string> {
  if (!playbookId) return "";
  const [playbook] = await db.select().from(playbooks).where(eq(playbooks.id, playbookId));
  if (!playbook) return "";
  const patternRows = await db.select().from(patterns).where(eq(patterns.playbookId, playbookId));

  let context = `\nPLAYBOOK: "${playbook.name}"\n`;
  if (playbook.principles.length > 0) {
    context += `\nPrinciples:\n${playbook.principles.join("\n")}`;
  }
  if (patternRows.length > 0) {
    context += `\n\nPatterns:\n${patternRows.map(p => `[${p.type}] ${p.text} - Examples: ${p.examples.slice(0, 2).join("; ")}`).join("\n")}`;
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

    const details = [
      body.company ? `Company: ${body.company}` : null,
      body.role ? `Role: ${body.role}` : null,
      body.problemHypothesis ? `Problem Hypothesis: ${body.problemHypothesis}` : null,
      body.recentHook ? `Recent Hook: ${body.recentHook}` : null,
      body.context ? `Context: ${body.context}` : null,
    ].filter(Boolean).join("\n");

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: `You are an expert consultative enterprise sales writer. Generate a highly personalized, compelling sales email.
${playbookContext ? `\n${playbookContext}` : ""}

Target Details:
${details}

Write a concise, compelling sales email (150 to 250 words). Use the playbook patterns if provided. The email should:
1. Open with a specific, relevant observation based only on what is provided
2. Connect it to a business pain or opportunity
3. Position value precisely and briefly
4. End with a single, low-friction call to action

Return only the email body text. No subject line, no explanation, no preamble.
${FORMATTING_RULES}`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected AI response");

    const [generation] = await db
      .insert(generations)
      .values({
        type: "email",
        company: body.company || null,
        role: body.role || null,
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
          content: `You are an expert consultative enterprise sales coach. Generate a structured call script.
${playbookContext ? `\n${playbookContext}` : ""}

Objective: ${body.objective}
Context: ${body.context}

Generate a structured call script with exactly these sections, labeled as shown:

OPENING:
(A concise 30-second opener)

DISCOVERY QUESTIONS:
(4 to 6 specific probing questions, numbered)

CORE MESSAGE:
(Your value framing, 2 to 3 sentences)

OBJECTION HANDLES:
(3 to 4 common objections with responses, numbered)

CLOSING:
(The next step ask)

Be specific to the context. Return only the script.
${FORMATTING_RULES}`,
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
${playbookContext ? `\n${playbookContext}` : ""}

DRAFT EMAIL:
${body.draftEmail}

Provide feedback using exactly these section labels:

STRENGTHS:
(What works well, be specific)

GAPS:
(What is missing or weak)

SPECIFIC IMPROVEMENTS:
(Actionable, line-by-line suggestions)

REWRITE SUGGESTION:
(A brief improved version of the opening line or CTA, only if significantly weak)

Return only the feedback.
${FORMATTING_RULES}`,
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
