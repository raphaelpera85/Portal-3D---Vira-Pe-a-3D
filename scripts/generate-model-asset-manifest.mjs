import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = readdirSync(path.join(root, "models"), { withFileTypes: true })
  .filter((entry) => entry.isFile() && /^([a-z0-9]+-?)*[a-z0-9]+\.3mf$/.test(entry.name))
  .map((entry) => `models/${entry.name}`)
  .sort();

writeFileSync(path.join(root, "src/lib/git-model-assets.json"), `${JSON.stringify(files, null, 2)}\n`);
