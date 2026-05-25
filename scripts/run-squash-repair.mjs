import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const versionsPath = path.join("scripts", "squash-migration-versions.json");
if (!fs.existsSync(versionsPath)) {
  console.error("Missing scripts/squash-migration-versions.json — run db:migrations:squash first.");
  process.exit(1);
}

const versions = JSON.parse(fs.readFileSync(versionsPath, "utf8"));
const exec = (args) => {
  const r = spawnSync("pnpm", ["exec", "supabase", "migration", "repair", ...args], {
    stdio: "inherit",
    shell: true,
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

console.log(`Reverting ${versions.length} incremental migration versions on linked remote…`);
exec(["--status", "reverted", ...versions]);
console.log("Marking baseline 20260513000000 as applied…");
exec(["--status", "applied", "20260513000000"]);
console.log("Done.");
