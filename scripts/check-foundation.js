const fs = require("fs");
const requiredFiles = [
  "README.md",
  ".gitignore",
  ".env.example",
  "docs/SETUP.md",
  "docs/IMPLEMENTATION_ORDER.md",
  "docs/PROJECT_SPECIFICATION.md",
  "docs/AI_WORKING_RULES.md",
  "tasks/01-project-foundation.md",
];
const missing = requiredFiles.filter((path) => !fs.existsSync(path));
if (missing.length) {
  console.error("Missing required foundation files:", missing.join(", "));
  process.exit(1);
}
const gitignore = fs.readFileSync(".gitignore", "utf8");
if (!gitignore.split(/\r?\n/).includes(".env")) {
  console.error(".gitignore must exclude .env");
  process.exit(1);
}
const envExample = fs.readFileSync(".env.example", "utf8");
if (!envExample.includes("DATABASE_URL=")) {
  console.error(".env.example must document DATABASE_URL");
  process.exit(1);
}
console.log("SentinelX foundation checks passed.");
