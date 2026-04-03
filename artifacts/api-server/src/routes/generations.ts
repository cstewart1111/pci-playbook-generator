import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { generations, playbooks, patterns, knowledgeDocs } from "@workspace/db";
import {
  GenerateEmailBody,
  GenerateScriptBody,
  SuggestEditsBody,
} from "@workspace/api-zod";
import {
  anthropic,
  isAnthropicIntegrationUnavailableError,
} from "@workspace/integrations-anthropic-ai";
import { eq, desc, and, isNull, isNotNull } from "drizzle-orm";
import { getSocialProofContext, getObjectionHandlesContext, type SocialProofResult } from "./social-proof";

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

const PCI_VOICE_RULES = `
PCI VOICE AND TONE - follow these in every script:

IDENTITY: Write as Colin Stewart, VP of Partnerships at PCI. Warm, direct, relationship-first, genuinely curious. In the industry since 2006. Talks like a trusted colleague, not a vendor.

CALL BEST PRACTICES (derived from real PCI calls):
1. Open warm and human. Small talk is not wasted time, it builds trust. "Happy Friday!" or a comment about the weather, tech issues, shared experiences. Then bridge naturally: "Maybe you can tell me about your role, and then I can share what we are doing."
2. Ask permission before pitching. "Maybe the best way to walk you through this is..." or "I did not ask you any questions prior to that, so I am sorry about that, but I am curious..."
3. Ask about their world first. Before positioning PCI, understand their current process: "What is your trigger point for bumping somebody up to an MGO?" or "How are you doing donor intelligence today?"
4. Tell the story first, then the number. "We did this with Fordham, collected donor stories, and ended up generating over 2,000 planned giving leads" is better than "We generated 2,000 leads at Fordham." The story gives context that makes the number credible.
5. Acknowledge before pivoting. When a prospect describes their current process, say "Gotcha, gotcha" or "Okay, okay" and ask a follow-up question. Never rebut their process directly.
6. Use the settlers vs. pioneers framework. Longtime loyal donors (settlers) vs. passionate career-prime donors ready to escalate (pioneers). This frames PCI value around donor intelligence, not just data.
7. Frame the close as a summary, not a new ask. "So that is kind of what we are talking about here..." then ask what they think. Low pressure.
8. One proof story per call section, two max per full script. Social proof is a spice, not a sauce.

PHRASES TO USE: "All the best", "It would mean a lot to me", "I am pumped about", "Reading the room correctly", "FWIW", "Quick question", "Worth a conversation?", "Gotcha", "Good deal"

PHRASES TO NEVER USE: "I have been thinking about your...", "I wanted to reach out regarding...", "Leverage", "Unlock the power of", "In today's competitive landscape", "Transform your", "Best-in-class", "Cutting-edge", "State-of-the-art"

DATA RESTRICTIONS: Never include PCI revenue figures. Never include postcard or email send counts. Membership/donor order counts and general dollar revenue references are acceptable.
`;

const SCRIPT_TYPE_TEMPLATES: Record<string, { sections: string; instructions: string }> = {
  cold_call: {
    sections: `OPENING:
(A concise 30-second pattern-interrupt opener. Earn the right to a conversation.)

DISCOVERY QUESTIONS:
(4 to 6 specific probing questions, numbered. Focus on understanding their world before any pitch.)

CORE MESSAGE:
(Your value framing, 2 to 3 sentences. Connect to what you learned in discovery.)

OBJECTION HANDLES:
(3 to 4 common objections with responses, numbered. Acknowledge first, then pivot.)

CLOSING:
(Low-pressure next step. "Worth a quick conversation?" not "Schedule a demo.")`,
    instructions: "This is a first-touch cold call. The prospect may not know who you are. Open with curiosity and warmth, not a pitch. Your only goal is to earn a second conversation.",
  },
  warm_call: {
    sections: `OPENING:
(Reference the prior touch: what they opened, replied to, or engaged with. Build on existing momentum.)

DISCOVERY QUESTIONS:
(4 to 6 questions that go deeper than the first touch. Reference what you already know.)

CORE MESSAGE:
(Value framing tied to their specific situation, 2 to 3 sentences.)

OBJECTION HANDLES:
(3 to 4 objections with responses, numbered.)

CLOSING:
(Propose a specific next step based on their engagement level.)`,
    instructions: "This prospect has shown interest: they replied, opened an email, or engaged somehow. Build on that momentum. Reference the prior touch naturally.",
  },
  follow_up: {
    sections: `OPENING:
(Brief, reference the prior voicemail or email. Do not re-pitch.)

BRIDGE:
(One sentence connecting your prior outreach to a new angle or value point.)

CORE MESSAGE:
(Fresh value framing, 1 to 2 sentences. Bring something new.)

CLOSING:
(Simple next step. Keep it short.)`,
    instructions: "You left a voicemail or sent an email. This is a follow-up touch. Be brief, bring a fresh angle, and do not repeat the original pitch word for word.",
  },
  gatekeeper: {
    sections: `INTRO LINE:
(Your name, company, and a confident reason for calling. Sound like you belong.)

BRIDGE TO DECISION MAKER:
(Ask for the right person by name if you have it. Give a brief, credible reason they will want to speak with you.)

IF UNAVAILABLE:
(Ask for the best time to reach them, or offer to leave a brief message.)

BACKUP ASK:
(If fully blocked, ask who handles alumni engagement or advancement partnerships.)`,
    instructions: "You are calling and reached a front desk or assistant. Be confident, brief, and give a credible reason. Do not pitch the gatekeeper. Your goal is to reach the decision maker.",
  },
  voicemail: {
    sections: `HOOK:
(One sentence that creates curiosity. Name a similar organization or result.)

VALUE:
(One sentence on what you can do for them, tied to their role.)

CALLBACK REASON:
(One sentence giving them a reason to call back or expect your follow-up.)

SIGN-OFF:
(Your name, company, and phone number. Say the number slowly.)`,
    instructions: "This is a voicemail drop. Keep it under 30 seconds total. One hook, one value point, one callback reason. Say your phone number clearly and slowly at the end.",
  },
  referral: {
    sections: `OPENING:
(Lead with the referral source. "So-and-so suggested I reach out" or "We just wrapped up a project with [similar org] and they mentioned you might be interested.")

DISCOVERY QUESTIONS:
(3 to 4 questions to understand their situation.)

CORE MESSAGE:
(Brief value framing, 1 to 2 sentences.)

CLOSING:
(Leverage the referral warmth for a specific next step.)`,
    instructions: "You have a referral or introduction. Lead with the connection. This call has built-in credibility, so use it. Focus on learning about them rather than pitching.",
  },
  event_follow_up: {
    sections: `OPENING:
(Reference the event, conference, or meeting. Be specific about what you discussed or what session you attended.)

BRIDGE:
(Connect the event conversation to a specific value point.)

DISCOVERY QUESTIONS:
(3 to 4 questions that build on the event context.)

CLOSING:
(Propose a follow-up meeting to continue the conversation from the event.)`,
    instructions: "You met this person at an event or conference. Reference specific details from the interaction. Build on the rapport already established.",
  },
  re_engagement: {
    sections: `OPENING:
(Acknowledge the gap without guilt-tripping. "It has been a while since we connected" not "I have not heard from you.")

NEW VALUE:
(Bring a fresh angle, trigger event, or new result. Something they have not heard before.)

DISCOVERY QUESTIONS:
(3 to 4 questions to understand what changed since you last spoke.)

CLOSING:
(Low-pressure. "If the timing is better now, I would love to reconnect." Not "Can we schedule a call?")`,
    instructions: "This prospect went dark or the deal stalled. Bring a completely fresh angle. Do not rehash the old pitch. Acknowledge the gap, bring new value, and keep the pressure low.",
  },
  set_meeting: {
    sections: `OPENING:
(Brief context: why you are calling and what the meeting would cover.)

REASON FOR MEETING:
(2 to 3 sentences on what they will get out of the meeting. Make it about their benefit, not yours.)

PROPOSED TIMES:
(Offer 2 to 3 specific time slots. Make it easy to say yes.)

IF HESITANT:
(Address the most common reason for hesitation. "It is just 20 minutes" or "No commitment, just a look at what we found.")`,
    instructions: "Your goal is to book a specific meeting (Zoom or onsite). Be direct, assume interest, and make it easy to say yes. Offer specific times.",
  },
};

// Default template for unknown script types
const DEFAULT_SCRIPT_TEMPLATE = {
  sections: `OPENING:
(A concise 30-second opener)

DISCOVERY QUESTIONS:
(4 to 6 specific probing questions, numbered)

CORE MESSAGE:
(Your value framing, 2 to 3 sentences)

OBJECTION HANDLES:
(3 to 4 common objections with responses, numbered)

CLOSING:
(The next step ask)`,
  instructions: "Generate a structured, personalized call script.",
};

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

  // ICP Profile
  const icpParts: string[] = [];
  if (playbook.icpVerticals.length > 0) icpParts.push(`Target Verticals: ${playbook.icpVerticals.join(", ")}`);
  if (playbook.icpPersonas.length > 0) icpParts.push(`Target Personas: ${playbook.icpPersonas.join(", ")}`);
  if (playbook.icpPainPoints.length > 0) icpParts.push(`Key Pain Points: ${playbook.icpPainPoints.join("; ")}`);
  if (playbook.icpDifferentiators.length > 0) icpParts.push(`Our Differentiators: ${playbook.icpDifferentiators.join("; ")}`);
  if (playbook.icpProofPoints.length > 0) icpParts.push(`Proof Points: ${playbook.icpProofPoints.join("; ")}`);
  if (playbook.icpCompanySize) icpParts.push(`Ideal Company Size: ${playbook.icpCompanySize}`);
  if (icpParts.length > 0) {
    context += `\n\nIDEAL CUSTOMER PROFILE:\n${icpParts.join("\n")}`;
  }

  return context;
}

async function getKnowledgeContext(playbookId?: number | null, productType?: string): Promise<string> {
  // Get knowledge docs: playbook-specific + global (no playbookId)
  let docs;
  if (playbookId) {
    const [playbookDocs, globalDocs] = await Promise.all([
      db.select().from(knowledgeDocs).where(eq(knowledgeDocs.playbookId, playbookId)),
      db.select().from(knowledgeDocs).where(isNull(knowledgeDocs.playbookId)),
    ]);
    docs = [...playbookDocs, ...globalDocs];
  } else {
    docs = await db.select().from(knowledgeDocs);
  }

  if (docs.length === 0) return "";

  // Sort docs so those matching the product type come first
  if (productType) {
    const lowerProduct = productType.toLowerCase();
    docs.sort((a, b) => {
      const aMatches = a.title.toLowerCase().includes(lowerProduct) || a.content.toLowerCase().includes(lowerProduct);
      const bMatches = b.title.toLowerCase().includes(lowerProduct) || b.content.toLowerCase().includes(lowerProduct);
      if (aMatches && !bMatches) return -1;
      if (!aMatches && bMatches) return 1;
      return 0;
    });
  }

  const sections = docs.map(d => `[${d.type.toUpperCase()}] ${d.title}:\n${d.content}`);
  // Limit total context to ~4000 chars to avoid overwhelming the prompt
  let combined = sections.join("\n\n");
  if (combined.length > 4000) {
    combined = combined.slice(0, 4000) + "\n...(truncated)";
  }
  const label = productType ? `\nKNOWLEDGE BASE (Product Type: ${productType}):\n${combined}` : `\nKNOWLEDGE BASE:\n${combined}`;
  return label;
}

async function getWinningPatternsContext(playbookId?: number | null): Promise<string> {
  // Find generations that got positive outcomes (replied, booked_meeting, closed_won)
  const winningOutcomes = ["replied", "booked_meeting", "closed_won"];
  let winners;
  if (playbookId) {
    winners = await db.select().from(generations)
      .where(and(
        eq(generations.playbookId, playbookId),
        isNotNull(generations.outcome),
      ))
      .orderBy(desc(generations.outcomeAt))
      .limit(5);
  } else {
    winners = await db.select().from(generations)
      .where(isNotNull(generations.outcome))
      .orderBy(desc(generations.outcomeAt))
      .limit(5);
  }

  const positiveWinners = winners.filter(w => winningOutcomes.includes(w.outcome!));
  if (positiveWinners.length === 0) return "";

  const examples = positiveWinners.map(w => {
    const header = [w.company, w.role].filter(Boolean).join(" / ");
    return `Outcome: ${w.outcome}${header ? ` (${header})` : ""}\n${w.output.slice(0, 500)}`;
  });

  return `\nPROVEN WINNING EMAILS (these got positive responses - learn from their style and approach):\n${examples.join("\n---\n")}`;
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
    const [playbookContext, knowledgeContext, winningContext] = await Promise.all([
      getPlaybookContext(body.playbookId),
      getKnowledgeContext(body.playbookId, body.productType),
      getWinningPatternsContext(body.playbookId),
    ]);

    // Social proof — optional context based on prospect company (can be skipped via request body)
    const skipProof = (req.body as any).skipSocialProof === true;
    const { context: socialProofContext, proofUsed } = skipProof
      ? { context: "", proofUsed: null }
      : getSocialProofContext(body.company || "");

    const toneInstructions: Record<string, string> = {
      professional: "Use a polished, formal tone. Be respectful, measured, and buttoned-up. Avoid slang or overly casual language.",
      conversational: "Write like a friendly colleague, not a salesperson. Keep it warm, natural, and approachable. Use contractions and simple language.",
      bold: "Be direct and confident. Lead with a strong point of view. Use short, punchy sentences. Don't hedge or qualify excessively.",
      empathetic: "Lead with understanding. Acknowledge the recipient's challenges before offering solutions. Be warm, supportive, and human.",
      urgent: "Create a sense of timeliness. Emphasize what they risk by waiting. Be direct about why acting now matters, but avoid being pushy or manipulative.",
    };

    const toneDirective = body.tone && toneInstructions[body.tone]
      ? `\nTONE: ${body.tone.charAt(0).toUpperCase() + body.tone.slice(1)}\n${toneInstructions[body.tone]}\n`
      : "";

    const details = [
      body.name ? `Recipient Name: ${body.name}` : null,
      body.company ? `Company: ${body.company}` : null,
      body.role ? `Role: ${body.role}` : null,
      body.productType ? `Product Type: ${body.productType}` : null,
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
          content: `You are Colin Stewart, VP of Partnerships at PCI (Publishing Concepts Inc). Generate a highly personalized, compelling sales email.
${PCI_VOICE_RULES}
${playbookContext ? `\n${playbookContext}` : ""}${knowledgeContext}${winningContext}${socialProofContext}${toneDirective}

Target Details:
${details}

If a Product Type is specified, tailor the email specifically to that product's value proposition and use cases.

Write a concise, compelling sales email (150 to 250 words). Use the playbook patterns, knowledge base, and winning email examples if provided. The email should:
1. Open with a specific, relevant observation based only on what is provided
2. Connect it to a business pain or opportunity
3. Position value precisely and briefly, using our differentiators and proof points when available
4. End with a single, low-friction call to action
5. Address the recipient by name if provided

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

    res.json({
      output: content.text,
      generationId: generation.id,
      socialProof: proofUsed ? {
        orgName: proofUsed.org.name.replace(/ \d{4}$/, ""),
        orgType: proofUsed.org.orgType,
        sizeTier: proofUsed.org.sizeTier,
        region: proofUsed.org.region,
        angle: proofUsed.angle,
        intensity: proofUsed.intensity,
        matchReason: proofUsed.matchReason,
        orgId: proofUsed.org.id,
        hasOHP: proofUsed.org.hasOHP,
      } : null,
    });
  } catch (err) {
    if (isAnthropicIntegrationUnavailableError(err)) {
      req.log.warn({ err }, "Anthropic integration unavailable for email generation");
      res.status(503).json({ error: "Claude integration is not configured" });
      return;
    }
    req.log.error({ err }, "Failed to generate email");
    res.status(500).json({ error: "Failed to generate email" });
  }
});

router.post("/script", async (req, res) => {
  try {
    const body = GenerateScriptBody.parse(req.body);
    const [playbookContext, knowledgeContext] = await Promise.all([
      getPlaybookContext(body.playbookId),
      getKnowledgeContext(body.playbookId),
    ]);

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: `You are Colin Stewart, VP of Partnerships at PCI (Publishing Concepts Inc). Generate a structured call script.
${PCI_VOICE_RULES}
${playbookContext ? `\n${playbookContext}` : ""}${knowledgeContext}

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
    if (isAnthropicIntegrationUnavailableError(err)) {
      req.log.warn({ err }, "Anthropic integration unavailable for script generation");
      res.status(503).json({ error: "Claude integration is not configured" });
      return;
    }
    req.log.error({ err }, "Failed to generate script");
    res.status(500).json({ error: "Failed to generate script" });
  }
});

router.post("/script-builder", async (req, res) => {
  try {
    const name = req.body.name || "";
    const company = req.body.company || "";
    const role = req.body.role || "";
    const productType = req.body.productType || "";
    const scriptType = req.body.scriptType || "";
    const context = req.body.context || "";
    const playbookId = req.body.playbookId || null;
    const rawNotes: unknown = req.body.notes;
    const notesList: string[] = Array.isArray(rawNotes)
      ? rawNotes.filter((n): n is string => typeof n === "string" && n.trim().length > 0)
      : [];

    if (!name && !company) {
      res.status(400).json({ error: "Either name or company is required" });
      return;
    }

    const [playbookContext, knowledgeContext, winningContext] = await Promise.all([
      getPlaybookContext(playbookId),
      getKnowledgeContext(playbookId, productType || undefined),
      getWinningPatternsContext(playbookId),
    ]);

    // Social proof for scripts — provide proof points for cold outreach and re-engagement stages
    const { context: socialProofContext, proofUsed: scriptProofUsed } = getSocialProofContext(company, "cold_outreach");
    const objectionContext = getObjectionHandlesContext(company);

    const targetInfo = [
      name ? `Name: ${name}` : null,
      company ? `Company: ${company}` : null,
      role ? `Role/Title: ${role}` : null,
      productType ? `Product Type: ${productType}` : null,
      scriptType ? `Script Type: ${scriptType}` : null,
      context ? `Additional Context: ${context}` : null,
    ].filter(Boolean).join("\n");

    const notesSection = notesList.length > 0
      ? `\nEXISTING NOTES AND HISTORY:\n${notesList.join("\n---\n")}`
      : "";

    const productInstruction = productType
      ? `\nIMPORTANT: Tailor all scripts specifically to PCI's "${productType}" product. Use its value proposition, use cases, and differentiators throughout the scripts.`
      : "";

    // Determine if we should generate a single script type or multi-stage
    const template = SCRIPT_TYPE_TEMPLATES[scriptType] || null;
    const isSingleType = template !== null && scriptType !== "cold_call";

    // Build system message with static rules (enables prompt caching across calls)
    const systemPrompt = `You are Colin Stewart, VP of Partnerships at PCI (Publishing Concepts Inc). Generate structured call scripts.
${PCI_VOICE_RULES}
${FORMATTING_RULES}`;

    let promptContent: string;

    if (isSingleType && template) {
      // Single script type mode — generate one targeted script
      promptContent = `Generate a structured call script for this specific scenario.
${playbookContext ? `\n${playbookContext}` : ""}${knowledgeContext}${winningContext}${socialProofContext}${objectionContext}
${productInstruction}

TARGET:
${targetInfo}
${notesSection}

SCENARIO: ${template.instructions}

Generate a single, complete call script using this exact structure:

${template.sections}

Be specific to the target and their context. Use any notes or history provided to personalize the script. Address the prospect by name when provided. Return only the script.`;
    } else {
      // Multi-stage mode — generate 5 deal stage variations
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

      promptContent = `You are Colin Stewart, VP of Partnerships at PCI (Publishing Concepts Inc). Generate 5 complete, structured call scripts tailored to the same prospect but adapted for different deal stages.
${PCI_VOICE_RULES}
${playbookContext ? `\n${playbookContext}` : ""}${knowledgeContext}${winningContext}${socialProofContext}${objectionContext}
${productInstruction}

TARGET:
${targetInfo}
${notesSection}

Generate one full call script for EACH of the following 5 deal stages. Each script should be specifically tailored to the target person/company above, the product type, and the notes provided. Use information from the knowledge base and notes to personalize discovery questions, openers, and objection handles. Address the prospect by name when provided.

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
${FORMATTING_RULES}`;
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: isSingleType ? 8192 : 16384,
      messages: [
        {
          role: "user",
          content: promptContent,
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

    res.json({
      output: content.text,
      generationId: generation.id,
      socialProof: scriptProofUsed ? {
        orgName: scriptProofUsed.org.name.replace(/ \d{4}$/, ""),
        orgType: scriptProofUsed.org.orgType,
        sizeTier: scriptProofUsed.org.sizeTier,
        region: scriptProofUsed.org.region,
        angle: scriptProofUsed.angle,
        intensity: scriptProofUsed.intensity,
        matchReason: scriptProofUsed.matchReason,
        orgId: scriptProofUsed.org.id,
        hasOHP: scriptProofUsed.org.hasOHP,
      } : null,
    });
  } catch (err) {
    if (isAnthropicIntegrationUnavailableError(err)) {
      req.log.warn(
        { err },
        "Anthropic integration unavailable for script variation generation",
      );
      res.status(503).json({ error: "Claude integration is not configured" });
      return;
    }
    req.log.error({ err }, "Failed to generate script variations");
    res.status(500).json({ error: "Failed to generate script variations" });
  }
});

// Update generation outcome (feedback loop)
router.patch("/:id/outcome", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { outcome, outcomeNotes } = req.body;
    if (!outcome) {
      res.status(400).json({ error: "outcome is required" });
      return;
    }
    const validOutcomes = ["sent", "replied", "booked_meeting", "closed_won", "no_response", "rejected"];
    if (!validOutcomes.includes(outcome)) {
      res.status(400).json({ error: `outcome must be one of: ${validOutcomes.join(", ")}` });
      return;
    }
    const [updated] = await db
      .update(generations)
      .set({
        outcome,
        outcomeNotes: outcomeNotes || null,
        outcomeAt: new Date(),
      })
      .where(eq(generations.id, id))
      .returning();
    if (!updated) {
      return res.status(404).json({ error: "Generation not found" });
    }
    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update generation outcome");
    return res.status(500).json({ error: "Failed to update outcome" });
  }
});

router.post("/suggest-edits", async (req, res) => {
  try {
    const body = SuggestEditsBody.parse(req.body);
    const [playbookContext, knowledgeContext] = await Promise.all([
      getPlaybookContext(body.playbookId),
      getKnowledgeContext(body.playbookId),
    ]);

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: `You are an expert consultative sales coach. Review this draft email and provide structured feedback.
${playbookContext ? `\n${playbookContext}` : ""}${knowledgeContext}

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
    if (isAnthropicIntegrationUnavailableError(err)) {
      req.log.warn({ err }, "Anthropic integration unavailable for edit suggestions");
      res.status(503).json({ error: "Claude integration is not configured" });
      return;
    }
    req.log.error({ err }, "Failed to suggest edits");
    res.status(500).json({ error: "Failed to suggest edits" });
  }
});

export default router;
