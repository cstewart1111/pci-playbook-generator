import { Router, type IRouter } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router: IRouter = Router();

function getConnectors() {
  return new ReplitConnectors();
}

async function hubspotGet(path: string, params?: Record<string, string>) {
  const connectors = getConnectors();
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const response = await connectors.proxy("hubspot", path + qs, { method: "GET" });
  return response.json();
}

router.get("/companies", async (req, res) => {
  try {
    const limit = String(req.query.limit ?? "20");
    const after = req.query.after ? String(req.query.after) : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;

    if (search) {
      const connectors = getConnectors();
      const body = {
        query: search,
        limit: parseInt(limit),
        properties: ["name", "domain", "industry", "city", "country", "numberofemployees", "annualrevenue", "hs_lastmodifieddate"],
      };
      const response = await connectors.proxy("hubspot", "/crm/v3/objects/companies/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      res.json(data);
    } else {
      const params: Record<string, string> = {
        limit,
        properties: "name,domain,industry,city,country,numberofemployees,annualrevenue,hs_lastmodifieddate",
      };
      if (after) params.after = after;
      const data = await hubspotGet("/crm/v3/objects/companies", params);
      res.json(data);
    }
  } catch (err) {
    req.log.error({ err }, "Failed to fetch HubSpot companies");
    res.status(500).json({ error: "Failed to fetch companies from HubSpot" });
  }
});

router.get("/companies/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [company, associations] = await Promise.all([
      hubspotGet(`/crm/v3/objects/companies/${id}`, {
        properties: "name,domain,industry,city,country,state,numberofemployees,annualrevenue,description,phone,hs_lastmodifieddate,createdate",
      }),
      hubspotGet(`/crm/v3/objects/companies/${id}/associations/contacts`, { limit: "100" }).catch(() => ({ results: [] })),
    ]);

    const contactIds: string[] = (associations?.results ?? []).map((a: { id: string }) => a.id);

    let contacts: object[] = [];
    if (contactIds.length > 0) {
      const connectors = getConnectors();
      const batchResp = await connectors.proxy("hubspot", "/crm/v3/objects/contacts/batch/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputs: contactIds.slice(0, 20).map((cid) => ({ id: cid })),
          properties: ["firstname", "lastname", "email", "jobtitle", "phone"],
        }),
      });
      const batchData = await batchResp.json();
      contacts = batchData?.results ?? [];
    }

    res.json({ company, contacts });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch HubSpot company detail");
    res.status(500).json({ error: "Failed to fetch company from HubSpot" });
  }
});

router.get("/companies/:id/emails", async (req, res) => {
  try {
    const { id } = req.params;
    const connectors = getConnectors();

    const searchBody = {
      filterGroups: [
        {
          filters: [
            { propertyName: "associations.company", operator: "EQ", value: id },
            { propertyName: "hs_email_direction", operator: "IN", values: ["EMAIL", "INCOMING_EMAIL", "FORWARDED_EMAIL"] },
          ],
        },
      ],
      sorts: [{ propertyName: "hs_timestamp", direction: "DESCENDING" }],
      properties: ["hs_email_subject", "hs_email_text", "hs_email_direction", "hs_timestamp", "hs_email_from_email", "hs_email_to_email"],
      limit: 30,
    };

    const response = await connectors.proxy("hubspot", "/crm/v3/objects/emails/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(searchBody),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch company emails");
    res.status(500).json({ error: "Failed to fetch emails" });
  }
});

router.get("/companies/:id/notes", async (req, res) => {
  try {
    const { id } = req.params;
    const connectors = getConnectors();

    const searchBody = {
      filterGroups: [
        {
          filters: [
            { propertyName: "associations.company", operator: "EQ", value: id },
          ],
        },
      ],
      sorts: [{ propertyName: "hs_timestamp", direction: "DESCENDING" }],
      properties: ["hs_note_body", "hs_timestamp", "hs_lastmodifieddate"],
      limit: 20,
    };

    const response = await connectors.proxy("hubspot", "/crm/v3/objects/notes/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(searchBody),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch company notes");
    res.status(500).json({ error: "Failed to fetch notes" });
  }
});

router.post("/companies/:id/summarize", async (req, res) => {
  try {
    const { id } = req.params;
    const { company, contacts, emails, notes, playbookContext } = req.body;

    const companyName = company?.properties?.name ?? "Unknown Company";
    const industry = company?.properties?.industry ?? "";
    const employees = company?.properties?.numberofemployees ?? "";
    const revenue = company?.properties?.annualrevenue ?? "";
    const description = company?.properties?.description ?? "";

    const contactsList = (contacts ?? [])
      .slice(0, 5)
      .map((c: { properties: { firstname?: string; lastname?: string; jobtitle?: string; email?: string } }) =>
        `${c.properties?.firstname ?? ""} ${c.properties?.lastname ?? ""} — ${c.properties?.jobtitle ?? "Unknown Role"} (${c.properties?.email ?? ""})`
      )
      .join("\n");

    const emailThread = (emails ?? [])
      .slice(0, 10)
      .map((e: { properties: { hs_email_subject?: string; hs_email_direction?: string; hs_timestamp?: string; hs_email_text?: string } }) =>
        `[${e.properties?.hs_email_direction ?? "EMAIL"}] ${e.properties?.hs_email_subject ?? "(no subject)"} — ${e.properties?.hs_timestamp ? new Date(e.properties.hs_timestamp).toLocaleDateString() : ""}\n${(e.properties?.hs_email_text ?? "").slice(0, 400)}`
      )
      .join("\n\n---\n\n");

    const notesSummary = (notes ?? [])
      .slice(0, 10)
      .map((n: { properties: { hs_note_body?: string; hs_timestamp?: string } }) =>
        `${n.properties?.hs_timestamp ? new Date(n.properties.hs_timestamp).toLocaleDateString() : ""}: ${(n.properties?.hs_note_body ?? "").slice(0, 300)}`
      )
      .join("\n");

    const prompt = `You are an expert enterprise sales strategist. Generate a concise, actionable account summary and outreach recommendation.

ACCOUNT: ${companyName}
Industry: ${industry}
Employees: ${employees}
Revenue: $${revenue}
Description: ${description}

KEY CONTACTS:
${contactsList || "No contacts found"}

RECENT EMAIL THREADS (${(emails ?? []).length} emails):
${emailThread || "No email history"}

NOTES/ACTIVITY (${(notes ?? []).length} notes):
${notesSummary || "No notes"}

${playbookContext ? `SALES PLAYBOOK:\n${playbookContext}` : ""}

Generate a structured account summary in this format:

## Account Summary
[2-3 sentence overview of who this company is and where they are in the relationship]

## Relationship Status
[Current engagement level: cold/warm/active/at-risk, and why]

## Key Intelligence
- [Bullet: specific insight from emails/notes]
- [Bullet: specific insight from emails/notes]
- [Bullet: specific insight from emails/notes]

## Recommended Next Action
[One specific, concrete next step with reasoning — be opinionated]

## Suggested Outreach Angle
[The specific hook or message angle that will resonate based on what you know]`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected AI response");

    res.json({ summary: content.text, companyName });
  } catch (err) {
    req.log.error({ err }, "Failed to summarize company");
    res.status(500).json({ error: "Failed to generate account summary" });
  }
});

router.get("/contacts", async (req, res) => {
  try {
    const limit = String(req.query.limit ?? "20");
    const after = req.query.after ? String(req.query.after) : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;

    if (search) {
      const connectors = getConnectors();
      const body = {
        query: search,
        limit: parseInt(limit),
        properties: ["firstname", "lastname", "email", "jobtitle", "company", "phone", "hs_lastmodifieddate"],
      };
      const response = await connectors.proxy("hubspot", "/crm/v3/objects/contacts/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      res.json(data);
    } else {
      const params: Record<string, string> = {
        limit,
        properties: "firstname,lastname,email,jobtitle,company,phone,hs_lastmodifieddate",
      };
      if (after) params.after = after;
      const data = await hubspotGet("/crm/v3/objects/contacts", params);
      res.json(data);
    }
  } catch (err) {
    req.log.error({ err }, "Failed to fetch HubSpot contacts");
    res.status(500).json({ error: "Failed to fetch contacts from HubSpot" });
  }
});

router.get("/contacts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [contact, associations] = await Promise.all([
      hubspotGet(`/crm/v3/objects/contacts/${id}`, {
        properties: "firstname,lastname,email,jobtitle,company,phone,city,state,country,hs_lastmodifieddate,createdate,lifecyclestage,hs_lead_status",
      }),
      hubspotGet(`/crm/v3/objects/contacts/${id}/associations/companies`, { limit: "10" }).catch(() => ({ results: [] })),
    ]);

    const companyIds: string[] = (associations?.results ?? []).map((a: { id: string }) => a.id);
    let companies: object[] = [];
    if (companyIds.length > 0) {
      const connectors = getConnectors();
      const batchResp = await connectors.proxy("hubspot", "/crm/v3/objects/companies/batch/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputs: companyIds.slice(0, 5).map((cid) => ({ id: cid })),
          properties: ["name", "domain", "industry"],
        }),
      });
      const batchData = await batchResp.json();
      companies = batchData?.results ?? [];
    }

    res.json({ contact, companies });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch HubSpot contact detail");
    res.status(500).json({ error: "Failed to fetch contact from HubSpot" });
  }
});

router.get("/contacts/:id/emails", async (req, res) => {
  try {
    const { id } = req.params;
    const connectors = getConnectors();

    const searchBody = {
      filterGroups: [
        {
          filters: [
            { propertyName: "associations.contact", operator: "EQ", value: id },
          ],
        },
      ],
      sorts: [{ propertyName: "hs_timestamp", direction: "DESCENDING" }],
      properties: ["hs_email_subject", "hs_email_text", "hs_email_direction", "hs_timestamp", "hs_email_from_email", "hs_email_to_email"],
      limit: 20,
    };

    const response = await connectors.proxy("hubspot", "/crm/v3/objects/emails/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(searchBody),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch contact emails");
    res.status(500).json({ error: "Failed to fetch emails" });
  }
});

router.post("/contacts/:id/summarize", async (req, res) => {
  try {
    const { contact, companies, emails, playbookContext } = req.body;

    const firstName = contact?.properties?.firstname ?? "";
    const lastName = contact?.properties?.lastname ?? "";
    const fullName = `${firstName} ${lastName}`.trim() || "Unknown Contact";
    const title = contact?.properties?.jobtitle ?? "";
    const company = contact?.properties?.company ?? "";
    const lifecycleStage = contact?.properties?.lifecyclestage ?? "";
    const leadStatus = contact?.properties?.hs_lead_status ?? "";

    const companiesList = (companies ?? [])
      .map((c: { properties: { name?: string; industry?: string } }) => `${c.properties?.name ?? ""} (${c.properties?.industry ?? ""})`)
      .join(", ");

    const emailThread = (emails ?? [])
      .slice(0, 8)
      .map((e: { properties: { hs_email_subject?: string; hs_email_direction?: string; hs_timestamp?: string; hs_email_text?: string } }) =>
        `[${e.properties?.hs_email_direction ?? "EMAIL"}] ${e.properties?.hs_email_subject ?? "(no subject)"} — ${e.properties?.hs_timestamp ? new Date(e.properties.hs_timestamp).toLocaleDateString() : ""}\n${(e.properties?.hs_email_text ?? "").slice(0, 500)}`
      )
      .join("\n\n---\n\n");

    const prompt = `You are an expert enterprise sales strategist. Generate a concise, actionable contact summary and personalization guide.

CONTACT: ${fullName}
Title: ${title}
Company: ${company}
Associated Companies: ${companiesList || "None"}
Lifecycle Stage: ${lifecycleStage}
Lead Status: ${leadStatus}

RECENT EMAIL HISTORY (${(emails ?? []).length} emails):
${emailThread || "No email history found"}

${playbookContext ? `SALES PLAYBOOK:\n${playbookContext}` : ""}

Generate a structured contact summary in this format:

## Contact Summary
[2-3 sentences: who this person is and their relationship with you]

## Engagement History
[Current status: never engaged/early conversations/active/stalled/won/lost, with context]

## What We Know
- [Specific insight from email history or profile]
- [Specific insight]
- [Specific insight]

## Personalization Angle
[The specific hook, reference, or topic that will resonate with THIS person based on what you know]

## Recommended Outreach
[One concrete, specific message recommendation — what to say and why it will land]`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected AI response");

    res.json({ summary: content.text, contactName: fullName });
  } catch (err) {
    req.log.error({ err }, "Failed to summarize contact");
    res.status(500).json({ error: "Failed to generate contact summary" });
  }
});

export default router;
