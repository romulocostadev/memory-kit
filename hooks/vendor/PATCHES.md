# Local changes to the vendored ai-memory hooks

- `_lib.sh`: the capture POST timeout was a fixed `--max-time 0.2`, tuned for a server on the same machine. It is now
  `--max-time "${AI_MEMORY_HOOK_POST_TIMEOUT:-0.2}"` (same default), so `run.sh` can give a server across the internet
  (Tailscale Funnel) 1.5 s. The PowerShell bundle already uses 3 s and is unchanged.
