#!/bin/sh
# Claude Code hook entry for the Memory Kit: run.sh <workspace> <event>, payload on stdin.
# Captures ONLY inside a folder whose .ai-memory.toml names <workspace> (searched from the payload's cwd upward), so
# sessions in personal or other companies' projects never reach this company's server. Then runs ai-memory's own hook
# script with the kit's server URL; the key is read by curl from a 600 header file, never from argv.
ws="${1:-}"
event="${2:-}"
case "$ws" in ''|*[!a-z0-9._-]*) cat >/dev/null; exit 0 ;; esac
case "$event" in ''|*[!a-z-]*) cat >/dev/null; exit 0 ;; esac
hooks=$(cd "$(dirname "$0")" && pwd)
kit=$(dirname "$hooks")
script="$hooks/vendor/claude-code/$event.sh"
[ -f "$script" ] && [ -f "$kit/$ws.server" ] || { cat >/dev/null; exit 0; }

. "$hooks/vendor/_lib.sh"
payload=$(cat)
dir=$(ai_memory_extract_cwd "$payload")
[ -n "$dir" ] || dir=$(pwd)
marked=""
while [ -n "$dir" ]; do
  if [ -f "$dir/.ai-memory.toml" ] && grep -Eq "^[[:space:]]*workspace[[:space:]]*=[[:space:]]*[\"']$ws[\"']" "$dir/.ai-memory.toml"; then
    marked=1
    break
  fi
  parent=$(dirname "$dir")
  [ "$parent" = "$dir" ] && break
  dir="$parent"
done
[ -n "$marked" ] || exit 0

AI_MEMORY_HOOK_URL=$(cat "$kit/$ws.server")
AI_MEMORY_DATA_DIR="$kit/$ws-hooks"
AI_MEMORY_HOOK_POST_TIMEOUT=1.5
export AI_MEMORY_HOOK_URL AI_MEMORY_DATA_DIR AI_MEMORY_HOOK_POST_TIMEOUT
printf '%s' "$payload" | sh "$script"
