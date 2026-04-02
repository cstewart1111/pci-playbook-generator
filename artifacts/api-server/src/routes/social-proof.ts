import * as fs from "fs";
import * as path from "path";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ProofOrg {
  id: string;
  name: string;
  orgType: string;
  sizeTier: string;
  region: string;
  alumniCount: number;
  responseRate: number;
  respondents: number;
  buyers: number;
  memDonOrders: number;
  stories: number;
  storiesCompleted: number;
  emailsAdded: number;
  employersAdded: number;
  jobTitlesAdded: number;
  phonesAdded: number;
  isDonor: boolean;
  isMember: boolean;
  totalScore: number;
  angles: string[];
  hasOHP: boolean;
  proofTier: string;
}

export interface OHPCase {
  name: string;
  category: string;
  stories: number;
  interviews: number;
  newDonors: number;
  cellPhones: number;
  emails: number;
  jobTitles: number;
  bequestAlreadyHave: number;
  bequestDefinitely: number;
  bequestConsider: number;
  priorityTop: number;
  priorityNearTop: number;
  priorityOneOfMany: number;
  meetingYes: number;
}

export interface SocialProofResult {
  org: ProofOrg;
  ohpCase: OHPCase | null;
  angle: string;
  intensity: "name_drop" | "single_stat" | "mini_story";
  formattedProof: string;
  matchReason: string;
}

// ── Data Loading ───────────────────────────────────────────────────────────

let proofPool: ProofOrg[] = [];
let ohpCases: OHPCase[] = [];

function loadData() {
  const dataDir = path.resolve(__dirname, "../../../../data");
  try {
    proofPool = JSON.parse(fs.readFileSync(path.join(dataDir, "proof-pool.json"), "utf8"));
    const rawOHP = JSON.parse(fs.readFileSync(path.join(dataDir, "ohp-case-studies.json"), "utf8"));
    ohpCases = rawOHP.filter((c: OHPCase) => c.stories > 0 || c.interviews > 0 || c.newDonors > 0 || c.bequestAlreadyHave > 0);
  } catch {
    // Data files not yet available — social proof will return empty
  }
}

// Load on startup, reload every 10 minutes
loadData();
setInterval(loadData, 10 * 60 * 1000);

// ── Org Type Classification ────────────────────────────────────────────────

const militaryKw = ["vfw", "legion", "military", "veteran", "armed forces", "army", "navy", "air force", "marine", "coast guard", "enlisted", "sergeants", "cadets", "flying cross", "uniformed services", "naus", "trea", "cpoa", "dav ", "amvets", "purple heart"];
const fraternityKw = ["fraternity", "sorority", "kappa", "alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "lambda", "sigma", "tau", "phi", "chi", "psi", "omega", "acacia", "masonic", "elks", "knights of"];
const assocKw = ["association", "society", "nesa", "peace corps", "alumni assoc", "rotary", "kiwanis", "chamber", "council", "foundation", "league", "order of"];
const highSchoolKw = ["high school", "prep school", "preparatory", "academy", "latin school", "day school"];

export function classifyOrgType(name: string): string {
  const lower = name.toLowerCase();
  if (militaryKw.some(k => lower.includes(k))) return "military_veteran";
  if (fraternityKw.some(k => lower.includes(k))) return "fraternity_sorority";
  if (highSchoolKw.some(k => lower.includes(k))) return "high_school";
  if (assocKw.some(k => lower.includes(k))) return "association";
  if (/universit|college|institut|school of|law\b|medicine\b|dental|pharmacy|medical/i.test(lower)) return "university_college";
  return "university_college"; // default for unknown
}

// ── Region Detection ───────────────────────────────────────────────────────

const stateRegions: Record<string, string> = {
  alabama: "SE", alaska: "W", arizona: "SW", arkansas: "SE", california: "W", colorado: "W",
  connecticut: "NE", delaware: "NE", florida: "SE", georgia: "SE", hawaii: "W", idaho: "W",
  illinois: "MW", indiana: "MW", iowa: "MW", kansas: "MW", kentucky: "SE", louisiana: "SE",
  maine: "NE", maryland: "NE", massachusetts: "NE", michigan: "MW", minnesota: "MW",
  mississippi: "SE", missouri: "MW", montana: "W", nebraska: "MW", nevada: "W",
  "new hampshire": "NE", "new jersey": "NE", "new mexico": "SW", "new york": "NE",
  "north carolina": "SE", "north dakota": "MW", ohio: "MW", oklahoma: "SW", oregon: "W",
  pennsylvania: "NE", "rhode island": "NE", "south carolina": "SE", "south dakota": "MW",
  tennessee: "SE", texas: "SW", utah: "W", vermont: "NE", virginia: "SE", washington: "W",
  "west virginia": "SE", wisconsin: "MW", wyoming: "W",
};

export function detectRegion(name: string): string {
  const lower = name.toLowerCase();
  for (const [state, region] of Object.entries(stateRegions)) {
    if (lower.includes(state)) return region;
  }
  return "UNK";
}

// ── Size Tier Detection ────────────────────────────────────────────────────

export function detectSizeTier(name: string): string {
  // Heuristic based on org type — can be overridden if alumni count known
  const type = classifyOrgType(name);
  if (type === "high_school") return "small";
  if (type === "fraternity_sorority") return "mid";
  if (type === "military_veteran") return "mid";
  if (type === "association") return "mid";
  return "mid"; // default for universities
}

// ── Proof Selection ────────────────────────────────────────────────────────

interface ProofRequest {
  company: string;
  orgType?: string;
  sizeTier?: string;
  region?: string;
  dealStage?: string;
  excludeOrgs?: string[];   // previously used org IDs
  excludeAngles?: string[]; // previously used angles
  count?: number;
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

function formatProofPoint(org: ProofOrg, angle: string, intensity: "name_drop" | "single_stat" | "mini_story"): string {
  const cleanName = org.name.replace(/ \d{4}$/, "").replace(/ OHP$/, "");

  if (intensity === "name_drop") {
    switch (angle) {
      case "participation": return `similar to what ${cleanName} saw with their alumni base`;
      case "data_enrichment": return `similar to the data refresh ${cleanName} experienced`;
      case "stories": return `like the storytelling results ${cleanName} achieved`;
      case "mem_don": return `similar to the donor discovery ${cleanName} experienced`;
      default: return `similar to results at ${cleanName}`;
    }
  }

  if (intensity === "single_stat") {
    switch (angle) {
      case "participation":
        return `${cleanName} saw a ${org.responseRate}% response rate with ${fmt(org.respondents)} alumni participating`;
      case "data_enrichment": {
        const parts: string[] = [];
        if (org.emailsAdded > 100) parts.push(`${fmt(org.emailsAdded)} new emails`);
        if (org.employersAdded > 100) parts.push(`${fmt(org.employersAdded)} employer names`);
        if (org.jobTitlesAdded > 100) parts.push(`${fmt(org.jobTitlesAdded)} job titles`);
        return `${cleanName} picked up ${parts.slice(0, 2).join(" and ")} they did not have before`;
      }
      case "stories":
        return `${cleanName} collected ${fmt(org.stories)} alumni stories`;
      case "mem_don":
        return `${cleanName} generated ${fmt(org.memDonOrders)} new membership and donor orders`;
      default:
        return `${cleanName} saw a ${org.responseRate}% response rate`;
    }
  }

  // mini_story — 2-3 sentences
  switch (angle) {
    case "participation":
      return `${cleanName} had ${fmt(org.respondents)} alumni participate at a ${org.responseRate}% response rate. For an organization your size, that level of engagement translates into real, actionable data your team can use immediately.`;
    case "data_enrichment": {
      const parts: string[] = [];
      if (org.emailsAdded > 100) parts.push(`${fmt(org.emailsAdded)} new emails`);
      if (org.employersAdded > 100) parts.push(`${fmt(org.employersAdded)} employer names`);
      if (org.jobTitlesAdded > 100) parts.push(`${fmt(org.jobTitlesAdded)} job titles`);
      if (org.phonesAdded > 100) parts.push(`${fmt(org.phonesAdded)} phone numbers`);
      return `${cleanName} picked up ${parts.slice(0, 3).join(", ")} their team did not have. That kind of data refresh changes how your advancement team operates day to day.`;
    }
    case "stories":
      return `${cleanName} collected ${fmt(org.stories)} alumni stories. That is content their marketing team would have spent months producing, and their alumni were eager to share.`;
    case "mem_don":
      return `${cleanName} generated ${fmt(org.memDonOrders)} new membership and donor orders through a project with us. These were people who were not giving before and now they are.`;
    default:
      return `${cleanName} saw a ${org.responseRate}% response rate with ${fmt(org.respondents)} alumni participating.`;
  }
}

function getMatchReason(org: ProofOrg, targetType: string, targetSize: string, targetRegion: string): string {
  const parts: string[] = [];
  if (org.orgType === targetType) parts.push("same org type");
  if (org.sizeTier === targetSize) parts.push("similar size");
  if (org.region === targetRegion && targetRegion !== "UNK") parts.push("same region");
  if (org.proofTier === "A") parts.push("top-tier results");
  return parts.join(", ") || "strong overall results";
}

function pickIntensity(dealStage?: string): "name_drop" | "single_stat" | "mini_story" {
  switch (dealStage) {
    case "discovery": return "name_drop";
    case "cold_outreach": return "single_stat";
    case "proposal": return "mini_story";
    case "negotiation": return "single_stat";
    case "re_engagement": return "single_stat";
    default: return "single_stat";
  }
}

function findOHPMatch(orgType: string): OHPCase | null {
  const categoryMap: Record<string, string> = {
    university_college: "private_university",
    high_school: "public_university",
    fraternity_sorority: "greek",
    association: "public_university",
    military_veteran: "public_university",
  };
  const cats = [categoryMap[orgType], "public_university", "private_university"].filter(Boolean);
  const matches = ohpCases.filter(c => cats.includes(c.category));
  if (matches.length === 0) return null;
  return matches[Math.floor(Math.random() * matches.length)];
}

export function selectSocialProof(req: ProofRequest): SocialProofResult | null {
  if (proofPool.length === 0) return null;

  const targetType = req.orgType || classifyOrgType(req.company);
  const targetSize = req.sizeTier || detectSizeTier(req.company);
  const targetRegion = req.region || detectRegion(req.company);
  const excludeIds = new Set(req.excludeOrgs || []);
  const excludeAngleSet = new Set(req.excludeAngles || []);

  // Filter to usable orgs: same type, A/B tier, not excluded, not the prospect itself
  const companyLower = req.company.toLowerCase();
  let pool = proofPool.filter(p =>
    p.orgType === targetType &&
    (p.proofTier === "A" || p.proofTier === "B") &&
    !excludeIds.has(p.id) &&
    !p.name.toLowerCase().includes(companyLower) &&
    !companyLower.includes(p.name.toLowerCase().replace(/ \d{4}$/, ""))
  );

  if (pool.length === 0) {
    // Fallback: any type in A/B tier
    pool = proofPool.filter(p =>
      (p.proofTier === "A" || p.proofTier === "B") &&
      !excludeIds.has(p.id)
    );
  }

  if (pool.length === 0) return null;

  // Prefer same region + similar size
  const sizeOrder = ["small", "mid", "large", "xlarge"];
  const targetIdx = sizeOrder.indexOf(targetSize);
  const nearSizes = [targetSize];
  if (targetIdx > 0) nearSizes.push(sizeOrder[targetIdx - 1]);
  if (targetIdx < 3) nearSizes.push(sizeOrder[targetIdx + 1]);

  let regionSizePool = pool.filter(p => p.region === targetRegion && nearSizes.includes(p.sizeTier));
  let regionPool = pool.filter(p => p.region === targetRegion);
  let sizePool = pool.filter(p => nearSizes.includes(p.sizeTier));

  // Use best available pool
  const finalPool = regionSizePool.length >= 3 ? regionSizePool :
    regionPool.length >= 3 ? regionPool :
    sizePool.length >= 3 ? sizePool : pool;

  // Pick angle not already used
  const availableAngles = ["participation", "data_enrichment", "stories", "mem_don"]
    .filter(a => !excludeAngleSet.has(a));
  const preferredAngle = availableAngles.length > 0 ? availableAngles[0] : "participation";

  // Find best org for this angle
  const withAngle = finalPool.filter(p => p.angles.includes(preferredAngle));
  const candidates = withAngle.length > 0 ? withAngle : finalPool;

  // Shuffle top candidates to avoid always picking #1
  const topN = candidates.slice(0, Math.min(10, candidates.length));
  const pick = topN[Math.floor(Math.random() * topN.length)];

  const intensity = pickIntensity(req.dealStage);
  const angle = pick.angles.includes(preferredAngle) ? preferredAngle : pick.angles[0] || "participation";
  const ohpCase = pick.hasOHP ? findOHPMatch(targetType) : null;

  return {
    org: pick,
    ohpCase,
    angle,
    intensity,
    formattedProof: formatProofPoint(pick, angle, intensity),
    matchReason: getMatchReason(pick, targetType, targetSize, targetRegion),
  };
}

// ── Data-Backed Objection Handles ──────────────────────────────────────────

export function getObjectionHandlesContext(company: string): string {
  if (proofPool.length === 0) return "";

  const targetType = classifyOrgType(company);
  const pool = proofPool.filter(p =>
    p.orgType === targetType &&
    (p.proofTier === "A" || p.proofTier === "B")
  );

  if (pool.length < 3) return "";

  // Pick diverse examples for different objection types
  const highParticipation = pool.filter(p => p.angles.includes("participation")).sort((a, b) => b.responseRate - a.responseRate)[0];
  const highBio = pool.filter(p => p.angles.includes("data_enrichment")).sort((a, b) => (b.emailsAdded + b.employersAdded) - (a.emailsAdded + a.employersAdded))[0];
  const highMemDon = pool.filter(p => p.angles.includes("mem_don")).sort((a, b) => b.memDonOrders - a.memDonOrders)[0];

  // Find OHP case with planned giving data
  const ohpWithPG = ohpCases.filter(c => c.bequestAlreadyHave > 0 && c.newDonors > 0);
  const pgCase = ohpWithPG.length > 0 ? ohpWithPG[Math.floor(Math.random() * ohpWithPG.length)] : null;

  let context = `\nDATA-BACKED OBJECTION RESPONSES (use these real results when handling objections — cite at most one per objection):`;

  if (highParticipation) {
    const clean = highParticipation.name.replace(/ \d{4}$/, "");
    context += `\n- "We tried alumni outreach and got low engagement" -> ${clean} saw a ${highParticipation.responseRate}% response rate with ${fmt(highParticipation.respondents)} people participating.`;
  }
  if (highBio) {
    const clean = highBio.name.replace(/ \d{4}$/, "");
    const total = highBio.emailsAdded + highBio.employersAdded + highBio.jobTitlesAdded;
    context += `\n- "Our data is already pretty current" -> ${clean} thought the same thing, then picked up ${fmt(total)} data points they did not have.`;
  }
  if (highMemDon) {
    const clean = highMemDon.name.replace(/ \d{4}$/, "");
    context += `\n- "We are not sure about the ROI" -> ${clean} generated ${fmt(highMemDon.memDonOrders)} new membership and donor orders.`;
  }
  if (pgCase) {
    context += `\n- "We already have a planned giving program" -> ${pgCase.name} found ${fmt(pgCase.bequestAlreadyHave)} alumni who already had them in their estate that nobody on the advancement team knew about. Plus ${fmt(pgCase.bequestConsider + pgCase.bequestDefinitely)} more who are open to it.`;
  }

  return context;
}

// ── Prompt Context Builder ─────────────────────────────────────────────────

export function getSocialProofContext(company: string, dealStage?: string): { context: string; proofUsed: SocialProofResult | null } {
  if (!company || proofPool.length === 0) return { context: "", proofUsed: null };

  const proof = selectSocialProof({ company, dealStage });
  if (!proof) return { context: "", proofUsed: null };

  let context = `\nSOCIAL PROOF (use subtly if it fits naturally — do not force it, do not put it in the opening sentence, and skip it entirely if the email is stronger without it):`;
  context += `\n${proof.formattedProof}`;

  if (proof.ohpCase) {
    const c = proof.ohpCase;
    if (c.newDonors > 0) context += `\nAdditional: ${c.name} identified ${fmt(c.newDonors)} new donors.`;
    if (c.bequestAlreadyHave > 0) context += ` ${fmt(c.bequestAlreadyHave)} alumni already had them in their estate plans.`;
    if (c.meetingYes > 0) context += ` ${fmt(c.meetingYes)} alumni said yes to a leadership meeting.`;
  }

  context += `\n\nRULES FOR USING THIS PROOF:`;
  context += `\n- Use at most ONE reference. A brief mention is stronger than a case study.`;
  context += `\n- Never put the proof in the opening sentence.`;
  context += `\n- Never cite more than two numbers from a single org.`;
  context += `\n- If you use it, weave it in naturally as if mentioning a recent conversation.`;
  context += `\n- Sometimes the best email has no social proof at all. Use your judgment.`;

  return { context, proofUsed: proof };
}
