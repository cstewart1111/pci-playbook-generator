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

router.post("/script-builder", async (req, res) => {
  try {
    const { name, company, role, notes, context, playbookId } = req.body;
    if (!name && !company) {
      res.status(400).json({ error: "Either name or company is required" });
      return;
    }

    const playbookContext = await getPlaybookContext(playbookId);

    const targetInfo = [
      name ? `Name: ${name}` : null,
      company ? `Company: ${company}` : null,
      role ? `Role/Title: ${role}` : null,
      context ? `Additional Context: ${context}` : null,
    ].filter(Boolean).join("\n");

    const notesSection = notes && notes.length > 0
      ? `\nEXISTING NOTES AND HISTORY:\n${notes.join("\n---\n")}`
      : "";

    const DEAL_STAGES = [
      {
        stage: "Cold Outreach",
        description: "First contact. No prior relationship or engagement. The prospect may not know who you are.",
        tone: "Curiosity-driven, brief, pattern-interrupt opener. Focus on earning the right to a conversation.",
      },
      {
        stage: "Discovery / Qualification",
        description: "Initial interest shown. Need to qualify fit and uncover pain points.",
        tone: "Question-heavy, consultative. Focus on understanding their world before pitching.",
      },
      {
        stage: "Proposal / Evaluation",
        description: "Active deal. Prospect is evaluating your solution against alternatives.",
        tone: "Value-focused, specific to their stated needs. Reference prior conversations. Build urgency without pressure.",
      },
      {
        stage: "Negotiation / Decision",
        description: "Late-stage deal. Working on terms, pricing, or stakeholder buy-in.",
        tone: "Confident, direct. Address remaining concerns. Help them sell internally. Reinforce ROI.",
      },
      {
        stage: "Re-engagement / Stalled Deal",
        description: "Previously engaged but went dark or deal stalled. Trying to revive the conversation.",
        tone: "Low-pressure, new-value-driven. Bring a fresh angle or trigger event. Acknowledge the gap without guilt-tripping.",
      },
    ];

    const stageDescriptions = DEAL_STAGES.map((s, i) =>
      `VARIATION ${i + 1} - ${s.stage}:\nScenario: ${s.description}\nTone: ${s.tone}`
    ).join("\n\n");

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 16384,
      messages: [
        {
          role: "user",
          content: `You are an expert consultative enterprise sales coach. Generate 5 complete, structured call scripts tailored to the same prospect but adapted for different deal stages.
${playbookContext ? `\n${playbookContext}` : ""}

TARGET:
${targetInfo}
${notesSection}

Generate one full call script for EACH of the following 5 deal stages. Each script should be specifically tailored to the target person/company above and the notes provided. Use information from the notes to personalize discovery questions, openers, and objection handles.

${stageDescriptions}

For EACH variation, use this exact structure:

=== VARIATION [NUMBER]: [STAGE NAME] ===

OPENING:
(A concise 30-second opener appropriate for this stage)

DISCOVERY QUESTIONS:
(4 to 6 specific probing questions, numbered, appropriate for this stage)

CORE MESSAGE:
(Your value framing, 2 to 3 sentences tailored to this stage)

OBJECTION HANDLES:
(3 to 4 common objections for this stage with responses, numbered)

CLOSING:
(The next step ask appropriate for this stage)

===

Be specific to the target and their context. Use any notes or history provided to personalize each script. Return only the scripts.
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
        company: company || null,
        role: name || null,
        output: content.text,
        playbookId: playbookId ?? null,
      })
      .returning();

    res.json({ output: content.text, generationId: generation.id });
  } catch (err) {
    req.log.error({ err }, "Failed to generate script variations");
    res.status(500).json({ error: "Failed to generate script variations" });
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
