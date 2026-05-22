#!/usr/bin/env pwsh
# install.ps1 — Symlink this harness into $env:USERPROFILE\.claude\
#
# Creates symlinks for agents, commands, skills, rules, and hooks so that
# edits in this repo take effect immediately in Claude Code.
#
# Requires: Windows 10+ with Developer Mode on, OR run as Administrator.
#
# Usage:
#   .\install.ps1                Install (default)
#   .\install.ps1 -DryRun        Show what would happen without writing
#   .\install.ps1 -Uninstall     Remove symlinks created by this script
#   .\install.ps1 -Force         Overwrite existing files/links at the target
#   .\install.ps1 -WithHooks     Also merge hooks\hooks.json into settings.json
#                                (combine with -Uninstall to remove them)

[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$Uninstall,
    [switch]$Force,
    [switch]$WithHooks
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$HarnessDir = Split-Path -Parent $PSCommandPath
$ClaudeDir = if ($env:CLAUDE_HOME) { $env:CLAUDE_HOME } else { Join-Path $env:USERPROFILE '.claude' }

# Empty Source means "this harness repo's root" — needed by the inline hook
# bootstrap, which probes %USERPROFILE%\.claude\_harness\scripts\lib\utils.js
# to locate this harness when CLAUDE_PLUGIN_ROOT is unset.
$Items = @(
    @{ Source = '';         Target = '_harness' },
    @{ Source = 'agents';   Target = 'agents/_harness' },
    @{ Source = 'commands'; Target = 'commands/_harness' },
    @{ Source = 'skills';   Target = 'skills/_harness' },
    @{ Source = 'rules';    Target = 'rules/_harness' },
    @{ Source = 'hooks';    Target = 'hooks/_harness' }
)

function Invoke-Step {
    param([scriptblock]$Action, [string]$Description)
    if ($DryRun) {
        Write-Host "[dry-run] $Description"
    } else {
        & $Action
    }
}

function New-HarnessSymlink {
    param([string]$SourceRel, [string]$TargetRel)
    $src = Join-Path $HarnessDir $SourceRel
    $dest = Join-Path $ClaudeDir $TargetRel

    if (-not (Test-Path -LiteralPath $src)) {
        Write-Warning "skip: source missing — $src"
        return
    }

    $destParent = Split-Path -Parent $dest
    if (-not (Test-Path -LiteralPath $destParent)) {
        Invoke-Step -Action { New-Item -ItemType Directory -Path $destParent -Force | Out-Null } -Description "mkdir $destParent"
    }

    if (Test-Path -LiteralPath $dest) {
        $existing = Get-Item -LiteralPath $dest -Force
        if ($existing.LinkType -eq 'SymbolicLink' -and $existing.Target -eq $src) {
            Write-Host "ok:   $dest -> $src"
            return
        }
        if ($Force) {
            Invoke-Step -Action { Remove-Item -LiteralPath $dest -Recurse -Force } -Description "remove $dest"
        } else {
            Write-Warning "skip: $dest already exists (use -Force to overwrite)"
            return
        }
    }

    Invoke-Step -Action { New-Item -ItemType SymbolicLink -Path $dest -Target $src | Out-Null } -Description "link $dest -> $src"
    Write-Host "link: $dest -> $src"
}

function Remove-HarnessSymlink {
    param([string]$SourceRel, [string]$TargetRel)
    $src = Join-Path $HarnessDir $SourceRel
    $dest = Join-Path $ClaudeDir $TargetRel

    if (Test-Path -LiteralPath $dest) {
        $existing = Get-Item -LiteralPath $dest -Force
        if ($existing.LinkType -eq 'SymbolicLink' -and $existing.Target -eq $src) {
            Invoke-Step -Action { Remove-Item -LiteralPath $dest -Force } -Description "unlink $dest"
            Write-Host "unlink: $dest"
            return
        }
    }
    Write-Warning "skip:   $dest is not a link to this harness"
}

if (-not (Test-Path -LiteralPath $ClaudeDir)) {
    Write-Error "Claude config dir not found: $ClaudeDir. Set CLAUDE_HOME or create it first."
    exit 1
}

function Invoke-HookMerge {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Warning "skip: -WithHooks requires Node.js, but 'node' is not on PATH"
        return
    }

    $mergeScript = Join-Path $HarnessDir 'scripts/install/merge-hooks.js'
    $hooksFile = Join-Path $HarnessDir 'hooks/hooks.json'
    $settingsFile = Join-Path $ClaudeDir 'settings.json'

    $argList = @($mergeScript)
    if ($DryRun) { $argList += '--dry-run' }
    if ($Uninstall) { $argList += '--uninstall' }
    $argList += @('--hooks', $hooksFile, '--settings', $settingsFile)

    Write-Host ''
    Write-Host '==> Hook merge (settings.json)'
    & node @argList
}

foreach ($item in $Items) {
    if ($Uninstall) {
        Remove-HarnessSymlink -SourceRel $item.Source -TargetRel $item.Target
    } else {
        New-HarnessSymlink -SourceRel $item.Source -TargetRel $item.Target
    }
}

if ($WithHooks) {
    Invoke-HookMerge
}

if (-not $Uninstall) {
    Write-Host ''
    if ($WithHooks) {
        Write-Host "Done. Symlinks installed and hooks merged into `$ClaudeDir\settings.json."
    } else {
        Write-Host "Done. Hooks are NOT auto-installed — re-run with -WithHooks to merge them,"
        Write-Host "or edit `$ClaudeDir\settings.json by hand."
    }
}
