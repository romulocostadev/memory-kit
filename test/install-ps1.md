# Manual check: install.ps1 on Windows

Run on a Windows machine with Windows PowerShell 5.1, against a reachable instance, never on the real profile.
Last run: 2026-10-30 on the Windows test PC against a test instance (LAN), all checks passed.

1. Make a throwaway profile with an accented, spaced name, and copy the kit there:
   `C:\Temp\mk-test\João da Silva` and `C:\Temp\mk-test\kit\{install,skills}`.
2. Write a test invite to `C:\Temp\mk-test\invite.txt` without printing the key (generate it inside the PC).
3. Seed `C:\Temp\mk-test\João da Silva\.claude.json` (UTF-8, no BOM) with another MCP server, `numStartups`, a
   `projects` entry with an empty array and a string with accents.
4. Run (from a script saved as UTF-8 **with BOM**, or the accented path is garbled by PS 5.1):
   `powershell -NoProfile -ExecutionPolicy Bypass -File C:\Temp\mk-test\kit\install\install.ps1 -InviteFile C:\Temp\mk-test\invite.txt -ProfileDir 'C:\Temp\mk-test\João da Silva'`
5. Expect:
   - output ends with `ready: <user> on <workspace>`, exit 0;
   - `.claude\memory-kit\` holds `me.md`, `<ws>.key`, `<ws>.server`; the key's ACL lists only the current user, not inherited;
   - `.claude\skills\memory-{ask,ingest,propose,review}\` each hold `SKILL.md`, `types.md`, `reference.md`;
   - `.claude.json` keeps the other server, `numStartups`, the array and the accents (no BOM), and has one `<ws>-memory` entry;
   - a second run leaves one entry; a garbled invite file exits 1 with `invite is not valid` and no echo.
6. Delete `C:\Temp\mk-test` (it holds a key).

## Capture hooks (Task 6)

Last run: 2026-10-30 on the Windows test PC against a test instance (LAN): passed.

7. Seed `.claude\settings.json` with an unrelated hook (`Stop` → `echo done`) and a `model` key, install twice. Expect
   one kit hook per event (SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PreCompact, Stop, SessionEnd), the
   unrelated hook and `model` kept.
8. Make `<profile>\tem\business.client-a\.ai-memory.toml` with `workspace = "acme"`, then pipe a UserPromptSubmit
   payload (with that `cwd` and a new `session_id`) into
   `powershell -NoProfile -ExecutionPolicy Bypass -File <profile>\.claude\memory-kit\hooks\run.ps1 acme user-prompt-submit`.
   **Set `$OutputEncoding = New-Object Text.UTF8Encoding $false` first**: Claude Code sends UTF-8, but PS 5.1 pipes
   ASCII by default and an accented `cwd` arrives as `?`, so no marker is found (nothing is sent, by design).
   Expect the session to exist on the server (`memory_read_session_observations` as that user).
9. The same payload with a `cwd` outside any marked folder: nothing reaches the server, no spool files.
