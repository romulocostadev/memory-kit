import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS = join(ROOT, "skills");
const NAMES = ["memory-ingest", "memory-propose", "memory-ask", "memory-review"];

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, "SKILL.md starts with YAML frontmatter");
  return Object.fromEntries(m[1].split("\n").filter((l) => l.includes(":")).map((l) => {
    const i = l.indexOf(":");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  }));
}

test("the four skills exist with matching names and short descriptions", () => {
  const found = readdirSync(SKILLS).filter((d) => d.startsWith("memory-")).sort();
  assert.deepEqual(found, [...NAMES].sort());
  for (const name of NAMES) {
    const fm = frontmatter(readFileSync(join(SKILLS, name, "SKILL.md"), "utf8"));
    assert.equal(fm.name, name);
    assert.ok(fm.description && fm.description.length < 1024, `${name} description under 1024 chars`);
  }
});

test("no skill file deletes memory, holds a key or names the company account", () => {
  const files = [...NAMES.map((n) => join(SKILLS, n, "SKILL.md")), ...readdirSync(join(SKILLS, "common")).map((f) => join(SKILLS, "common", f))];
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    for (const bad of ["memory_delete_page", "aim_", "romulocostatemsaude"]) {
      assert.ok(!text.includes(bad) || (bad === "memory_delete_page" && /never call `memory_delete_page`/i.test(text)),
        `${f} must not contain ${bad}`);
    }
  }
});

test("every skill says to answer in the person's language and never to delete", () => {
  for (const name of NAMES) {
    const text = readFileSync(join(SKILLS, name, "SKILL.md"), "utf8");
    assert.match(text, /person's language/);
    assert.match(text, /never call `memory_delete_page`/i);
  }
});

test("build zips each skill with its common files at the root", () => {
  execFileSync(process.execPath, [join(ROOT, "scripts", "build-skills.mjs")], { cwd: ROOT });
  for (const name of NAMES) {
    const zip = join(ROOT, "dist", "skills", `${name}.zip`);
    assert.ok(existsSync(zip), `${zip} exists`);
    const entries = new AdmZip(zip).getEntries().map((e) => e.entryName).sort();
    for (const want of ["SKILL.md", "types.md", "reference.md"]) {
      assert.ok(entries.includes(`${name}/${want}`), `${name}.zip has ${name}/${want} (got ${entries})`);
    }
  }
});

test("the review queue query is wide enough and matches every draft body", () => {
  const review = readFileSync(join(SKILLS, "memory-review", "SKILL.md"), "utf8");
  assert.match(review, /limit: 100/);
  assert.match(review, /`Proposed`/);
  assert.match(review, /approver\.md/);
  assert.match(review, /-approver/);
  const types = readFileSync(join(SKILLS, "common", "types.md"), "utf8");
  assert.match(types, /^Proposed by: /m);
});

test("the shared rules allow scopes for multi-unit search instead of contradicting memory-ask", () => {
  const ref = readFileSync(join(SKILLS, "common", "reference.md"), "utf8");
  assert.match(ref, /`scopes`/);
  assert.match(ref, /never both/i);
});
