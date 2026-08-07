import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

/**
 * Ensures committed migrations reproduce the current Prisma schema (no drift).
 * Uses DATABASE_URL as the Prisma shadow database (safe on empty CI Postgres).
 */
const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");
const projectRoot = process.cwd();
const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://schema:check@127.0.0.1:5432/vp_nest?schema=public";
const environment = {
  ...process.env,
  DATABASE_URL: databaseUrl,
};

try {
  execFileSync(process.execPath, [prismaCli, "validate"], {
    cwd: projectRoot,
    env: environment,
    stdio: "inherit",
  });

  execFileSync(
    process.execPath,
    [
      prismaCli,
      "migrate",
      "diff",
      "--from-migrations",
      "prisma/migrations",
      "--to-schema-datamodel",
      "prisma/schema.prisma",
      "--shadow-database-url",
      databaseUrl,
      "--exit-code",
    ],
    { cwd: projectRoot, env: environment, stdio: "inherit" },
  );

  process.stdout.write("Migration verification passed: migrations match prisma/schema.prisma.\n");
} catch (error) {
  const message = error instanceof Error ? error.message : "Migration verification failed.";
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
