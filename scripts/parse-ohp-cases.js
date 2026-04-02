/**
 * Parse OHP case studies from project-case-studies.csv into structured JSON.
 * Called by refresh-social-proof.sh
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.resolve(__dirname, "../data");
const lines = fs.readFileSync(path.join(DATA_DIR, "project-case-studies.csv"), "utf8").split("\n");

const cases = [];
let current = null;
let currentCategory = "";

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].replace(/^"|"$/g, "").trim();

  if (line === "Public Universities" || line === "PUBLIC UNIVERSITIES") { currentCategory = "public_university"; continue; }
  if (line === "Private Universities" || line === "PRIVATE UNIVERSITIES") { currentCategory = "private_university"; continue; }
  if (line === "HBCU") { currentCategory = "hbcu"; continue; }
  if (line === "Greek" || line === "GREEK") { currentCategory = "greek"; continue; }

  if (/^[A-Z]/.test(line) && (line.includes("OHP") || line.includes("Directory")) && !line.includes(":") && line.length > 5) {
    if (current) cases.push(current);
    current = {
      name: line.replace(/ OHP.*$| Directory.*$/, "").replace(/\(Final\)/, "").trim(),
      category: currentCategory,
      stories: 0, newDonors: 0, interviews: 0, cellPhones: 0, emails: 0, jobTitles: 0, dataUpdates: 0,
      bequestAlreadyHave: 0, bequestDefinitely: 0, bequestConsider: 0,
      priorityTop: 0, priorityNearTop: 0, priorityOneOfMany: 0,
      meetingYes: 0, respondents: 0,
    };
    continue;
  }

  if (!current) continue;

  const num = s => parseInt(s.replace(/,/g, "")) || 0;

  if (/stories captured|alumni stories|captured stories/i.test(line)) {
    const m = line.match(/([\d,]+)/); if (m) current.stories = num(m[1]);
  }
  if (/interviews|alumni interviews/i.test(line)) {
    const m = line.match(/([\d,]+)/); if (m) current.interviews = num(m[1]);
  }
  if (/new (annual fund )?donors/i.test(line)) {
    const m = line.match(/([\d,]+)/); if (m) current.newDonors = num(m[1]);
  }
  if (/new member/i.test(line)) {
    const m = line.match(/([\d,]+)/); if (m) current.newDonors += num(m[1]);
  }
  if (/respondents/i.test(line) && !line.includes("Deceased")) {
    const m = line.match(/([\d,]+)/); if (m) current.respondents = num(m[1]);
  }
  if (/cell phone/i.test(line)) {
    const m = line.match(/([\d,]+)/); if (m) current.cellPhones = num(m[1]);
  }
  if (/email/i.test(line) && /[\d,]+/.test(line) && !/bounce/i.test(line)) {
    const m = line.match(/([\d,]+)/); if (m) current.emails = num(m[1]);
  }
  if (/job title/i.test(line)) {
    const m = line.match(/([\d,]+)/); if (m) current.jobTitles = num(m[1]);
  }
  if (/I already have/i.test(line)) {
    const m = line.match(/([\d,]+)/); if (m) current.bequestAlreadyHave = num(m[1]);
  }
  if (/I (would )?definitely (plan|consider)/i.test(line)) {
    const m = line.match(/([\d,]+)/); if (m) current.bequestDefinitely = num(m[1]);
  }
  if (/I (would |might )?consider in the future/i.test(line)) {
    const m = line.match(/([\d,]+)/); if (m) current.bequestConsider = num(m[1]);
  }
  if (/top of my list/i.test(line)) {
    const m = line.match(/([\d,]+)/); if (m) current.priorityTop = num(m[1]);
  }
  if (/near the top/i.test(line)) {
    const m = line.match(/([\d,]+)/); if (m) current.priorityNearTop = num(m[1]);
  }
  if (/one of many/i.test(line)) {
    const m = line.match(/([\d,]+)/); if (m) current.priorityOneOfMany = num(m[1]);
  }
  if (/^Yes:/i.test(line)) {
    const m = line.match(/([\d,]+)/); if (m) current.meetingYes = Math.max(current.meetingYes, num(m[1]));
  }
}
if (current) cases.push(current);

// Filter to cases with actual data
const usable = cases.filter(c => c.stories > 0 || c.interviews > 0 || c.newDonors > 0 || c.bequestAlreadyHave > 0);

fs.writeFileSync(path.join(DATA_DIR, "ohp-case-studies.json"), JSON.stringify(usable, null, 2));
console.log("  Parsed " + usable.length + " OHP case studies");
