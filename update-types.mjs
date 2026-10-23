import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { config } from "dotenv";

// Reads DATABASE_URL from .env. Docker has to be running: the CLI
// generates types by starting a postgres-meta container.
config();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is missing from .env");
  process.exit(1);
}

const outPath = "src/lib/types/database.types.ts";
const child = spawn(
  process.execPath,
  [
    "node_modules/supabase/dist/supabase.js",
    "gen",
    "types",
    "typescript",
    "--db-url",
    url,
    "--schema",
    "public",
  ],
  { stdio: ["ignore", "pipe", "inherit"] },
);

const chunks = [];
child.stdout.on("data", (chunk) => chunks.push(chunk));
child.on("close", (code) => {
  if (code !== 0) process.exit(code ?? 1);
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.includes("export type Database")) {
    console.error("supabase gen types did not return a Database type");
    process.exit(1);
  }
  writeFileSync(outPath, text);
  console.log(`wrote ${outPath}`);
});
