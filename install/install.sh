#!/bin/sh
# Memory Kit installer for Claude Code on macOS and Linux.
# Usage: sh install.sh [--invite-file FILE]
# The invite is read from --invite-file, from stdin when it is not a terminal, from the clipboard when it holds one,
# or from a hidden prompt. It never goes on a command line. Needs python3 (macOS: xcode-select --install).
set -eu

KIT_REPO="romulocostadev/memory-kit"
invite_file=""
while [ $# -gt 0 ]; do
  case "$1" in
    --invite-file) invite_file="${2:?--invite-file needs a file}"; shift 2 ;;
    -h|--help) sed -n '2,5p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

command -v python3 >/dev/null 2>&1 || { echo "python3 is required (macOS: run 'xcode-select --install')" >&2; exit 1; }

here=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
umask 077

if [ -n "$invite_file" ]; then
  cat "$invite_file" > "$tmp/invite"
elif [ ! -t 0 ]; then
  cat > "$tmp/invite"
elif [ -z "${MEMORY_KIT_NO_CLIPBOARD:-}" ] && command -v pbpaste >/dev/null 2>&1 && pbpaste 2>/dev/null | grep -q 'aimkit1\.'; then
  pbpaste > "$tmp/invite"
  echo "Using the invite from the clipboard."
else
  printf 'Paste your invite and press Enter (it will not be shown): '
  stty -echo 2>/dev/null || true
  IFS= read -r line || true
  stty echo 2>/dev/null || true
  echo
  printf '%s' "$line" > "$tmp/invite"
fi

KIT_HERE="$here" KIT_REPO="$KIT_REPO" python3 - "$tmp/invite" <<'PY'
import base64, json, os, re, shutil, sys, tempfile, urllib.error, urllib.request, zipfile

SKILLS = ("memory-ask", "memory-ingest", "memory-propose", "memory-review")


def fail(msg):
    print(f"memory-kit: {msg}", file=sys.stderr)
    sys.exit(1)


def decode(text):
    cleaned = re.sub(r"\s+", "", text).strip("\"'")
    try:
        if not cleaned.startswith("aimkit1.") or not re.fullmatch(r"[A-Za-z0-9_-]+", cleaned[8:]):
            raise ValueError
        body = cleaned[8:]
        data = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)).decode("utf-8"))
        if data.get("v") != 1 or not all(isinstance(data.get(f), str) and data[f] for f in
                                         ("server", "workspace", "user", "key", "reference")):
            raise ValueError
    except Exception:
        fail("invite is not valid (copy it again, whole, from the message you received)")
    if not re.fullmatch(r"[a-z0-9][a-z0-9._-]*", data["workspace"]):
        fail("invite is not valid")
    return data


def write_private(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path))
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(text)
    os.chmod(tmp, 0o600)
    os.replace(tmp, path)


def merge_mcp(home, name, entry):
    path = os.path.join(home, ".claude.json")
    cfg = {}
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            raw = f.read()
        cfg = json.loads(raw) if raw.strip() else {}
        shutil.copy2(path, path + ".memory-kit.bak")
        os.chmod(path + ".memory-kit.bak", 0o600)
    servers = cfg.setdefault("mcpServers", {})
    servers.pop(name, None)       # replace only this entry: a person's and the approver's live side by side
    servers[name] = entry
    fd, tmp = tempfile.mkstemp(dir=home)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)
    os.chmod(tmp, 0o600)
    os.replace(tmp, path)


def skills_source(here, repo):
    local = os.path.join(here, "..", "skills")
    if all(os.path.isfile(os.path.join(local, s, "SKILL.md")) for s in SKILLS):
        return {s: [os.path.join(local, s, "SKILL.md"), *(os.path.join(local, "common", c)
                for c in os.listdir(os.path.join(local, "common")))] for s in SKILLS}
    out = tempfile.mkdtemp()
    found = {}
    for s in SKILLS:
        url = f"https://github.com/{repo}/releases/latest/download/{s}.zip"
        try:
            with urllib.request.urlopen(url, timeout=60) as r, open(os.path.join(out, s + ".zip"), "wb") as f:
                f.write(r.read())
        except OSError as exc:
            fail(f"could not download the skills from {url}: {exc}")
        with zipfile.ZipFile(os.path.join(out, s + ".zip")) as z:
            z.extractall(out)
        found[s] = [os.path.join(out, s, n) for n in os.listdir(os.path.join(out, s))]
    return found


def install_skills(home, source):
    for name, files in source.items():
        dest = os.path.join(home, ".claude", "skills", name)
        shutil.rmtree(dest, ignore_errors=True)
        os.makedirs(dest)
        for f in files:
            shutil.copy2(f, os.path.join(dest, os.path.basename(f)))


EVENTS = {"SessionStart": "session-start", "UserPromptSubmit": "user-prompt-submit", "PreToolUse": "pre-tool-use",
          "PostToolUse": "post-tool-use", "PreCompact": "pre-compact", "Stop": "stop", "SessionEnd": "session-end"}


def hooks_source(here, repo):
    local = os.path.join(here, "..", "hooks")
    if os.path.isfile(os.path.join(local, "run.sh")):
        return local
    out = tempfile.mkdtemp()
    url = f"https://github.com/{repo}/releases/latest/download/hooks.zip"
    try:
        with urllib.request.urlopen(url, timeout=60) as r, open(os.path.join(out, "hooks.zip"), "wb") as f:
            f.write(r.read())
    except OSError as exc:
        fail(f"could not download the capture hooks from {url}: {exc}")
    with zipfile.ZipFile(os.path.join(out, "hooks.zip")) as z:
        z.extractall(out)
    return os.path.join(out, "hooks")


def install_hooks(home, kit, ws, key, source):
    dest = os.path.join(kit, "hooks")
    shutil.rmtree(dest, ignore_errors=True)
    shutil.copytree(source, dest)
    data = os.path.join(kit, ws + "-hooks")
    os.makedirs(data, exist_ok=True)
    os.chmod(data, 0o700)
    write_private(os.path.join(data, "auth-header"), "Authorization: Bearer " + key + "\n")
    path = os.path.join(home, ".claude", "settings.json")
    cfg = {}
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            raw = f.read()
        cfg = json.loads(raw) if raw.strip() else {}
        shutil.copy2(path, path + ".memory-kit.bak")
    hooks = cfg.setdefault("hooks", {})
    run = os.path.join(dest, "run.sh")
    for event, script in EVENTS.items():
        groups = []
        for group in hooks.get(event, []):
            kept = [h for h in group.get("hooks", []) if "memory-kit/hooks/run" not in h.get("command", "")]
            if kept:
                groups.append({**group, "hooks": kept})
        groups.append({"matcher": "", "hooks": [{"type": "command", "command": f'sh "{run}" {ws} {script}'}]})
        hooks[event] = groups
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path))
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)
    os.replace(tmp, path)


def post(url, key, payload, session):
    headers = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream",
               "Authorization": "Bearer " + key}
    if session:
        headers["Mcp-Session-Id"] = session
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read().decode("utf-8", "replace")
        session = r.headers.get("Mcp-Session-Id") or session
        if "text/event-stream" in (r.headers.get("Content-Type") or ""):
            body = "\n".join(l[5:].strip() for l in body.splitlines() if l.startswith("data:"))
    return (json.loads(body) if body.strip() else None), session


def check(server, key):
    url = server + "/mcp"
    try:
        _, session = post(url, key, {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
            "protocolVersion": "2025-03-26", "capabilities": {},
            "clientInfo": {"name": "memory-kit-installer", "version": "0.1.0"}}}, None)
        post(url, key, {"jsonrpc": "2.0", "method": "notifications/initialized"}, session)
        result, _ = post(url, key, {"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {
            "name": "memory_query", "arguments": {"query": "unit", "global": True, "limit": 1}}}, session)
    except urllib.error.HTTPError as exc:
        reason = "the key was refused (ask for a new invite)" if exc.code in (401, 403) else f"HTTP {exc.code}"
        fail(f"installed, but the memory server {server} answered: {reason}")
    except (OSError, ValueError) as exc:
        fail(f"installed, but the memory server {server} did not answer: {str(exc).replace(key, '[key]')}")
    if not result or "error" in result or result.get("result", {}).get("isError"):
        fail(f"installed, but the memory server {server} refused the test search")


invite = decode(open(sys.argv[1], encoding="utf-8").read())
home = os.path.expanduser("~")
kit = os.path.join(home, ".claude", "memory-kit")
ws, server, key = invite["workspace"], invite["server"].rstrip("/"), invite["key"]
# The approver's invite is a second identity next to the person's: its own reference, key and MCP entry, and no
# capture hooks (sessions are captured as the person, never as the approver).
approver = invite["user"] == "approver"
name = f"{ws}-approver" if approver else f"{ws}-memory"
write_private(os.path.join(kit, "approver.md" if approver else "me.md"), invite["reference"])
write_private(os.path.join(kit, (ws + "-approver" if approver else ws) + ".key"), key + "\n")
write_private(os.path.join(kit, ws + ".server"), server + "\n")
merge_mcp(home, name, {"type": "http", "url": server + "/mcp", "headers": {"Authorization": "Bearer " + key}})
install_skills(home, skills_source(os.environ["KIT_HERE"], os.environ["KIT_REPO"]))
if not approver:
    install_hooks(home, kit, ws, key, hooks_source(os.environ["KIT_HERE"], os.environ["KIT_REPO"]))
check(server, key)
print(f"ready: {invite['user']} on {ws} ({name} in Claude Code; restart Claude Code to load it)")
if not approver:
    print(f"sessions are captured only inside folders whose .ai-memory.toml names workspace {ws}")
PY
