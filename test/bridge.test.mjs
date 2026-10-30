import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { startBridge } from "../extension/server/bridge.js";
import { startFakeMcp } from "./helpers/fake-mcp.mjs";
import { makeInvite, TEST_KEY, REFERENCE } from "./helpers/invite.mjs";

let fake;
before(async () => { fake = await startFakeMcp({ key: TEST_KEY }); });
after(async () => { await fake?.close(); });

async function connect(invite) {
  const [clientSide, bridgeSide] = InMemoryTransport.createLinkedPair();
  await startBridge({ invite, transport: bridgeSide });
  const client = new Client({ name: "test", version: "0" });
  await client.connect(clientSide);
  return client;
}

test("lists the remote tools plus memory_kit_whoami", async () => {
  const client = await connect(makeInvite({ server: fake.url }));
  const names = (await client.listTools()).tools.map((t) => t.name).sort();
  assert.deepEqual(names, ["memory_kit_whoami", "memory_query"]);
});

test("memory_kit_whoami returns the invite's reference", async () => {
  const client = await connect(makeInvite({ server: fake.url }));
  const result = await client.callTool({ name: "memory_kit_whoami", arguments: {} });
  assert.equal(result.content[0].text, REFERENCE);
});

test("remote calls carry the bearer key and come back unchanged", async () => {
  const client = await connect(makeInvite({ server: fake.url }));
  const before = fake.seen.calls.length;
  const result = await client.callTool({ name: "memory_query", arguments: { query: "contrato" } });
  assert.equal(JSON.parse(result.content[0].text).echo, "contrato");
  assert.equal(fake.seen.calls.length, before + 1);
});

test("a wrong key fails each call clearly instead of crashing", async () => {
  const client = await connect(makeInvite({ server: fake.url, key: "aim_wrong" }));
  const result = await client.callTool({ name: "memory_query", arguments: { query: "x" } });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, new RegExp(fake.url.replace(/[.:/]/g, "\\$&")));
  assert.ok(!result.content[0].text.includes("aim_wrong"), "the key never appears in errors");
});

test("a server that is down gives an error naming it, and the bridge keeps working", async () => {
  const down = await startFakeMcp({ key: TEST_KEY });
  const url = down.url;
  const client = await connect(makeInvite({ server: url }));
  await client.listTools();
  await down.close();
  const result = await client.callTool({ name: "memory_query", arguments: { query: "x" } });
  assert.equal(result.isError, true);
  assert.ok(result.content[0].text.includes(url));
  const whoami = await client.callTool({ name: "memory_kit_whoami", arguments: {} });
  assert.equal(whoami.content[0].text, REFERENCE);
});

test("the extension entry point serves over stdio with the invite from the environment", async () => {
  const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");
  const { fileURLToPath } = await import("node:url");
  const entry = fileURLToPath(new URL("../extension/server/index.js", import.meta.url));
  const transport = new StdioClientTransport({ command: process.execPath, args: [entry],
    env: { ...process.env, MEMORY_KIT_INVITE: makeInvite({ server: fake.url }) }, stderr: "pipe" });
  const client = new Client({ name: "test", version: "0" });
  await client.connect(transport);
  const names = (await client.listTools()).tools.map((t) => t.name);
  assert.ok(names.includes("memory_kit_whoami") && names.includes("memory_query"));
  await client.close();
});

test("a bad invite stops the entry point with a message that does not echo it", async () => {
  const { spawnSync } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");
  const entry = fileURLToPath(new URL("../extension/server/index.js", import.meta.url));
  const run = spawnSync(process.execPath, [entry], { env: { ...process.env, MEMORY_KIT_INVITE: "aimkit1.secret-ish" }, encoding: "utf8" });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /invite is not valid/);
  assert.ok(!run.stderr.includes("secret-ish"));
});

test("tools that were missing because the server was down appear once it comes back (list_changed)", async () => {
  const { ToolListChangedNotificationSchema } = await import("@modelcontextprotocol/sdk/types.js");
  const probe = await startFakeMcp({ key: TEST_KEY });
  const port = probe.port, url = probe.url;
  await probe.close();
  const [clientSide, bridgeSide] = InMemoryTransport.createLinkedPair();
  await startBridge({ invite: makeInvite({ server: url }), transport: bridgeSide, retryMs: 100 });
  const client = new Client({ name: "test", version: "0" });
  let changed = false;
  client.setNotificationHandler(ToolListChangedNotificationSchema, () => { changed = true; });
  await client.connect(clientSide);
  assert.deepEqual((await client.listTools()).tools.map((t) => t.name), ["memory_kit_whoami"]);
  const back = await startFakeMcp({ key: TEST_KEY, port });
  try {
    for (let i = 0; i < 50 && !changed; i++) await new Promise((r) => setTimeout(r, 100));
    assert.ok(changed, "the bridge announced a changed tool list");
    assert.ok((await client.listTools()).tools.some((t) => t.name === "memory_query"));
  } finally { await back.close(); }
});
