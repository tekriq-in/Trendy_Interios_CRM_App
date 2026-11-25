<#
.SYNOPSIS
  Creates an isolated git worktree for one pipeline run, based on origin/dev-env.

.DESCRIPTION
  Agents must never switch branches or edit files in the main checkout (it may be
  serving a running app). This makes a sibling folder `wt-<slug>` on a new branch and
  links the main checkout's installed dependencies into it, so `pnpm` type-check,
  build and tests work without a second install.

  The links are junctions (no admin rights needed). Because they point at the MAIN
  checkout's node_modules, agents must not change dependencies (see roles/_common.md).

.EXAMPLE
  .\new-worktree.ps1 -Slug tasks-screen -Branch feat/tasks-screen
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$Slug,
  [string]$Branch = '',
  [string]$Base = 'origin/dev-env'
)
$ErrorActionPreference = 'Stop'

# Windows PowerShell 5.1 turns ANY stderr output of a native command into an error when
# $ErrorActionPreference is 'Stop', and git prints progress ("Preparing worktree...") to stderr.
# Run git with errors relaxed and judge success by the exit code instead.
function Invoke-Git {
  $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  try { $out = & git @args 2>&1 | Out-String } finally { $ErrorActionPreference = $old }
  [pscustomobject]@{ Output = $out.Trim(); ExitCode = $LASTEXITCODE }
}

if ($Slug -notmatch '^[a-z0-9][a-z0-9-]*$') { throw "Slug must be lowercase letters, digits and hyphens: '$Slug'" }
if ([string]::IsNullOrWhiteSpace($Branch)) { $Branch = "feat/$Slug" }
if ($Branch -in @('dev', 'main', 'dev-env')) { throw "Refusing to use '$Branch': agents never work on dev, main or dev-env." }

# The first entry of `git worktree list` is the main checkout, wherever this script runs from.
$mainLine = (Invoke-Git -C $PSScriptRoot worktree list --porcelain).Output -split "`n" | Where-Object { $_ -like 'worktree *' } | Select-Object -First 1
if (-not $mainLine) { throw 'Not inside a git repository.' }
$main = ($mainLine -replace '^worktree ', '').Trim() -replace '/', '\'
$target = Join-Path (Split-Path $main -Parent) "wt-$Slug"
if (Test-Path $target) { throw "Already exists: $target (remove it first with remove-worktree.ps1)" }

[void](Invoke-Git -C $main fetch origin --prune)
$add = Invoke-Git -C $main worktree add $target -b $Branch $Base
if ($add.ExitCode -ne 0) { throw "git worktree add failed for branch '$Branch' from '$Base': $($add.Output)" }

# Keep the pipeline's hand-off folder out of git, so a careless `git add -A` by an agent can never
# commit it, whatever the branch's .gitignore says. (info/exclude is shared by all worktrees of this
# clone and is not committed, so this also covers the main checkout. That is harmless.)
$exclude = (Invoke-Git -C $target rev-parse --git-path info/exclude).Output
if (-not [IO.Path]::IsPathRooted($exclude)) { $exclude = Join-Path $target $exclude }
New-Item -ItemType Directory -Force (Split-Path $exclude -Parent) | Out-Null
if (-not (Test-Path $exclude) -or -not (Select-String -Path $exclude -SimpleMatch '.agent-run/' -Quiet)) {
  Add-Content -Path $exclude -Value "`n.agent-run/"
}

# Link installed dependencies from the main checkout.
$links = New-Object System.Collections.Generic.List[string]
function Add-Link([string]$relative) {
  $src = Join-Path $main $relative
  $dst = Join-Path $target $relative
  if ((Test-Path $src) -and -not (Test-Path $dst)) {
    New-Item -ItemType Directory -Force (Split-Path $dst -Parent) | Out-Null
    New-Item -ItemType Junction -Path $dst -Target $src | Out-Null
    $links.Add($relative)
  }
}
Add-Link 'node_modules'
foreach ($group in 'apps', 'packages') {
  $dir = Join-Path $main $group
  if (Test-Path $dir) {
    Get-ChildItem $dir -Directory | ForEach-Object { Add-Link "$group\$($_.Name)\node_modules" }
  }
}
Add-Link 'packages\shared\dist'   # built types used by the apps

[pscustomobject]@{
  worktree = $target
  branch   = $Branch
  base     = $Base
  linked   = $links.ToArray()
} | ConvertTo-Json
