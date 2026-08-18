import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

/**
 * Ensures committed migrations reproduce the current Prisma schema (no drift).
 *
 * Prefer SHADOW_DATABASE_URL for `--from-migrations` (does not touch the app DB).
 * Otherwise compare the already-migrated DATABASE_URL to the schema (`--from-url`).
 */
const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");
const projectRoot = process.cwd();
const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://schema:check@127.0.0.1:5432/vp_nest?schema=public";
const shadowUrl = process.env.SHADOW_DATABASE_URL;
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

  if (shadowUrl) {
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
        shadowUrl,
        "--exit-code",
      ],
      { cwd: projectRoot, env: environment, stdio: "inherit" },
    );
    process.stdout.write(
      "Migration verification passed: migrations match prisma/schema.prisma (shadow).\n",
    );
  } else {
    execFileSync(
      process.execPath,
      [
        prismaCli,
        "migrate",
        "diff",
        "--from-url",
        databaseUrl,
        "--to-schema-datamodel",
        "prisma/schema.prisma",
        "--exit-code",
      ],
      { cwd: projectRoot, env: environment, stdio: "inherit" },
    );
    process.stdout.write(
      "Migration verification passed: applied database matches prisma/schema.prisma.\n",
    );
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "Migration verification failed.";
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
