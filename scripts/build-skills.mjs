// Builds dist/skills/<name>.zip for each skill: <name>/SKILL.md plus the shared files of skills/common/,
// the folder layout Claude Desktop and claude.ai expect when a skill is uploaded.
import { readdirSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS = join(ROOT, "skills");
const OUT = join(ROOT, "dist", "skills");
const COMMON = join(SKILLS, "common");

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const name of readdirSync(SKILLS).filter((d) => d.startsWith("memory-"))) {
  const zip = new AdmZip();
  for (const file of readdirSync(join(SKILLS, name))) {
    zip.addFile(`${name}/${file}`, readFileSync(join(SKILLS, name, file)));
  }
  for (const file of readdirSync(COMMON)) {
    zip.addFile(`${name}/${file}`, readFileSync(join(COMMON, file)));
  }
  zip.writeZip(join(OUT, `${name}.zip`));
  console.log(`dist/skills/${name}.zip`);
}

// The capture hooks, for installers run outside a checkout (they download hooks.zip from the release).
const hooks = new AdmZip();
hooks.addLocalFolder(join(ROOT, "hooks"), "hooks");
hooks.writeZip(join(ROOT, "dist", "hooks.zip"));
console.log("dist/hooks.zip");
