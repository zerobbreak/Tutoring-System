import fs from "node:fs";
import path from "node:path";

const dir = path.join("supabase", "migrations");
const baselineName = "20260513000000_baseline_schema.sql";
const out = path.join(dir, baselineName);

const args = new Set(process.argv.slice(2));
const repairOnly = args.has("--repair-only");

const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".sql") && f !== baselineName)
  .sort();

let versionsForRepair = files.map((f) => f.split("_")[0]);
if (repairOnly && files.length === 0) {
  const versionsPath = path.join("scripts", "squash-migration-versions.json");
  if (!fs.existsSync(versionsPath)) {
    console.error("Missing scripts/squash-migration-versions.json");
    process.exit(1);
  }
  versionsForRepair = JSON.parse(fs.readFileSync(versionsPath, "utf8"));
}

if (!repairOnly) {
  if (files.length === 0) {
    console.error("Nothing to squash. Add incremental migrations or use --repair-only.");
    process.exit(1);
  }
  const header = [
    "-- Squashed baseline: incremental migrations merged for fresh installs.",
    "-- Existing remotes: run `pnpm run db:migration:squash-repair` once after pull.",
    "",
  ].join("\n");

  let body = "";
  for (const f of files) {
    body += `\n-- ========== ${f} ==========\n\n`;
    body += fs.readFileSync(path.join(dir, f), "utf8").replace(/\r\n/g, "\n");
    if (!body.endsWith("\n")) body += "\n";
  }

  fs.writeFileSync(out, header + body);
  console.log(`Wrote ${out} from ${files.length} files (${header.length + body.length} chars)`);
} else {
  console.log("Skipping baseline write (--repair-only).");
}

if (!repairOnly) {
  fs.writeFileSync(
    path.join("scripts", "squash-migration-versions.json"),
    JSON.stringify(versionsForRepair, null, 2),
  );
}
const repairPath = path.join("scripts", "squash-migration-repair.cmd");
const revertedArgs = versionsForRepair.join(" ");
fs.writeFileSync(
  repairPath,
  [
    "@echo off",
    "REM Run once on linked remote after squash (DB schema unchanged).",
    `pnpm exec supabase migration repair --status reverted ${revertedArgs}`,
    "pnpm exec supabase migration repair --status applied 20260513000000",
    "",
  ].join("\r\n"),
);
console.log(`Wrote ${repairPath}`);
