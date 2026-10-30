# Claude Code hook entry for the Memory Kit on Windows: run.ps1 <workspace> <event>, payload on stdin.
# Captures ONLY inside a folder whose .ai-memory.toml names <workspace> (searched from the payload's cwd upward), so
# sessions in personal or other companies' projects never reach this company's server. Then runs ai-memory's own hook
# in this same process (no second PowerShell per event); the key goes through an environment variable of this
# process, never through argv.
param([string]$Workspace, [string]$Event)
$ErrorActionPreference = 'SilentlyContinue'
if ($Workspace -notmatch '^[a-z0-9][a-z0-9._-]*$' -or $Event -notmatch '^[a-z-]+$') { exit 0 }
$kit = Split-Path $PSScriptRoot -Parent
$vendor = Join-Path $PSScriptRoot 'vendor'
$script = Join-Path $vendor "claude-code\$Event.ps1"
$serverFile = Join-Path $kit "$Workspace.server"
$keyFile = Join-Path $kit "$Workspace.key"
if (-not (Test-Path -LiteralPath $script) -or -not (Test-Path -LiteralPath $serverFile)) { exit 0 }

$KitPayload = ''
if ([Console]::IsInputRedirected) {
  $reader = New-Object System.IO.StreamReader([Console]::OpenStandardInput(), (New-Object System.Text.UTF8Encoding $false))
  $KitPayload = $reader.ReadToEnd()
}
$dir = $null
try { $dir = ($KitPayload | ConvertFrom-Json).cwd } catch { }
if (-not $dir) { $dir = (Get-Location).Path }
$pattern = '^\s*workspace\s*=\s*["'']' + [regex]::Escape($Workspace) + '["'']'
$marked = $false
while ($dir) {
  $marker = Join-Path $dir '.ai-memory.toml'
  if ((Test-Path -LiteralPath $marker) -and (Select-String -LiteralPath $marker -Pattern $pattern -Quiet)) { $marked = $true; break }
  $parent = Split-Path $dir -Parent
  if (-not $parent -or $parent -eq $dir) { break }
  $dir = $parent
}
if (-not $marked) { exit 0 }

$env:AI_MEMORY_HOOK_URL = ([IO.File]::ReadAllText($serverFile)).Trim()
$env:AI_MEMORY_AUTH_TOKEN = ([IO.File]::ReadAllText($keyFile)).Trim()
$env:AI_MEMORY_DATA_DIR = Join-Path $kit "$Workspace-hooks"
. (Join-Path $vendor 'lib\ai-memory-hook.ps1')
# The payload was already read above (to find the cwd); hand it to ai-memory's hook instead of stdin.
function Read-AiMemoryStdin { return $script:KitPayload }
$call = Get-Content -LiteralPath $script | Where-Object { $_ -like 'Invoke-AiMemoryHook *' } | Select-Object -First 1
if ($call) { Invoke-Expression $call }
exit 0
