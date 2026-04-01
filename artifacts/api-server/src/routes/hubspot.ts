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
    // Strip HTML tags from note bodies to return plain text
    if (data.results) {
      data.results = data.results.map((note: any) => ({
        ...note,
        properties: {
          ...note.properties,
          hs_note_body: note.properties.hs_note_body
            ? note.properties.hs_note_body.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#\d+;/g, "").replace(/\s+/g, " ").trim()
            : note.properties.hs_note_body,
        },
      }));
    }
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch company notes");
    res.status(500).json({ error: "Failed to fetch notes" });
  }
});

// Calls for a company
router.get("/companies/:id/calls", async (req, res) => {
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
      properties: [
        "hs_call_title", "hs_call_body", "hs_call_direction", "hs_timestamp",
        "hs_call_duration", "hs_call_status", "hs_call_disposition",
        "hs_call_recording_url", "hs_call_from_number", "hs_call_to_number",
      ],
      limit: 20,
    };

    const response = await connectors.proxy("hubspot", "/crm/v3/objects/calls/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(searchBody),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch company calls");
    res.status(500).json({ error: "Failed to fetch calls" });
  }
});

// Advanced filtered search for companies
router.post("/companies/search/filtered", async (req, res) => {
  try {
    const { industry, city, minEmployees, maxEmployees, minRevenue, maxRevenue, query, limit: reqLimit } = req.body as {
      industry?: string;
      city?: string;
      minEmployees?: string;
      maxEmployees?: string;
      minRevenue?: string;
      maxRevenue?: string;
      query?: string;
      limit?: number;
    };

    const filters: Array<{ propertyName: string; operator: string; value?: string; highValue?: string }> = [];

    if (industry) filters.push({ propertyName: "industry", operator: "EQ", value: industry });
    if (city) filters.push({ propertyName: "city", operator: "CONTAINS_TOKEN", value: city });
    if (minEmployees) filters.push({ propertyName: "numberofemployees", operator: "GTE", value: minEmployees });
    if (maxEmployees) filters.push({ propertyName: "numberofemployees", operator: "LTE", value: maxEmployees });
    if (minRevenue) filters.push({ propertyName: "annualrevenue", operator: "GTE", value: minRevenue });
    if (maxRevenue) filters.push({ propertyName: "annualrevenue", operator: "LTE", value: maxRevenue });

    const connectors = getConnectors();
    const body: Record<string, unknown> = {
      limit: reqLimit ?? 20,
      properties: ["name", "domain", "industry", "city", "country", "numberofemployees", "annualrevenue", "hs_lastmodifieddate"],
      sorts: [{ propertyName: "hs_lastmodifieddate", direction: "DESCENDING" }],
    };

    if (query) body.query = query;
    if (filters.length > 0) body.filterGroups = [{ filters }];

    const response = await connectors.proxy("hubspot", "/crm/v3/objects/companies/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to filter companies");
    res.status(500).json({ error: "Failed to filter companies" });
  }
});

// Advanced filtered search for contacts
router.post("/contacts/search/filtered", async (req, res) => {
  try {
    const { lifecyclestage, company, jobtitle, city, query, limit: reqLimit } = req.body as {
      lifecyclestage?: string;
      company?: string;
      jobtitle?: string;
      city?: string;
      query?: string;
      limit?: number;
    };

    const filters: Array<{ propertyName: string; operator: string; value?: string }> = [];

    if (lifecyclestage) filters.push({ propertyName: "lifecyclestage", operator: "EQ", value: lifecyclestage });
    if (company) filters.push({ propertyName: "company", operator: "CONTAINS_TOKEN", value: company });
    if (jobtitle) filters.push({ propertyName: "jobtitle", operator: "CONTAINS_TOKEN", value: jobtitle });
    if (city) filters.push({ propertyName: "city", operator: "CONTAINS_TOKEN", value: city });

    const connectors = getConnectors();
    const body: Record<string, unknown> = {
      limit: reqLimit ?? 20,
      properties: ["firstname", "lastname", "email", "jobtitle", "company", "phone", "lifecyclestage", "city", "hs_lastmodifieddate"],
      sorts: [{ propertyName: "hs_lastmodifieddate", direction: "DESCENDING" }],
    };

    if (query) body.query = query;
    if (filters.length > 0) body.filterGroups = [{ filters }];

    const response = await connectors.proxy("hubspot", "/crm/v3/objects/contacts/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to filter contacts");
    res.status(500).json({ error: "Failed to filter contacts" });
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

Generate a structured account summary using exactly these section labels. Write in plain text, no markdown, no em dashes, no bullet points with hyphens. Only use information provided above.

ACCOUNT SUMMARY:
(2 to 3 sentences on who this company is and where the relationship stands)

RELATIONSHIP STATUS:
(Current engagement level: cold, warm, active, or at-risk, and a brief explanation why)

KEY INTELLIGENCE:
(3 to 4 specific insights drawn only from the emails and notes above, written as short sentences separated by line breaks)

RECOMMENDED NEXT ACTION:
(One specific, concrete next step with brief reasoning. Be direct and opinionated.)

SUGGESTED OUTREACH ANGLE:
(The specific hook or message angle that will resonate based on what you actually know)`;

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

// Calls for a contact
router.get("/contacts/:id/calls", async (req, res) => {
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
      properties: [
        "hs_call_title", "hs_call_body", "hs_call_direction", "hs_timestamp",
        "hs_call_duration", "hs_call_status", "hs_call_disposition",
        "hs_call_recording_url", "hs_call_from_number", "hs_call_to_number",
      ],
      limit: 20,
    };

    const response = await connectors.proxy("hubspot", "/crm/v3/objects/calls/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(searchBody),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch contact calls");
    res.status(500).json({ error: "Failed to fetch calls" });
  }
});

// Notes for a contact
router.get("/contacts/:id/notes", async (req, res) => {
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
      properties: ["hs_note_body", "hs_timestamp", "hs_lastmodifieddate"],
      limit: 20,
    };

    const response = await connectors.proxy("hubspot", "/crm/v3/objects/notes/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(searchBody),
    });
    const data = await response.json();
    // Strip HTML tags from note bodies to return plain text
    if (data.results) {
      data.results = data.results.map((note: any) => ({
        ...note,
        properties: {
          ...note.properties,
          hs_note_body: note.properties.hs_note_body
            ? note.properties.hs_note_body.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#\d+;/g, "").replace(/\s+/g, " ").trim()
            : note.properties.hs_note_body,
        },
      }));
    }
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch contact notes");
    res.status(500).json({ error: "Failed to fetch notes" });
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

Generate a structured contact summary using exactly these section labels. Write in plain text, no markdown, no em dashes, no bullet points with hyphens. Only use information provided above.

CONTACT SUMMARY:
(2 to 3 sentences on who this person is and where the relationship stands)

ENGAGEMENT HISTORY:
(Current status: never engaged, early conversations, active, stalled, won, or lost, with a brief explanation)

WHAT WE KNOW:
(3 specific insights drawn only from the email history and profile above, written as short sentences separated by line breaks)

PERSONALIZATION ANGLE:
(The specific hook or reference that will resonate with this person based on what you actually know)

RECOMMENDED OUTREACH:
(One concrete, specific message recommendation. What to say and why it will land.)`;

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

const FORMATTING_RULES = `
FORMATTING RULES - follow these exactly:
- Write in plain text only. No asterisks, pound signs, hashtags, bold, or any markdown formatting.
- Never use em dashes or long dashes. Use commas or periods where you might use them.
- Do not invent or assume any facts not provided. Only use information given to you.
- Write professionally and conversationally.
- Output should paste cleanly into Outlook or HubSpot with no cleanup needed.
`;

const GOAL_LABELS: Record<string, string> = {
  zoom: "Schedule a Zoom meeting",
  onsite: "Schedule an onsite visit",
  discovery: "Schedule a discovery call",
  demo: "Schedule a product demo",
  followup: "Send a follow-up after previous contact",
  reengage: "Re-engage a cold or stalled prospect",
  resource: "Share a relevant resource or insight",
};

async function get90DayActivity(type: "company" | "contact", id: string, connectors: ReturnType<typeof getConnectors>) {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const emailSearch = {
    filterGroups: [
      {
        filters: [
          { propertyName: `associations.${type}`, operator: "EQ", value: id },
          { propertyName: "hs_timestamp", operator: "GTE", value: cutoff },
        ],
      },
    ],
    sorts: [{ propertyName: "hs_timestamp", direction: "DESCENDING" }],
    properties: ["hs_email_subject", "hs_email_text", "hs_email_direction", "hs_timestamp"],
    limit: 20,
  };

  const noteSearch = type === "company" ? {
    filterGroups: [
      {
        filters: [
          { propertyName: "associations.company", operator: "EQ", value: id },
          { propertyName: "hs_timestamp", operator: "GTE", value: cutoff },
        ],
      },
    ],
    sorts: [{ propertyName: "hs_timestamp", direction: "DESCENDING" }],
    properties: ["hs_note_body", "hs_timestamp"],
    limit: 15,
  } : null;

  const [emailResp, noteResp] = await Promise.all([
    connectors.proxy("hubspot", "/crm/v3/objects/emails/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(emailSearch),
    }).then(r => r.json()).catch(() => ({ results: [] })),
    noteSearch ? connectors.proxy("hubspot", "/crm/v3/objects/notes/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(noteSearch),
    }).then(r => r.json()).catch(() => ({ results: [] })) : Promise.resolve({ results: [] }),
  ]);

  return {
    emails: emailResp?.results ?? [],
    notes: noteResp?.results ?? [],
  };
}

function formatActivityForPrompt(emails: Array<{ properties: Record<string, string> }>, notes: Array<{ properties: Record<string, string> }>) {
  const emailLines = emails.slice(0, 10).map(e => {
    const dir = (e.properties.hs_email_direction ?? "").includes("INCOMING") ? "Inbound" : "Outbound";
    const date = e.properties.hs_timestamp ? new Date(e.properties.hs_timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
    const subject = e.properties.hs_email_subject ?? "(no subject)";
    const body = (e.properties.hs_email_text ?? "").replace(/\s+/g, " ").slice(0, 400);
    return `[${dir} email - ${date}] Subject: ${subject}\n${body}`;
  });

  const noteLines = notes.slice(0, 8).map(n => {
    const date = n.properties.hs_timestamp ? new Date(n.properties.hs_timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
    const body = (n.properties.hs_note_body ?? "").replace(/\s+/g, " ").slice(0, 300);
    return `[Note - ${date}] ${body}`;
  });

  const parts = [];
  if (emailLines.length > 0) parts.push(`EMAILS:\n${emailLines.join("\n\n")}`);
  if (noteLines.length > 0) parts.push(`NOTES:\n${noteLines.join("\n\n")}`);
  return parts.join("\n\n") || "No recent activity in the last 90 days.";
}

router.post("/companies/:id/generate", async (req, res) => {
  try {
    const { id } = req.params;
    const { goal, context, type, playbookId } = req.body as {
      goal: string;
      context?: string;
      type: "email" | "script";
      playbookId?: string;
    };

    if (!goal || !type) {
      res.status(400).json({ error: "goal and type are required" });
      return;
    }

    const connectors = getConnectors();
    const [detail, activity] = await Promise.all([
      hubspotGet(`/crm/v3/objects/companies/${id}`, {
        properties: "name,domain,industry,city,country,numberofemployees,description",
      }),
      get90DayActivity("company", id, connectors),
    ]);

    const props = detail?.properties ?? {};
    const goalLabel = GOAL_LABELS[goal] ?? goal;
    const activityText = formatActivityForPrompt(activity.emails, activity.notes);
    const contextBlock = context?.trim() ? `\nADDITIONAL CONTEXT FROM REP:\n${context.trim()}` : "";

    if (type === "email") {
      const prompt = `You are an expert enterprise sales writer. Write a personalized outreach email based on real CRM data.

ACCOUNT PROFILE:
Company: ${props.name ?? "Unknown"}
Industry: ${props.industry ?? "Unknown"}
Employees: ${props.numberofemployees ?? "Unknown"}
Description: ${props.description ?? "None"}

GOAL: ${goalLabel}
${contextBlock}

ACTIVITY FROM THE LAST 90 DAYS:
${activityText}

Write a professional sales email (150 to 200 words) that:
1. References something specific from the actual activity above, if relevant
2. Connects to the goal: ${goalLabel}
3. Is warm and conversational, not stiff or generic
4. Ends with a single, specific ask that makes it easy to say yes

Return only the email body text. No subject line, no preamble.
${FORMATTING_RULES}`;

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      });
      const content = message.content[0];
      if (content.type !== "text") throw new Error("Unexpected AI response");
      res.json({ output: content.text });
    } else {
      const prompt = `You are an expert enterprise sales coach. Write a structured call script based on real CRM data.

ACCOUNT PROFILE:
Company: ${props.name ?? "Unknown"}
Industry: ${props.industry ?? "Unknown"}
Employees: ${props.numberofemployees ?? "Unknown"}

GOAL: ${goalLabel}
${contextBlock}

ACTIVITY FROM THE LAST 90 DAYS:
${activityText}

Write a structured call script with exactly these labeled sections:

OPENING:
(30-second opener that references real context from the activity above if available)

DISCOVERY QUESTIONS:
(4 to 5 specific, open-ended questions numbered 1 through 5)

CORE MESSAGE:
(2 to 3 sentences on your value framing, tied to their situation)

OBJECTION HANDLES:
(3 common objections with brief responses, numbered 1 through 3)

CLOSING:
(The exact words to use for the ask: ${goalLabel})

Be specific. Reference the real data. Do not fabricate anything.
${FORMATTING_RULES}`;

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 3000,
        messages: [{ role: "user", content: prompt }],
      });
      const content = message.content[0];
      if (content.type !== "text") throw new Error("Unexpected AI response");
      res.json({ output: content.text });
    }
  } catch (err) {
    req.log.error({ err }, "Failed to generate from company context");
    res.status(500).json({ error: "Failed to generate content" });
  }
});

router.post("/contacts/:id/generate", async (req, res) => {
  try {
    const { id } = req.params;
    const { goal, context, type, playbookId } = req.body as {
      goal: string;
      context?: string;
      type: "email" | "script";
      playbookId?: string;
    };

    if (!goal || !type) {
      res.status(400).json({ error: "goal and type are required" });
      return;
    }

    const connectors = getConnectors();
    const [detail, activity] = await Promise.all([
      hubspotGet(`/crm/v3/objects/contacts/${id}`, {
        properties: "firstname,lastname,email,jobtitle,company,lifecyclestage,hs_lead_status",
      }),
      get90DayActivity("contact", id, connectors),
    ]);

    const props = detail?.properties ?? {};
    const fullName = [props.firstname, props.lastname].filter(Boolean).join(" ") || "this contact";
    const goalLabel = GOAL_LABELS[goal] ?? goal;
    const activityText = formatActivityForPrompt(activity.emails, activity.notes);
    const contextBlock = context?.trim() ? `\nADDITIONAL CONTEXT FROM REP:\n${context.trim()}` : "";

    if (type === "email") {
      const prompt = `You are an expert enterprise sales writer. Write a personalized outreach email based on real CRM data.

CONTACT PROFILE:
Name: ${fullName}
Title: ${props.jobtitle ?? "Unknown"}
Company: ${props.company ?? "Unknown"}
Lifecycle Stage: ${props.lifecyclestage ?? "Unknown"}

GOAL: ${goalLabel}
${contextBlock}

ACTIVITY FROM THE LAST 90 DAYS:
${activityText}

Write a professional sales email (150 to 200 words) addressed to ${fullName} that:
1. References something specific from the actual email history above, if relevant
2. Is warm and personal, not templated sounding
3. Connects clearly to the goal: ${goalLabel}
4. Ends with a single, specific ask

Return only the email body text. No subject line, no preamble, no sign-off instructions.
${FORMATTING_RULES}`;

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      });
      const content = message.content[0];
      if (content.type !== "text") throw new Error("Unexpected AI response");
      res.json({ output: content.text });
    } else {
      const prompt = `You are an expert enterprise sales coach. Write a structured call script based on real CRM data.

CONTACT PROFILE:
Name: ${fullName}
Title: ${props.jobtitle ?? "Unknown"}
Company: ${props.company ?? "Unknown"}
Lifecycle Stage: ${props.lifecyclestage ?? "Unknown"}

GOAL: ${goalLabel}
${contextBlock}

ACTIVITY FROM THE LAST 90 DAYS:
${activityText}

Write a structured call script with exactly these labeled sections:

OPENING:
(Warm, specific 30-second opener tailored to ${fullName} and the real context above)

DISCOVERY QUESTIONS:
(4 to 5 specific questions numbered 1 through 5, informed by what you know)

CORE MESSAGE:
(2 to 3 sentences connecting your value to their specific situation)

OBJECTION HANDLES:
(3 likely objections with brief responses, numbered 1 through 3)

CLOSING:
(The exact words for the ask: ${goalLabel})

Be specific to this person. Reference the real data. Do not fabricate anything.
${FORMATTING_RULES}`;

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 3000,
        messages: [{ role: "user", content: prompt }],
      });
      const content = message.content[0];
      if (content.type !== "text") throw new Error("Unexpected AI response");
      res.json({ output: content.text });
    }
  } catch (err) {
    req.log.error({ err }, "Failed to generate from contact context");
    res.status(500).json({ error: "Failed to generate content" });
  }
});

export default router;
