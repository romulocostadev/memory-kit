// Builds dist/memory-kit.mcpb: copies extension/ to a staging folder, installs its production dependencies there,
// validates the manifest and packs it with the mcpb CLI.
import { cpSync, rmSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STAGE = join(ROOT, "dist", "extension");
const MCPB = join(ROOT, "node_modules", "@anthropic-ai", "mcpb", "dist", "cli", "cli.js");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

rmSync(STAGE, { recursive: true, force: true });
mkdirSync(dirname(STAGE), { recursive: true });
cpSync(join(ROOT, "extension"), STAGE, { recursive: true, filter: (src) => !src.includes("node_modules") });
cpSync(join(ROOT, "LICENSE"), join(STAGE, "LICENSE"));
execFileSync(npm, ["install", "--omit=dev", "--no-audit", "--no-fund"], { cwd: STAGE, stdio: "inherit" });
execFileSync(process.execPath, [MCPB, "validate", join(STAGE, "manifest.json")], { stdio: "inherit" });
execFileSync(process.execPath, [MCPB, "pack", STAGE, join(ROOT, "dist", "memory-kit.mcpb")], { stdio: "inherit" });
