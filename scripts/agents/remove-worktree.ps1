<#
.SYNOPSIS
  Removes a pipeline worktree created by new-worktree.ps1, safely.

.DESCRIPTION
  The worktree contains junctions into the main checkout's node_modules. Deleting
  the folder recursively can follow them and delete the MAIN checkout's dependencies,
  so the junctions are detached first with `rmdir` (which removes only the link).
  The branch is kept unless -DeleteBranch is given (and never if it has unpushed work
  and -Force is not given).
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$Slug,
  [switch]$DeleteBranch,
  [switch]$Force
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

$mainLine = (Invoke-Git -C $PSScriptRoot worktree list --porcelain).Output -split "`n" | Where-Object { $_ -like 'worktree *' } | Select-Object -First 1
$main = ($mainLine -replace '^worktree ', '').Trim() -replace '/', '\'
$target = Join-Path (Split-Path $main -Parent) "wt-$Slug"
if (-not (Test-Path $target)) { throw "No such worktree: $target" }
if ((Resolve-Path $target).Path -eq (Resolve-Path $main).Path) { throw 'Refusing to remove the main checkout.' }
# Windows cannot delete a folder that is some shell's current directory, so stop early with a clear message
# instead of half-removing it. (Run this from the main checkout or any other folder.)
$here = (Get-Location).Path
if ($here.TrimEnd('\') -ieq $target.TrimEnd('\') -or $here -like ($target.TrimEnd('\') + '\*')) {
  throw "Your shell is inside $target. cd somewhere else (for example the main checkout) and run this again. Other shells (such as the Bash tool) must not be in that folder either."
}

# 1. Detach ONLY the junctions new-worktree.ps1 created, WITHOUT following them.
#    Never recurse here: Get-ChildItem -Recurse follows junctions in Windows PowerShell 5.1,
#    which would walk into the main checkout's node_modules and detach links inside it.
$candidates = New-Object System.Collections.Generic.List[string]
$candidates.Add((Join-Path $target 'node_modules'))
$candidates.Add((Join-Path $target 'packages\shared\dist'))
foreach ($group in 'apps', 'packages') {
  $dir = Join-Path $target $group
  if (Test-Path $dir) {
    foreach ($child in [IO.Directory]::GetDirectories($dir)) { $candidates.Add((Join-Path $child 'node_modules')) }
  }
}
foreach ($path in $candidates) {
  if (-not (Test-Path -LiteralPath $path)) { continue }
  $item = Get-Item -LiteralPath $path -Force
  if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
    cmd /c rmdir "`"$path`"" | Out-Null          # removes the link only
    if (Test-Path -LiteralPath $path) { throw "Could not detach junction $path; stopping so nothing is deleted through it." }
  }
}

$branch = (Invoke-Git -C $target branch --show-current).Output
[void](Invoke-Git -C $main worktree remove --force $target)
# git can leave an EMPTY folder behind while Windows is still releasing a handle. Remove it (never
# recursively: only if it is empty), retrying briefly.
for ($i = 0; $i -lt 10 -and (Test-Path $target); $i++) {
  if (-not (Get-ChildItem -LiteralPath $target -Force | Select-Object -First 1)) {
    Remove-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue   # no -Recurse on purpose
  }
  if (Test-Path $target) { Start-Sleep -Milliseconds 500 }
}
if (Test-Path $target) { throw "Could not fully remove $target; remove the leftover folder by hand (junctions are already detached)." }

if ($DeleteBranch -and $branch -and $branch -notin @('dev', 'main', 'dev-env')) {
  $flag = if ($Force) { '-D' } else { '-d' }
  (Invoke-Git -C $main branch $flag $branch).Output | Write-Host
}
Write-Host "Removed worktree $target (branch '$branch' $(if ($DeleteBranch) { 'delete requested' } else { 'kept' }))."
