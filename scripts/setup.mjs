import { copyFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const databasePath = new URL("../prisma/dev.db", import.meta.url);
const envPath = new URL("../.env", import.meta.url);
const envExamplePath = new URL("../.env.example", import.meta.url);
const databaseExisted = existsSync(databasePath);

if (!existsSync(envPath)) copyFileSync(envExamplePath, envPath);

const prisma = process.execPath;
const run = (args) => {
  const result = spawnSync(prisma, ["node_modules/prisma/build/index.js", ...args], { cwd: new URL("..", import.meta.url), stdio: "inherit", shell: false });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run(["generate"]);
run(["db", "push", "--skip-generate"]);
if (!databaseExisted || process.argv.includes("--seed")) run(["db", "seed"]);
