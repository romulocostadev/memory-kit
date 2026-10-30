# Memory Kit installer for Claude Code on Windows (Windows PowerShell 5.1 or later, no admin rights).
# Usage: powershell -ExecutionPolicy Bypass -File install.ps1 [-InviteFile FILE]
# The invite is read from -InviteFile, from redirected input, from the clipboard when it holds one, or from a hidden
# prompt. It never goes on a command line.
param(
  [string]$InviteFile,
  [string]$ProfileDir = $env:USERPROFILE
)
$ErrorActionPreference = 'Stop'
$KitRepo = 'romulocostadev/memory-kit'
$Skills = @('memory-ask', 'memory-ingest', 'memory-propose', 'memory-review')
$Utf8 = New-Object System.Text.UTF8Encoding $false
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

function Fail([string]$Message) {
  [Console]::Error.WriteLine("memory-kit: $Message")
  exit 1
}

function Read-Invite {
  if ($InviteFile) { return [IO.File]::ReadAllText($InviteFile) }
  if ([Console]::IsInputRedirected) { return [Console]::In.ReadToEnd() }
  if (-not $env:MEMORY_KIT_NO_CLIPBOARD) {
    try { $clip = (Get-Clipboard -Raw) } catch { $clip = $null }
    if ($clip -and $clip.Contains('aimkit1.')) { Write-Host 'Using the invite from the clipboard.'; return $clip }
  }
  $secure = Read-Host -AsSecureString 'Paste your invite and press Enter (it will not be shown)'
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function ConvertFrom-Invite([string]$Text) {
  $cleaned = ($Text -replace '\s', '').Trim('"', "'")
  try {
    if (-not $cleaned.StartsWith('aimkit1.')) { throw 'prefix' }
    $body = $cleaned.Substring(8)
    if ($body -notmatch '^[A-Za-z0-9_-]+$') { throw 'alphabet' }
    $b64 = $body.Replace('-', '+').Replace('_', '/')
    $b64 += '=' * ((4 - $b64.Length % 4) % 4)
    $data = $Utf8.GetString([Convert]::FromBase64String($b64)) | ConvertFrom-Json
  } catch { Fail 'invite is not valid (copy it again, whole, from the message you received)' }
  foreach ($f in 'server', 'workspace', 'user', 'key', 'reference') {
    if (-not ($data.$f -is [string]) -or -not $data.$f) { Fail 'invite is not valid' }
  }
  if ($data.v -ne 1 -or $data.workspace -notmatch '^[a-z0-9][a-z0-9._-]*$') { Fail 'invite is not valid' }
  return $data
}

# Writes UTF-8 without BOM and leaves the file readable by the current user only.
function Write-Private([string]$Path, [string]$Text) {
  New-Item -ItemType Directory -Force -Path (Split-Path $Path) | Out-Null
  [IO.File]::WriteAllText($Path, $Text, $Utf8)
  $me = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  & icacls $Path /inheritance:r /grant:r "${me}:(F)" | Out-Null
  if ($LASTEXITCODE -ne 0) { Fail "could not restrict access to $Path" }
}

# Claude's JSON files are read with JavaScriptSerializer (Windows PowerShell 5.1): unlike ConvertFrom-Json it accepts
# keys that differ only in case (project paths like C:/x and c:/x) and leaves date strings alone. PowerShell 7 has no
# System.Web.Extensions, so it uses ConvertFrom-Json -AsHashtable, which handles both too.
$UseSerializer = $true
try { Add-Type -AssemblyName System.Web.Extensions } catch { $UseSerializer = $false }

# Returned with a leading comma: PowerShell would otherwise unroll a dictionary into its key/value pairs.
function New-Map { return ,([System.Collections.Generic.Dictionary[string,object]]::new()) }

function Read-JsonFile([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return (New-Map) }
  $raw = [IO.File]::ReadAllText($Path)
  if (-not $raw.Trim()) { return (New-Map) }
  try {
    if ($UseSerializer) {
      $js = New-Object System.Web.Script.Serialization.JavaScriptSerializer
      $js.MaxJsonLength = [int]::MaxValue
      $js.RecursionLimit = 1024
      $obj = $js.DeserializeObject($raw)
    } else {
      try { $obj = $raw | ConvertFrom-Json -AsHashtable -DateKind String } catch [System.Management.Automation.ParameterBindingException] { $obj = $raw | ConvertFrom-Json -AsHashtable }
    }
  } catch { Fail "could not read $Path (is it valid JSON?): $($_.Exception.Message)" }
  if (-not ($obj -is [System.Collections.IDictionary])) { Fail "$Path does not hold a JSON object" }
  return ,$obj
}

function ConvertTo-JsonText($Obj) {
  if ($UseSerializer) {
    $js = New-Object System.Web.Script.Serialization.JavaScriptSerializer
    $js.MaxJsonLength = [int]::MaxValue
    $js.RecursionLimit = 1024
    return $js.Serialize($Obj)
  }
  return ($Obj | ConvertTo-Json -Depth 100)
}

function Merge-Mcp($Cfg, [string]$Name, [string]$Url, [string]$Key) {
  $path = Join-Path $ProfileDir '.claude.json'
  if (Test-Path -LiteralPath $path) { Copy-Item -LiteralPath $path -Destination "$path.memory-kit.bak" -Force }
  if (-not $Cfg.ContainsKey('mcpServers') -or -not ($Cfg['mcpServers'] -is [System.Collections.IDictionary])) { $Cfg['mcpServers'] = (New-Map) }
  # Replace only this entry: a person's and the approver's live side by side.
  if ($Cfg['mcpServers'].ContainsKey($Name)) { [void]$Cfg['mcpServers'].Remove([string]$Name) }
  $headers = New-Map; $headers['Authorization'] = "Bearer $Key"
  $entry = New-Map; $entry['type'] = 'http'; $entry['url'] = $Url; $entry['headers'] = $headers
  $Cfg['mcpServers'][$Name] = $entry
  Write-Private $path (ConvertTo-JsonText $Cfg)
}

function Get-SkillFiles {
  $local = Join-Path $PSScriptRoot '..\skills'
  $files = @{}
  if (@($Skills | Where-Object { Test-Path -LiteralPath (Join-Path $local "$_\SKILL.md") }).Count -eq $Skills.Count) {
    $common = @(Get-ChildItem -LiteralPath (Join-Path $local 'common') -File | ForEach-Object { $_.FullName })
    foreach ($s in $Skills) { $files[$s] = @((Join-Path $local "$s\SKILL.md")) + $common }
    return $files
  }
  $out = Join-Path ([IO.Path]::GetTempPath()) ("memory-kit-" + [Guid]::NewGuid())
  New-Item -ItemType Directory -Path $out | Out-Null
  foreach ($s in $Skills) {
    $url = "https://github.com/$KitRepo/releases/latest/download/$s.zip"
    try { Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile (Join-Path $out "$s.zip") } catch { Fail "could not download the skills from ${url}: $($_.Exception.Message)" }
    Expand-Archive -LiteralPath (Join-Path $out "$s.zip") -DestinationPath $out -Force
    $files[$s] = @(Get-ChildItem -LiteralPath (Join-Path $out $s) -File | ForEach-Object { $_.FullName })
  }
  return $files
}

function Install-Skills($Files) {
  foreach ($s in $Files.Keys) {
    $dest = Join-Path $ProfileDir ".claude\skills\$s"
    if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    foreach ($f in $Files[$s]) { Copy-Item -LiteralPath $f -Destination $dest }
  }
}

$Events = [ordered]@{ SessionStart = 'session-start'; UserPromptSubmit = 'user-prompt-submit'; PreToolUse = 'pre-tool-use';
  PostToolUse = 'post-tool-use'; PreCompact = 'pre-compact'; Stop = 'stop'; SessionEnd = 'session-end' }

function Get-HooksSource {
  $local = Join-Path $PSScriptRoot '..\hooks'
  if (Test-Path -LiteralPath (Join-Path $local 'run.ps1')) { return (Resolve-Path -LiteralPath $local).Path }
  $out = Join-Path ([IO.Path]::GetTempPath()) ("memory-kit-" + [Guid]::NewGuid())
  New-Item -ItemType Directory -Path $out | Out-Null
  $url = "https://github.com/$KitRepo/releases/latest/download/hooks.zip"
  try { Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile (Join-Path $out 'hooks.zip') } catch { Fail "could not download the capture hooks from ${url}: $($_.Exception.Message)" }
  Expand-Archive -LiteralPath (Join-Path $out 'hooks.zip') -DestinationPath $out -Force
  return (Join-Path $out 'hooks')
}

# Copies the hooks into the kit and adds one kit hook per Claude Code event to settings.json, replacing earlier kit
# entries and keeping everything else.
function Install-Hooks($Cfg, [string]$Kit, [string]$Workspace, [string]$Source) {
  $dest = Join-Path $Kit 'hooks'
  if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Recurse -Force }
  Copy-Item -LiteralPath $Source -Destination $dest -Recurse
  New-Item -ItemType Directory -Force -Path (Join-Path $Kit "$Workspace-hooks") | Out-Null
  $path = Join-Path $ProfileDir '.claude\settings.json'
  if (Test-Path -LiteralPath $path) { Copy-Item -LiteralPath $path -Destination "$path.memory-kit.bak" -Force }
  if (-not $Cfg.ContainsKey('hooks') -or -not ($Cfg['hooks'] -is [System.Collections.IDictionary])) { $Cfg['hooks'] = (New-Map) }
  $run = Join-Path $dest 'run.ps1'
  foreach ($event in $Events.Keys) {
    $groups = New-Object System.Collections.ArrayList
    if ($Cfg['hooks'].ContainsKey([string]$event)) {
      foreach ($group in @($Cfg['hooks'][[string]$event])) {
        if (-not ($group -is [System.Collections.IDictionary])) { [void]$groups.Add($group); continue }
        $kept = New-Object System.Collections.ArrayList
        foreach ($h in @($group['hooks'])) {
          if (-not (($h -is [System.Collections.IDictionary]) -and "$($h['command'])".Contains('memory-kit\hooks\run'))) { [void]$kept.Add($h) }
        }
        if ($kept.Count -gt 0) { $group['hooks'] = $kept.ToArray(); [void]$groups.Add($group) }
      }
    }
    $hook = New-Map; $hook['type'] = 'command'
    $hook['command'] = "powershell -NoProfile -ExecutionPolicy Bypass -File `"$run`" $Workspace $($Events[$event])"
    $group = New-Map; $group['matcher'] = ''; $group['hooks'] = @($hook)
    [void]$groups.Add($group)
    $Cfg['hooks'][[string]$event] = $groups.ToArray()
  }
  New-Item -ItemType Directory -Force -Path (Split-Path $path) | Out-Null
  [IO.File]::WriteAllText($path, (ConvertTo-JsonText $Cfg), $Utf8)
}

function Invoke-Mcp([string]$Url, [string]$Key, $Payload, [string]$Session) {
  $headers = @{ Authorization = "Bearer $Key"; Accept = 'application/json, text/event-stream' }
  if ($Session) { $headers['Mcp-Session-Id'] = $Session }
  $body = $Utf8.GetBytes(($Payload | ConvertTo-Json -Depth 16 -Compress))
  $r = Invoke-WebRequest -UseBasicParsing -Method Post -Uri $Url -Headers $headers -ContentType 'application/json' -Body $body -TimeoutSec 30
  $text = if ($r.Content -is [byte[]]) { $Utf8.GetString($r.Content) } else { [string]$r.Content }
  if ("$($r.Headers['Content-Type'])" -like '*text/event-stream*') {
    $text = (($text -split "`n") | Where-Object { $_.StartsWith('data:') } | ForEach-Object { $_.Substring(5).Trim() }) -join "`n"
  }
  $sid = $r.Headers['Mcp-Session-Id']
  if (-not $sid) { $sid = $Session }
  $parsed = $null
  if ($text.Trim()) { $parsed = $text | ConvertFrom-Json }
  return @{ Result = $parsed; Session = $sid }
}

function Test-Server([string]$Server, [string]$Key) {
  $url = "$Server/mcp"
  try {
    $init = Invoke-Mcp $url $Key @{ jsonrpc = '2.0'; id = 1; method = 'initialize'; params = @{
      protocolVersion = '2025-03-26'; capabilities = @{}; clientInfo = @{ name = 'memory-kit-installer'; version = '0.1.0' } } } $null
    Invoke-Mcp $url $Key @{ jsonrpc = '2.0'; method = 'notifications/initialized' } $init.Session | Out-Null
    $call = Invoke-Mcp $url $Key @{ jsonrpc = '2.0'; id = 2; method = 'tools/call'; params = @{
      name = 'memory_query'; arguments = @{ query = 'unit'; global = $true; limit = 1 } } } $init.Session
  } catch {
    $code = $null
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    if ($code -eq 401 -or $code -eq 403) { Fail "installed, but the memory server $Server refused the key (ask for a new invite)" }
    Fail ("installed, but the memory server $Server did not answer: " + $_.Exception.Message.Replace($Key, '[key]'))
  }
  $res = $call.Result
  if (-not $res -or $res.PSObject.Properties['error'] -or ($res.result -and $res.result.isError)) {
    Fail "installed, but the memory server $Server refused the test search"
  }
}

$invite = ConvertFrom-Invite (Read-Invite)
$ws = $invite.workspace
$server = $invite.server.TrimEnd('/')
$key = $invite.key
# Read Claude's files first: a file we cannot read stops the install before anything is written.
$claudeJson = Read-JsonFile (Join-Path $ProfileDir '.claude.json')
$settingsJson = Read-JsonFile (Join-Path $ProfileDir '.claude\settings.json')
# The approver's invite is a second identity next to the person's: its own reference, key and MCP entry, and no
# capture hooks (sessions are captured as the person, never as the approver).
$approver = ($invite.user -eq 'approver')
$kit = Join-Path $ProfileDir '.claude\memory-kit'
$refFile = if ($approver) { 'approver.md' } else { 'me.md' }
$keyFile = if ($approver) { "$ws-approver.key" } else { "$ws.key" }
$name = if ($approver) { "$ws-approver" } else { "$ws-memory" }
Write-Private (Join-Path $kit $refFile) $invite.reference
Write-Private (Join-Path $kit $keyFile) "$key`n"
Write-Private (Join-Path $kit "$ws.server") "$server`n"
Merge-Mcp $claudeJson $name "$server/mcp" $key
Install-Skills (Get-SkillFiles)
if (-not $approver) { Install-Hooks $settingsJson $kit $ws (Get-HooksSource) }
Test-Server $server $key
Write-Host "ready: $($invite.user) on $ws ($name in Claude Code; restart Claude Code to load it)"
if (-not $approver) { Write-Host "sessions are captured only inside folders whose .ai-memory.toml names workspace $ws" }
