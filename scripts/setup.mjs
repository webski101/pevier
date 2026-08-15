import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const databasePath = new URL("../prisma/dev.db", import.meta.url);
const envPath = new URL("../.env", import.meta.url);
const envExamplePath = new URL("../.env.example", import.meta.url);
const databaseExisted = existsSync(databasePath);
const productionSchemaPath = new URL("../prisma/schema.prisma", import.meta.url);
const localSchemaPath = new URL("../prisma/schema.local.prisma", import.meta.url);

if (!existsSync(envPath)) copyFileSync(envExamplePath, envPath);
const localSchema = readFileSync(productionSchemaPath, "utf8").replace('provider = "postgresql"', 'provider = "sqlite"');
writeFileSync(localSchemaPath, localSchema);

const prisma = process.execPath;
const run = (args) => {
  const result = spawnSync(prisma, ["node_modules/prisma/build/index.js", ...args], { cwd: new URL("..", import.meta.url), stdio: "inherit", shell: false });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run(["generate", "--schema", "prisma/schema.local.prisma"]);
run(["db", "push", "--skip-generate", "--schema", "prisma/schema.local.prisma"]);
if (!databaseExisted || process.argv.includes("--seed")) run(["db", "seed"]);
