/**
 * Rebuild org-classifications.json and proof-pool.json from project-results.csv
 * Called by refresh-social-proof.sh
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.resolve(__dirname, "../data");

// ── CSV Parser ─────────────────────────────────────────────────────────────

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || (c === "\r" && text[i + 1] === "\n")) {
        row.push(field); field = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = []; if (c === "\r") i++;
      } else { field += c; }
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// ── Classification ─────────────────────────────────────────────────────────

const militaryKw = ["vfw","legion","military","veteran","armed forces","army","navy","air force","marine","coast guard","enlisted","sergeants","cadets","flying cross","uniformed services","naus","trea","cpoa","dav ","amvets","purple heart"];
const fraternityKw = ["fraternity","sorority","kappa","alpha","beta","gamma","delta","epsilon","zeta","eta","theta","iota","lambda","sigma","tau","phi","chi","psi","omega","acacia","masonic","elks","knights of"];
const assocKw = ["association","society","nesa","peace corps","alumni assoc","rotary","kiwanis","chamber","council","foundation","league","order of"];
const highSchoolKw = ["high school","prep school","preparatory","academy","latin school","day school"];
const seminaryKw = ["seminary","bible institute","theological","divinity"];

function classifyOrg(name) {
  const lower = name.toLowerCase();
  if (militaryKw.some(k => lower.includes(k))) return "military_veteran";
  if (fraternityKw.some(k => lower.includes(k))) return "fraternity_sorority";
  if (highSchoolKw.some(k => lower.includes(k))) return "high_school";
  if (seminaryKw.some(k => lower.includes(k))) return "seminary_religious";
  if (assocKw.some(k => lower.includes(k))) return "association";
  if (/universit|college|institut|school of|law\b|medicine\b|dental|pharmacy|medical/i.test(lower)) return "university_college";
  return "other";
}

function getSizeTier(count) {
  if (!count || count <= 0) return "unknown";
  if (count < 10000) return "small";
  if (count < 50000) return "mid";
  if (count < 150000) return "large";
  return "xlarge";
}

// ── Region ─────────────────────────────────────────────────────────────────

// Load existing region classifications if available
let regionLookup = {};
try {
  const existing = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "org-classifications.json"), "utf8"));
  existing.forEach(o => { if (o.region && o.region !== "unknown" && o.region !== "UNK") regionLookup[o.id] = o.region; });
} catch { /* first run */ }

// Also merge batch files
for (let i = 1; i <= 4; i++) {
  try {
    const batch = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `regions-batch${i}.json`), "utf8"));
    Object.assign(regionLookup, batch);
  } catch { /* batch not available */ }
}

const stateRegions = {
  alabama:"SE",alaska:"W",arizona:"SW",arkansas:"SE",california:"W",colorado:"W",
  connecticut:"NE",delaware:"NE",florida:"SE",georgia:"SE",hawaii:"W",idaho:"W",
  illinois:"MW",indiana:"MW",iowa:"MW",kansas:"MW",kentucky:"SE",louisiana:"SE",
  maine:"NE",maryland:"NE",massachusetts:"NE",michigan:"MW",minnesota:"MW",
  mississippi:"SE",missouri:"MW",montana:"W",nebraska:"MW",nevada:"W",
  "new hampshire":"NE","new jersey":"NE","new mexico":"SW","new york":"NE",
  "north carolina":"SE","north dakota":"MW",ohio:"MW",oklahoma:"SW",oregon:"W",
  pennsylvania:"NE","rhode island":"NE","south carolina":"SE","south dakota":"MW",
  tennessee:"SE",texas:"SW",utah:"W",vermont:"NE",virginia:"SE",washington:"W",
  "west virginia":"SE",wisconsin:"MW",wyoming:"W"
};

function getRegion(id, name) {
  if (regionLookup[id]) return regionLookup[id];
  const lower = name.toLowerCase();
  for (const [state, region] of Object.entries(stateRegions)) {
    if (lower.includes(state)) return region;
  }
  return "UNK";
}

// ── Main ───────────────────────────────────────────────────────────────────

const csvData = fs.readFileSync(path.join(DATA_DIR, "project-results.csv"), "utf8");
const rows = parseCSV(csvData);
const header = rows[0];
const ci = {};
header.forEach((h, i) => ci[h.trim()] = i);

const orgs = [];
for (let i = 1; i < rows.length; i++) {
  const r = rows[i];
  if (!r[0] || !/^\d/.test(r[0])) continue;

  const id = r[0];
  const name = r[ci["SchoolName"]] || "";
  const alumniCount = parseFloat(r[ci["MKTGSummaryAlumniCount"]]) || 0;
  const respondents = parseFloat(r[ci["MKTGSummaryAlumniRespondentsCount"]]) || 0;
  const responseRate = parseFloat(r[ci["MKTGSummaryAlumniOriginalMarketableResponseRate"]]) || 0;
  const buyers = parseFloat(r[ci["MKTGSummaryBuyersCount"]]) || 0;
  const memDonOrders = parseFloat(r[ci["TotalPCIMemDonOrders"]]) || 0;
  const stories = parseFloat(r[ci["TotalStoriesCollected"]]) || 0;
  const storiesCompleted = parseFloat(r[ci["TotalStoriesCompleted"]]) || 0;
  const photos = parseFloat(r[ci["TotalPhotosSubmitted"]]) || 0;
  const isDonor = r[ci["IsDonorProject"]] === "TRUE";
  const isMember = r[ci["IsMemberProject"]] === "TRUE";
  const emailsAdded = (parseFloat(r[ci["NumberOfHomeEmailsAdded"]]) || 0) + (parseFloat(r[ci["NumberOfBusinessEmailsAdded"]]) || 0);
  const phonesAdded = (parseFloat(r[ci["NumberOfCellPhoneNumbersAdded"]]) || 0) + (parseFloat(r[ci["NumberOfHomePhoneNumbersAdded"]]) || 0);
  const employersAdded = parseFloat(r[ci["NumberOfEmployerNamesAdded"]]) || 0;
  const jobTitlesAdded = parseFloat(r[ci["NumberOfJobTitlesAdded"]]) || 0;

  orgs.push({
    id, name,
    orgType: classifyOrg(name),
    region: getRegion(id, name),
    sizeTier: getSizeTier(alumniCount),
    alumniCount, respondents, responseRate: Math.round(responseRate * 10) / 10,
    buyers, memDonOrders, stories, storiesCompleted, photos,
    emailsAdded, employersAdded, jobTitlesAdded, phonesAdded,
    isDonor, isMember,
  });
}

fs.writeFileSync(path.join(DATA_DIR, "org-classifications.json"), JSON.stringify(orgs, null, 2));
console.log("  Classified " + orgs.length + " organizations");

// ── Build Proof Pool ───────────────────────────────────────────────────────

const proofPool = [];
for (const o of orgs) {
  if (!o.responseRate || o.responseRate <= 0 || o.responseRate > 100 || !o.alumniCount || o.alumniCount <= 0) continue;

  const bioScore = o.emailsAdded + o.employersAdded + o.jobTitlesAdded + o.phonesAdded;
  const bioPerCapita = bioScore / o.alumniCount;

  const scores = {
    participation: Math.min(o.responseRate / 50, 1) * 30,
    dataEnrichment: (Math.min(bioScore / 20000, 1) * 12.5) + (Math.min(bioPerCapita / 0.5, 1) * 12.5),
    stories: (Math.min(o.stories / 5000, 1) * 7.5) + (Math.min(o.stories / o.alumniCount / 0.1, 1) * 7.5),
    memDon: (Math.min(o.memDonOrders / 50000, 1) * 7.5) + (Math.min(o.memDonOrders / o.alumniCount / 0.3, 1) * 7.5),
    sizeRelevance: o.alumniCount > 1000 ? 5 : 3,
    regionKnown: (o.region && o.region !== "UNK" && o.region !== "unknown") ? 5 : 0,
  };

  const totalScore = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) * 10) / 10;

  const angles = [];
  if (o.responseRate >= 20) angles.push("participation");
  if (bioScore >= 2000 || bioPerCapita >= 0.2) angles.push("data_enrichment");
  if (o.stories >= 300) angles.push("stories");
  if (o.memDonOrders >= 500) angles.push("mem_don");

  proofPool.push({
    ...o, totalScore, angles,
    hasOHP: false, // will be set by parse-ohp-cases.js
    proofTier: totalScore >= 55 ? "A" : totalScore >= 38 ? "B" : totalScore >= 25 ? "C" : "D",
  });
}

proofPool.sort((a, b) => b.totalScore - a.totalScore);
fs.writeFileSync(path.join(DATA_DIR, "proof-pool.json"), JSON.stringify(proofPool, null, 2));

const tiers = { A: 0, B: 0, C: 0, D: 0 };
proofPool.forEach(p => tiers[p.proofTier]++);
console.log("  Built proof pool: " + proofPool.length + " orgs (A:" + tiers.A + " B:" + tiers.B + " C:" + tiers.C + " D:" + tiers.D + ")");
