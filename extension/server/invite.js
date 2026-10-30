// The private invite printed by `instance invite`: "aimkit1." + unpadded base64url of UTF-8 JSON
// {"v":1,"server","workspace","user","key","reference"}. Paste noise (spaces, line breaks, quotes) is tolerated,
// and errors never echo the invite: it holds the person's key.
const PREFIX = "aimkit1.";
const FIELDS = ["server", "workspace", "user", "key", "reference"];

export function decodeInvite(text) {
  const cleaned = String(text ?? "").replace(/\s+/g, "").replace(/^["']+|["']+$/g, "");
  let data;
  try {
    if (!cleaned.startsWith(PREFIX)) throw new Error();
    const body = cleaned.slice(PREFIX.length);
    if (!/^[A-Za-z0-9_-]+$/.test(body)) throw new Error();
    data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    throw new Error("invite is not valid");
  }
  if (data?.v !== 1 || !FIELDS.every((f) => typeof data[f] === "string" && data[f])) {
    throw new Error("invite is not valid");
  }
  return data;
}
