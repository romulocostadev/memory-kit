import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeInvite } from "../extension/server/invite.js";
import { makeInvite, TEST_KEY, REFERENCE } from "./helpers/invite.mjs";

const SERVER = "https://memory.example.ts.net";

test("round trip", () => {
  const data = decodeInvite(makeInvite({ server: SERVER }));
  assert.deepEqual(data, { v: 1, server: SERVER, workspace: "acme", user: "test-business", key: TEST_KEY, reference: REFERENCE });
});

test("tolerates paste noise: spaces, line breaks, quotes", () => {
  const text = makeInvite({ server: SERVER });
  assert.equal(decodeInvite(`  "${text.slice(0, 20)}\r\n${text.slice(20)}"\n`).user, "test-business");
});

test("rejects garbage without echoing it", () => {
  assert.throws(() => decodeInvite("aimkit1.@@@"), (err) => err.message === "invite is not valid" && !err.message.includes("@@@"));
  assert.throws(() => decodeInvite(""), /invite is not valid/);
  const missingKey = "aimkit1." + Buffer.from(JSON.stringify({ v: 1, server: SERVER, workspace: "w", user: "u", reference: "r" })).toString("base64url");
  assert.throws(() => decodeInvite(missingKey), /invite is not valid/);
});

test("decodes an invite printed by `instance invite` (Python, same format)", () => {
  // Produced by instance.invite.encode_invite("https://h.ts.net", "acme", "u", "aim_K", "# R\n"):
  const fromPython = "aimkit1." + Buffer.from('{"v":1,"server":"https://h.ts.net","workspace":"acme","user":"u","key":"aim_K","reference":"# R\\n"}').toString("base64url");
  assert.equal(decodeInvite(fromPython).reference, "# R\n");
});
