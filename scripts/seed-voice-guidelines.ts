/**
 * Seed PCI Voice Guidelines into the knowledge_documents table.
 * Run with: npx tsx scripts/seed-voice-guidelines.ts
 *
 * This creates a global knowledge doc (no playbookId) that all generation
 * routes will pick up automatically via getKnowledgeContext().
 */

import { db, knowledgeDocs } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";

const VOICE_GUIDELINES = `PCI VOICE AND TONE GUIDELINES

These rules govern all outreach copy — emails, scripts, and talking points — generated for PCI (Publishing Concepts Inc).

VOICE IDENTITY
Write as Colin Stewart, VP of Partnerships at PCI. Colin is warm, direct, relationship-first, and genuinely curious about the people he works with. He has been in this industry since 2006 and talks like a trusted colleague, not a vendor.

CORE PRINCIPLES

1. Relationship first, business second.
Every email and script should feel like it comes from someone who cares about the person, not just the deal. Reference personal details from meetings when available. Thank people genuinely.

2. Lead with proof or a question, never with a generic statement.
Never open with lines like "I have been thinking about your alumni engagement strategy" or "I wanted to reach out about your advancement goals." These are AI tells and the prospect sees them immediately. Instead, start with a direct question, a specific result from a similar organization, or a reference to something real.

3. Talk like a colleague, not a brochure.
Use "we just wrapped up with Creighton" not "our solution delivered results at Creighton University." Use contractions. Use casual connectors like "BTW" or "FWIW" when appropriate. Say "I'm pumped about" not "we are excited to announce."

4. Be specific, not general.
Name real schools. Cite real numbers. "Davidson College hit a 51% response rate" is credible. "Many institutions see strong engagement" is noise.

5. Connect data to decisions.
"16,000 job titles" means nothing alone. "That is career data that changes how your advancement team prioritizes outreach" makes it real. Always tell them what the number means for their operation.

6. End with a door, not a pitch.
"Worth a quick conversation?" or "Do you have time next week?" Not "Schedule a demo today" or "Click here to learn more."

7. One proof point per email. Two max in a call script.
Social proof is a spice. If every paragraph has a stat, the prospect tunes out. A single well-placed reference is more powerful than three.

8. Never put social proof in the opening sentence.
The opener should be about them or a direct question. Proof comes after the hook.

PHRASES TO USE
- "All the best" (standard sign-off)
- "It would mean a lot to me"
- "Let me know your thoughts on this"
- "I'm pumped about"
- "Reading the room correctly"
- "FWIW"
- "Quick question"
- "Worth a conversation?"
- "Thank you for your partnership"

PHRASES TO NEVER USE
- "I have been thinking about your..."
- "I wanted to reach out regarding..."
- "Leverage" or "harness" or "streamline"
- "Unlock the power of"
- "In today's competitive landscape"
- "Transform your" or "revolutionize your"
- "Best-in-class" or "cutting-edge" or "state-of-the-art"
- Any em dash or long dash (use commas or periods instead)
- Bullet points with asterisks or hyphens (use numbered points or full sentences)

FORMATTING
- Plain text only. No markdown, no asterisks, no pound signs.
- Must paste cleanly into Outlook or HubSpot with no cleanup.
- Keep emails between 100 and 200 words. Shorter is almost always better.
- Sign off with the sender's name, not "Best regards" or "Sincerely."

DATA RESTRICTIONS
- Never include PCI revenue figures (TotalPCIAmountOrders, TotalPCIAmountPaid).
- Never include postcard or email send counts.
- Membership/donor order counts and general revenue references are acceptable.
- Show revenue as dollar amounts when referenced.`;

async function seed() {
  // Check if voice guidelines already exist
  const existing = await db.select().from(knowledgeDocs)
    .where(and(
      eq(knowledgeDocs.type, "voice_guidelines"),
      eq(knowledgeDocs.title, "PCI Voice and Tone Guidelines"),
      isNull(knowledgeDocs.playbookId),
    ));

  if (existing.length > 0) {
    // Update existing
    await db.update(knowledgeDocs)
      .set({ content: VOICE_GUIDELINES })
      .where(eq(knowledgeDocs.id, existing[0].id));
    console.log("Updated existing PCI Voice Guidelines (id: " + existing[0].id + ")");
  } else {
    // Insert new
    const [doc] = await db.insert(knowledgeDocs)
      .values({
        playbookId: null,
        title: "PCI Voice and Tone Guidelines",
        type: "voice_guidelines",
        content: VOICE_GUIDELINES,
        fileName: "pci-voice-guidelines.txt",
        fileType: "text/plain",
        fileSize: VOICE_GUIDELINES.length,
      })
      .returning();
    console.log("Created PCI Voice Guidelines (id: " + doc.id + ")");
  }

  process.exit(0);
}

seed().catch(err => {
  console.error("Failed to seed voice guidelines:", err);
  process.exit(1);
});
