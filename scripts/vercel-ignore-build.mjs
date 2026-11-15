import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const buildDirectories = ["src/", "public/", "models/", "scripts/"];
const buildFiles = new Set(["package.json", "package-lock.json", "postcss.config.mjs", "tsconfig.json", "vercel.json", ".gitignore"]);

export function shouldBuildForChangedFiles(files) {
  return files.some((file) => {
    if (file.startsWith("src/") && (/(?:^|\/)(?:__tests__|fixtures)\//.test(file) || /\.(?:test|spec)\.[^/]+$/.test(file))) return false;
    if (file.startsWith("scripts/") && /\.(?:test|spec)\.[^/]+$/.test(file)) return false;
    return buildFiles.has(file) || buildDirectories.some((directory) => file.startsWith(directory));
  });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const base = process.env.VERCEL_GIT_PREVIOUS_SHA?.trim() || "HEAD^";
    const changedFiles = execFileSync("git", ["diff", "--name-only", base, "HEAD"], { encoding: "utf8" })
      .split(/\r?\n/).filter(Boolean);
    process.exitCode = shouldBuildForChangedFiles(changedFiles) ? 1 : 0;
  } catch {
    process.exitCode = 1;
  }
}
