import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, statSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { startFakeMcp } from "./helpers/fake-mcp.mjs";
import { makeInvite, TEST_KEY, REFERENCE } from "./helpers/invite.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INSTALL = join(ROOT, "install", "install.sh");
const SKILLS = ["memory-ask", "memory-ingest", "memory-propose", "memory-review"];
const SECOND_KEY = "aim_SecondKey9876543210zyxwvutsrqponmlkjih";

let fake, fake2;
before(async () => {
  fake = await startFakeMcp({ key: TEST_KEY });
  fake2 = await startFakeMcp({ key: SECOND_KEY });
});
after(async () => { await fake?.close(); await fake2?.close(); });

function home(name = "home") {
  const dir = join(mkdtempSync(join(tmpdir(), "mk-")), name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, ".claude.json"), JSON.stringify({ numStartups: 3, mcpServers: { other: { type: "stdio", command: "x" } } }));
  return dir;
}

// Async on purpose: the fake server runs in this process, so a blocking spawn would starve it.
function install(homeDir, invite) {
  return new Promise((resolve) => {
    const child = spawn("sh", [INSTALL], { env: { ...process.env, HOME: homeDir, MEMORY_KIT_NO_CLIPBOARD: "1" } });
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    child.on("close", (status) => resolve({ status, stdout, stderr }));
    child.stdin.end(invite);
  });
}

function check(homeDir, { url, key }) {
  const kit = join(homeDir, ".claude", "memory-kit");
  assert.equal(readFileSync(join(kit, "me.md"), "utf8"), REFERENCE);
  const keyFile = join(kit, "acme.key");
  assert.equal(readFileSync(keyFile, "utf8").trim(), key);
  assert.equal(statSync(keyFile).mode & 0o777, 0o600);
  const cfg = JSON.parse(readFileSync(join(homeDir, ".claude.json"), "utf8"));
  assert.deepEqual(cfg.mcpServers.other, { type: "stdio", command: "x" });
  assert.equal(cfg.numStartups, 3);
  assert.deepEqual(cfg.mcpServers["acme-memory"], { type: "http", url: `${url}/mcp`, headers: { Authorization: `Bearer ${key}` } });
  assert.equal(Object.keys(cfg.mcpServers).filter((k) => k.startsWith("acme")).length, 1);
  for (const s of SKILLS) {
    for (const f of ["SKILL.md", "types.md", "reference.md"]) {
      assert.ok(existsSync(join(homeDir, ".claude", "skills", s, f)), `${s}/${f} installed`);
    }
  }
}

test("installs the key, reference, MCP entry and skills, and never prints the key", async () => {
  const h = home();
  const run = await install(h, makeInvite({ server: fake.url }));
  assert.equal(run.status, 0, run.stderr);
  check(h, { url: fake.url, key: TEST_KEY });
  assert.ok(!(run.stdout + run.stderr).includes(TEST_KEY));
  assert.match(run.stdout, /ready: test-business on acme/);
  assert.ok(fake.seen.calls.some((c) => c.tool === "memory_query"), "the final check queried the server");
});

test("a re-run with a new invite replaces everything and keeps one entry", async () => {
  const h = home();
  assert.equal((await install(h, makeInvite({ server: fake.url }))).status, 0);
  const run = await install(h, makeInvite({ server: fake2.url, key: SECOND_KEY }));
  assert.equal(run.status, 0, run.stderr);
  check(h, { url: fake2.url, key: SECOND_KEY });
});

test("a server that is down fails clearly, naming it", async () => {
  const down = await startFakeMcp({ key: TEST_KEY });
  await down.close();
  const run = await install(home(), makeInvite({ server: down.url }));
  assert.notEqual(run.status, 0);
  assert.ok((run.stdout + run.stderr).includes(down.url));
  assert.ok(!(run.stdout + run.stderr).includes(TEST_KEY));
});

test("a garbled invite is refused without echoing it", async () => {
  const run = await install(home(), "aimkit1.not-really-an-invite");
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /invite is not valid/);
  assert.ok(!run.stderr.includes("not-really-an-invite"));
});

test("a home path with spaces and accents works", async () => {
  const h = home("João da Silva");
  const run = await install(h, makeInvite({ server: fake.url }));
  assert.equal(run.status, 0, run.stderr);
  check(h, { url: fake.url, key: TEST_KEY });
});

test("the approver's invite registers <workspace>-approver only, with no hooks", async () => {
  const h = home();
  const run = await install(h, makeInvite({ server: fake.url, user: "approver", reference: "# Approver\n\nRole: approver\n" }));
  assert.equal(run.status, 0, run.stderr);
  const servers = JSON.parse(readFileSync(join(h, ".claude.json"), "utf8")).mcpServers;
  assert.ok(servers["acme-approver"] && !servers["acme-memory"]);
  assert.equal(readFileSync(join(h, ".claude", "memory-kit", "approver.md"), "utf8"), "# Approver\n\nRole: approver\n");
  assert.ok(!existsSync(join(h, ".claude", "settings.json")) || !JSON.stringify(settings(h)).includes("memory-kit/hooks/run"));
  assert.ok(existsSync(join(h, ".claude", "skills", "memory-review", "SKILL.md")));
});

test("installing the approver after a person keeps the person's setup untouched", async () => {
  const h = home();
  assert.equal((await install(h, makeInvite({ server: fake.url }))).status, 0);
  const kit = join(h, ".claude", "memory-kit");
  const before = { me: readFileSync(join(kit, "me.md"), "utf8"), key: readFileSync(join(kit, "acme.key"), "utf8"),
    header: readFileSync(join(kit, "acme-hooks", "auth-header"), "utf8"), settings: readFileSync(join(h, ".claude", "settings.json"), "utf8") };
  const run = await install(h, makeInvite({ server: fake2.url, key: SECOND_KEY, user: "approver", reference: "# Approver\n" }));
  assert.equal(run.status, 0, run.stderr);
  assert.equal(readFileSync(join(kit, "me.md"), "utf8"), before.me);
  assert.equal(readFileSync(join(kit, "acme.key"), "utf8"), before.key);
  assert.equal(readFileSync(join(kit, "acme-hooks", "auth-header"), "utf8"), before.header);
  assert.equal(readFileSync(join(h, ".claude", "settings.json"), "utf8"), before.settings);
  const servers = JSON.parse(readFileSync(join(h, ".claude.json"), "utf8")).mcpServers;
  assert.equal(servers["acme-memory"].headers.Authorization, `Bearer ${TEST_KEY}`);
  assert.equal(servers["acme-approver"].headers.Authorization, `Bearer ${SECOND_KEY}`);
  assert.equal(readFileSync(join(kit, "acme-approver.key"), "utf8").trim(), SECOND_KEY);
});

test("install.ps1 is pure ASCII (Windows PowerShell 5.1 reads BOM-less scripts as ANSI)", () => {
  const bytes = readFileSync(join(ROOT, "install", "install.ps1"));
  assert.ok(bytes.every((b) => b < 0x80), "no byte above 0x7F");
});

// ── capture hooks ──────────────────────────────────────────────────────

const EVENTS = { SessionStart: "session-start", UserPromptSubmit: "user-prompt-submit", PreToolUse: "pre-tool-use",
  PostToolUse: "post-tool-use", PreCompact: "pre-compact", Stop: "stop", SessionEnd: "session-end" };

function settings(homeDir) {
  return JSON.parse(readFileSync(join(homeDir, ".claude", "settings.json"), "utf8"));
}

function kitEntries(cfg, event) {
  return (cfg.hooks?.[event] ?? []).flatMap((g) => g.hooks).filter((h) => h.command.includes("memory-kit/hooks/run"));
}

test("install adds one kit hook per event and keeps unrelated hooks, also on a re-run", async () => {
  const h = home();
  mkdirSync(join(h, ".claude"), { recursive: true });
  writeFileSync(join(h, ".claude", "settings.json"), JSON.stringify({ model: "opus",
    hooks: { Stop: [{ matcher: "", hooks: [{ type: "command", command: "say done" }] }] } }));
  for (let i = 0; i < 2; i++) assert.equal((await install(h, makeInvite({ server: fake.url }))).status, 0);
  const cfg = settings(h);
  assert.equal(cfg.model, "opus");
  assert.ok(cfg.hooks.Stop.flatMap((g) => g.hooks).some((x) => x.command === "say done"));
  for (const [event, script] of Object.entries(EVENTS)) {
    const mine = kitEntries(cfg, event);
    assert.equal(mine.length, 1, `${event} has one kit hook`);
    assert.match(mine[0].command, new RegExp(`run\\.sh" acme ${script}$`));
  }
  const header = join(h, ".claude", "memory-kit", "acme-hooks", "auth-header");
  assert.equal(readFileSync(header, "utf8").trim(), `Authorization: Bearer ${TEST_KEY}`);
  assert.equal(statSync(header).mode & 0o777, 0o600);
});

function runHook(homeDir, cwd, event, payload) {
  return new Promise((resolve) => {
    const script = join(homeDir, ".claude", "memory-kit", "hooks", "run.sh");
    const child = spawn("sh", [script, "acme", event], { cwd, env: { ...process.env, HOME: homeDir } });
    let out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.on("close", (status) => resolve({ status, out }));
    child.stdin.end(payload);
  });
}

test("a hook inside a folder marked for the workspace posts the event with the bearer header", async () => {
  const h = home("João da Silva");
  assert.equal((await install(h, makeInvite({ server: fake.url }))).status, 0);
  const repo = join(h, "tem", "business.client-a");
  mkdirSync(join(repo, "sub"), { recursive: true });
  writeFileSync(join(repo, ".ai-memory.toml"), 'workspace = "acme"\nproject = "business.client-a"\n');
  const before = fake.seen.hooks.length, unauthorized = fake.seen.unauthorized;
  const payload = JSON.stringify({ session_id: "11111111-2222-3333-4444-555555555555", cwd: join(repo, "sub"), hook_event_name: "UserPromptSubmit", prompt: "oi" });
  const run = await runHook(h, join(repo, "sub"), "user-prompt-submit", payload);
  assert.equal(run.status, 0);
  const got = fake.seen.hooks.slice(before);
  assert.equal(got.length, 1, "one POST");
  assert.equal(got[0].event, "user-prompt");
  assert.equal(got[0].query.workspace, "acme");
  assert.equal(got[0].query.project, "business.client-a");
  assert.equal(fake.seen.unauthorized, unauthorized, "carried the key");
});

test("a hook outside any marked folder sends nothing", async () => {
  const h = home();
  assert.equal((await install(h, makeInvite({ server: fake.url }))).status, 0);
  const elsewhere = join(h, "personal-project");
  mkdirSync(elsewhere, { recursive: true });
  writeFileSync(join(elsewhere, ".ai-memory.toml"), 'workspace = "another-company"\nproject = "x"\n');
  const before = fake.seen.hooks.length;
  const payload = JSON.stringify({ session_id: "s", cwd: elsewhere, hook_event_name: "UserPromptSubmit", prompt: "private" });
  const run = await runHook(h, elsewhere, "user-prompt-submit", payload);
  assert.equal(run.status, 0);
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(fake.seen.hooks.length, before);
});

test("when the payload's cwd does not exist, nothing is sent (ai-memory would route it from that cwd)", async () => {
  const h = home();
  assert.equal((await install(h, makeInvite({ server: fake.url }))).status, 0);
  const repo = join(h, "tem", "business.client-a");
  mkdirSync(repo, { recursive: true });
  writeFileSync(join(repo, ".ai-memory.toml"), 'workspace = "acme"\nproject = "business.client-a"\n');
  const before = fake.seen.hooks.length;
  const payload = JSON.stringify({ session_id: "s2", cwd: join(h, "garbled-J?o"), hook_event_name: "UserPromptSubmit", prompt: "oi" });
  const run = await runHook(h, repo, "user-prompt-submit", payload);
  assert.equal(run.status, 0);
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(fake.seen.hooks.length, before);
});
