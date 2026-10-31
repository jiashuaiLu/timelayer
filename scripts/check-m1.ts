/* M1 acceptance: 100 addresses, >90% resolved, zero door-level data escapes. */
import { resolveAddress, resolvedBlockSchema } from "../src/pipeline/resolve";
import { allBlocks } from "../src/data/blocks";

const STREETS_A = [
  "44th Drive",
  "23rd Street",
  "Skillman Avenue",
  "Queens Boulevard",
  "39th Avenue",
  "45th Avenue",
  "39th Place",
];
const STREETS_B = [
  "Crosby Street",
  "Prince Street",
  "Spring Street",
  "Lafayette Street",
  "Broadway",
  "Houston Street",
  "Mercer Street",
];

const TYPOS: [string, string][] = [
  ["crosbi street", "crosby-soho"],
  ["sunnysidde gardens", "sunnyside-44dr"],
  ["laffayette street", "crosby-soho"],
  ["queens bouleverd", "sunnyside-44dr"],
  ["skillmann avenue", "sunnyside-44dr"],
  ["sohoo", "crosby-soho"],
  ["pring street", "crosby-soho"],
  ["23rd steet", "sunnyside-44dr"],
  ["44th driv", "sunnyside-44dr"],
  ["crosby streeet", "crosby-soho"],
  ["sunny side gardens", "sunnyside-44dr"],
  ["broadwayy", "crosby-soho"],
];

const UNRESOLVABLE = [
  "",
  "   ",
  "asdfghjkl",
  "10 Downing Street, London",
  "1600 Pennsylvania Ave NW, Washington",
  "unknown place",
  "qwerty",
  "品川区 大井町",
];

function buildCases(): { input: string; expect: string | null }[] {
  const cases: { input: string; expect: string | null }[] = [];
  let n = 0;
  for (let i = 0; i < 74; i += 1) {
    const street = STREETS_A[i % STREETS_A.length];
    const house = `${10 + (i % 47)}-${String(10 + (i % 60)).padStart(2, "0")}`;
    const borough = i % 3 === 0 ? "Queens" : i % 3 === 1 ? "Sunnyside, Queens" : "NY 11101";
    cases.push({ input: `${house} ${street}, ${borough}`, expect: "sunnyside-44dr" });
    n += 1;
  }
  for (let i = 0; i < 34; i += 1) {
    const street = STREETS_B[i % STREETS_B.length];
    const house = `${40 + (i % 90)} ${street}`;
    const suffix = i % 2 === 0 ? ", SoHo, New York" : ", Manhattan 10012";
    cases.push({ input: `${house}${suffix}`, expect: "crosby-soho" });
  }
  for (const [input, expect] of TYPOS) cases.push({ input, expect });
  for (const input of UNRESOLVABLE) cases.push({ input, expect: null });
  return cases;
}

const cases = buildCases();
let ok = 0;
let softFail = 0;
const failures: string[] = [];

for (const c of cases) {
  const r = resolveAddress(c.input, new Date("2026-10-31T09:00:00Z"));
  resolvedBlockSchema.parse(r);
  const json = JSON.stringify(r);
  if (/"house|houseNumber|streetAddress|postcode|postal"/i.test(json)) {
    failures.push(`privacy leak in output for "${c.input}"`);
  }
  if (r.radiusM < 500) failures.push(`radius below 500m for "${c.input}"`);
  if (r.precision !== "neighborhood") failures.push(`precision wrong for "${c.input}"`);

  if (c.expect === null) {
    // graceful degradation, not a success
    if (r.matchedOn !== "fallback") softFail += 1;
    continue;
  }
  if (r.slug === c.expect) ok += 1;
  else failures.push(`"${c.input}" -> ${r.slug} (expected ${c.expect})`);
}

const scored = cases.filter((c) => c.expect !== null).length;
const rate = ok / scored;
console.log(`blocks: ${allBlocks().map((b) => b.slug).join(", ")}`);
console.log(`resolved: ${ok}/${scored} (${(rate * 100).toFixed(1)}%)`);
console.log(`fallback for unknowns: ${UNRESOLVABLE.length - softFail}/${UNRESOLVABLE.length}`);
if (failures.length) console.log(failures.join("\n"));
if (rate <= 0.9 || failures.length) {
  console.error("M1 FAILED");
  process.exit(1);
}
console.log("M1 OK — no door-level precision escapes, radius >= 500m");
