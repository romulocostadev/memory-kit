// Builds an invite in the same format `instance invite` prints (aimkit1. + unpadded base64url of the JSON).
export const TEST_KEY = "aim_TestKey0123456789abcdefghijklmnopqrstuv";
export const REFERENCE = "# Acme: Test Business\n\nWorkspace: acme\nUser: test-business\nRole: business\n\n## Writes\n\n- `business.client-a`: Client A (business, client; parent none; linked: none)\n";

export function makeInvite({ server, key = TEST_KEY, user = "test-business", workspace = "acme", reference = REFERENCE }) {
  const json = JSON.stringify({ v: 1, server, workspace, user, key, reference });
  return "aimkit1." + Buffer.from(json, "utf8").toString("base64url");
}
