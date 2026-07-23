import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");
const projectRoot = process.cwd();
const migrationPath = path.join(projectRoot, "prisma/migrations/20260723000000_initial/migration.sql");
const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "vplc-migration-"));
const generatedPath = path.join(temporaryDirectory, "generated.sql");
const environment = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://schema:check@127.0.0.1:5432/vplc?schema=public",
};

try {
  execFileSync(process.execPath, [prismaCli, "validate"], { cwd: projectRoot, env: environment, stdio: "inherit" });
  execFileSync(process.execPath, [
    prismaCli,
    "migrate",
    "diff",
    "--from-empty",
    "--to-schema-datamodel",
    "prisma/schema.prisma",
    "--script",
    "--output",
    generatedPath,
  ], { cwd: projectRoot, env: environment, stdio: "inherit" });

  const committed = normalizeSql(readFileSync(migrationPath, "utf8"));
  const generated = normalizeSql(readFileSync(generatedPath, "utf8"));
  if (committed !== generated) {
    throw new Error("The committed initial migration does not match prisma/schema.prisma.");
  }
  process.stdout.write("Migration verification passed: schema and committed SQL match.\n");
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

function normalizeSql(sql: string) {
  return sql.replace(/\r\n/g, "\n").trim();
}
