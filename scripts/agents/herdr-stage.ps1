<#
.SYNOPSIS
  Runs ONE stage of the multi-agent pipeline in its own Herdr pane and waits for it.

.DESCRIPTION
  Must be run from a Claude session that is inside a Herdr pane (HERDR_ENV=1): the lead.
  For the given role it: composes the agent's prompt (common rules + role + this run),
  splits a pane in the worktree, registers it so the Stop hook reports back to the lead,
  starts a Claude agent, sends it the prompt, waits for the turn to finish, checks the
  stage's output file, and closes the pane.

  Hand-off files live in <Workdir>\.agent-run\ (git-ignored): task.md, plan.md,
  coder-notes.md, build-report.md, review.md, pr.md, pr-review.md.

  Exit codes: 0 stage finished (read the STATUS in the output file), 2 the agent is
  BLOCKED on a prompt (pane kept: ask the human), 3 no output file was produced,
  4 could not run (limit, herdr error, timeout).

.EXAMPLE
  .\herdr-stage.ps1 -Role planner -Workdir C:\...\wt-tasks-screen
  .\herdr-stage.ps1 -Role coder   -Workdir C:\...\wt-tasks-screen -Suffix 2 -Task "Fix review.md findings 1 and 2"
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [ValidateSet('planner', 'coder', 'builder-tester', 'code-reviewer', 'pr-raiser', 'pr-reviewer', 'selftest')]
  [string]$Role,
  [Parameter(Mandatory)][string]$Workdir,
  [string]$Task = '',
  [string]$TaskFile = '',
  [string]$Suffix = '',
  [int]$TimeoutMinutes = 30,
  [switch]$KeepPane
)
$ErrorActionPreference = 'Stop'

function Fail([string]$message, [int]$code = 4) {
  [Console]::Error.WriteLine("herdr-stage: $message")
  exit $code
}

# ---- environment ----------------------------------------------------------
if ($env:HERDR_ENV -ne '1' -or [string]::IsNullOrWhiteSpace($env:HERDR_PANE_ID)) {
  Fail 'Not running inside a Herdr pane (HERDR_ENV is not 1). Start `herdr`, then `claude` in a pane.'
}
$herdr = $env:HERDR_BIN_PATH
if ([string]::IsNullOrWhiteSpace($herdr)) {
  $found = Get-Command herdr -ErrorAction SilentlyContinue
  $herdr = if ($found) { $found.Source } else { Join-Path $env:LOCALAPPDATA 'Programs\Herdr\bin\herdr.exe' }
}
if (-not (Test-Path $herdr)) { Fail "herdr not found at $herdr" }
if (-not (Test-Path $Workdir -PathType Container)) { Fail "Workdir does not exist: $Workdir" }
$Workdir = (Resolve-Path $Workdir).Path

$agentsDir = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\docs\agents'))
$cfg = Get-Content (Join-Path $agentsDir 'pipeline.json') -Raw | ConvertFrom-Json

function Invoke-Herdr([string[]]$HerdrArgs) {
  $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'   # PS 5.1: native stderr must not become an error
  try { $raw = (& $herdr @HerdrArgs 2>&1 | Out-String).Trim() } finally { $ErrorActionPreference = $old }
  try { $json = $raw | ConvertFrom-Json } catch { $json = $null }
  [pscustomobject]@{ Raw = $raw; Json = $json; Failed = ($null -eq $json -or $null -ne $json.error) }
}

# ---- concurrency limit ----------------------------------------------------
$panes = (Invoke-Herdr @('pane', 'list'))
if ($panes.Failed) { Fail "pane list failed: $($panes.Raw)" }
$limit = 1 + [int]$cfg.maxConcurrentAgents
if (@($panes.Json.result.panes).Count -ge $limit) {
  Fail "Pane limit reached: $(@($panes.Json.result.panes).Count) panes open, at most $limit allowed (lead + $($cfg.maxConcurrentAgents) agents). Finish or close one first."
}

# ---- compose the prompt ---------------------------------------------------
$runDir = Join-Path $Workdir '.agent-run'
New-Item -ItemType Directory -Force $runDir | Out-Null

$stage = $cfg.stages | Where-Object { $_.role -eq $Role } | Select-Object -First 1
$outName = if ($Role -eq 'selftest') { 'selftest.md' } else { $stage.output }
$outFile = Join-Path $runDir $outName
if (Test-Path $outFile) {   # keep earlier rounds for the audit trail instead of overwriting silently
  $archive = Join-Path $runDir 'archive'
  New-Item -ItemType Directory -Force $archive | Out-Null
  Move-Item $outFile (Join-Path $archive ("{0}-{1}.md" -f [IO.Path]::GetFileNameWithoutExtension($outName), (Get-Date -Format 'yyyyMMdd-HHmmss'))) -Force
}

$taskText = $Task
if ($TaskFile) { $taskText = (Get-Content $TaskFile -Raw) + "`n" + $Task }
$inputs = @(Get-ChildItem $runDir -File -Filter '*.md' -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -notlike 'prompt-*' } | ForEach-Object { $_.FullName })

$thisRun = @"

---
# This run

- Role: $Role
- Working directory (a git worktree; stay inside it): $Workdir
- Run directory (hand-off files): $runDir
- **Output file you must write**: $outFile  (first line `STATUS: <value>`)
- Pull requests go into: $($cfg.git.prBase)   (never: $($cfg.git.neverPrBase -join ', '))
- Input files available: $(if ($inputs.Count) { $inputs -join '; ' } else { '(none yet)' })

## Task for this stage
$(if ($taskText.Trim()) { $taskText.Trim() } else { 'Follow your role description using the input files above.' })
"@

if ($Role -eq 'selftest') {
  $promptText = "This is a self-test of the agent pipeline plumbing. Write a file at `"$outFile`" whose first line is exactly 'STATUS: DONE' and whose second line is 'hello from the pipeline self-test'. Do nothing else, edit no other file, then reply with the single word READY."
} else {
  $roleFile = Join-Path $agentsDir "roles\$Role.md"
  $promptText = (Get-Content (Join-Path $agentsDir 'roles\_common.md') -Raw) + "`n`n" + (Get-Content $roleFile -Raw) + $thisRun
}
$suffixPart = if ($Suffix) { "-$Suffix" } else { '' }
$promptFile = Join-Path $runDir ("prompt-{0}{1}.md" -f $Role, $suffixPart)
Set-Content -LiteralPath $promptFile -Value $promptText -Encoding UTF8

# ---- pane, registration, agent -------------------------------------------
$lead = $env:HERDR_PANE_ID
$tag = $lead -replace ':', ''
$name = "$tag-$Role$suffixPart"

$split = Invoke-Herdr @('pane', 'split', '--current', '--direction', 'right', '--no-focus', '--cwd', $Workdir)
if ($split.Failed) { Fail "pane split failed: $($split.Raw)" }
$paneId = $split.Json.result.pane.pane_id

$regDir = Join-Path $env:USERPROFILE '.cache\herdr-leads'
New-Item -ItemType Directory -Force $regDir | Out-Null
$regFile = Join-Path $regDir ($paneId -replace ':', '_')
Set-Content -LiteralPath $regFile -Value @($lead, $name) -Encoding ASCII   # the Stop hook reports to $lead

function Close-Stage {
  if ($KeepPane) { return }
  [void](Invoke-Herdr @('pane', 'close', $paneId))
  Remove-Item -LiteralPath $regFile -Force -ErrorAction SilentlyContinue
}

$started = $false
for ($i = 1; $i -le 20; $i++) {     # a fresh pane can need a moment before it is at a prompt
  $r = Invoke-Herdr @('agent', 'start', $name, '--kind', [string]$cfg.agentKind, '--pane', $paneId)
  if (-not $r.Failed) { $started = $true; break }
  if ($r.Raw -notmatch 'agent_pane_busy') { Close-Stage; Fail "agent start failed: $($r.Raw)" }
  Start-Sleep -Milliseconds 500
}
if (-not $started) { Close-Stage; Fail 'agent start kept returning agent_pane_busy' }

# ---- run it ---------------------------------------------------------------
$timeoutMs = [string]($TimeoutMinutes * 60000)
# NOTE: no embedded double quotes here. Windows PowerShell 5.1 does not escape them when it builds the
# native command line, so herdr would see the text split into extra arguments. Single quotes are safe.
$short = "Read the file '$promptFile' and follow it exactly. Write your output file '$outFile' and stop."
$run = Invoke-Herdr @('agent', 'prompt', $name, $short, '--wait', '--timeout', $timeoutMs)
if ($run.Failed) {
  # Leave the pane open: the lead may want to look at what happened.
  Fail "agent prompt failed or timed out: $($run.Raw)" 4
}
$agentStatus = [string]$run.Json.result.agent.agent_status

$summary = [ordered]@{
  role = $Role; agent = $name; pane = $paneId; agentStatus = $agentStatus
  outputFile = $outFile; outputStatus = $null; promptFile = $promptFile
}

if ($agentStatus -eq 'blocked') {
  $summary.outputStatus = 'BLOCKED'
  $summary.note = "Agent is waiting on a prompt in pane $paneId. Ask the human; do NOT approve it for them. Pane kept open."
  ([pscustomobject]$summary | ConvertTo-Json)
  exit 2
}

$first = if (Test-Path $outFile) { (Get-Content $outFile -TotalCount 1) } else { $null }
Close-Stage
if (-not $first -or $first -notmatch '^STATUS:\s*(\S+)') {
  $summary.outputStatus = 'MISSING'
  $summary.note = "The agent finished but did not write $outFile with a STATUS line."
  ([pscustomobject]$summary | ConvertTo-Json)
  exit 3
}
$summary.outputStatus = $Matches[1]
([pscustomobject]$summary | ConvertTo-Json)
exit 0
