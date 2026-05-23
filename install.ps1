#!/usr/bin/env pwsh
# install.ps1 — Symlink this harness into $env:USERPROFILE\.claude\ by workload.
#
# 자산(agent / command / skill / rule)은 frontmatter `workloads:` 라인으로
# 워크로드 그룹에 분류된다 (없으면 scripts/install/workloads.js 휴리스틱).
# 사용자가 고른 그룹과 교집합인 자산만 심볼릭 링크로 설치한다.
#
# 워크로드 결정은 다음 순서로 결정:
#   1) -Workload, -SkipWorkload 가 있으면 그 값을 그대로 사용 (저수준 모드)
#   2) 메뉴 CLI 플래그(-Category 등)가 있으면 비대화형으로 select-workloads.js 실행
#   3) 인자가 없고 콘솔이면 select-workloads.js 가 대화형 메뉴를 띄움
#
# 메뉴 카테고리: backend / frontend / plugin / data-analysis / data-design / writing
# Sub-옵션 플래그:
#   -Backend     python, rust, nodejs, cloud, ai
#   -Frontend    react-vite-ts
#   -Plugin      obsidian, chrome, claude
#   -DataAnalysis duckdb, python
#   -DataDesign  mysql, postgres, mongodb, dynamodb
#
# 요구사항: Windows 10+ + Developer Mode 또는 관리자 권한, Node.js on PATH.

[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$Uninstall,
    [switch]$Force,
    [switch]$WithHooks,
    [switch]$All,
    [string[]]$Workload,
    [string[]]$SkipWorkload,
    [string[]]$Category,
    [string[]]$Backend,
    [string[]]$Frontend,
    [string[]]$Plugin,
    [string[]]$DataAnalysis,
    [string[]]$DataDesign,
    [string[]]$Writing
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$HarnessDir = Split-Path -Parent $PSCommandPath
$ClaudeDir = if ($env:CLAUDE_HOME) { $env:CLAUDE_HOME } else { Join-Path $env:USERPROFILE '.claude' }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error 'install.ps1 requires Node.js, but `node` is not on PATH'
    exit 1
}

function Join-CommaList {
    param([string[]]$Items)
    if (-not $Items) { return $null }
    return ($Items | Where-Object { $_ } | ForEach-Object { $_.Trim() }) -join ','
}

$WorkloadCsv     = Join-CommaList $Workload
$SkipWorkloadCsv = Join-CommaList $SkipWorkload

$SelectAssetsScript    = Join-Path $HarnessDir 'scripts/install/select-assets.js'
$SelectWorkloadsScript = Join-Path $HarnessDir 'scripts/install/select-workloads.js'
$MergeScript           = Join-Path $HarnessDir 'scripts/install/merge-hooks.js'

function Build-MenuArgs {
    $args = @()
    if ($All) { $args += '--all' }

    $catCsv = Join-CommaList $Category
    if ($catCsv) { $args += "--category=$catCsv" }

    $pairs = @{
        backend          = (Join-CommaList $Backend)
        frontend         = (Join-CommaList $Frontend)
        plugin           = (Join-CommaList $Plugin)
        'data-analysis'  = (Join-CommaList $DataAnalysis)
        'data-design'    = (Join-CommaList $DataDesign)
        writing          = (Join-CommaList $Writing)
    }
    foreach ($k in $pairs.Keys) {
        if ($pairs[$k]) { $args += "--$k=$($pairs[$k])" }
    }
    return ,$args
}

function Resolve-Workloads {
    if ($WorkloadCsv) { return $WorkloadCsv }

    $menuArgs = Build-MenuArgs
    $node = @($SelectWorkloadsScript)
    if ($menuArgs.Count -gt 0) {
        $node += @('--non-interactive') + $menuArgs
    }

    $resolved = & node @node
    if ($LASTEXITCODE -ne 0) { exit 1 }
    return ($resolved | Out-String).Trim()
}

function Test-Workloads {
    param([string]$WlCsv)
    $args = @($SelectAssetsScript)
    if ($WlCsv)         { $args += "--workload=$WlCsv" }
    if ($SkipWorkloadCsv) { $args += "--skip-workload=$SkipWorkloadCsv" }
    if ($args.Count -eq 1) { return }
    & node @args > $null
    if ($LASTEXITCODE -ne 0) { exit 1 }
}

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
    $src = if ([string]::IsNullOrEmpty($SourceRel)) { $HarnessDir } else { Join-Path $HarnessDir $SourceRel }
    $dest = Join-Path $ClaudeDir $TargetRel

    if (-not (Test-Path -LiteralPath $src)) {
        Write-Warning "skip: source missing - $src"
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
    $src = if ([string]::IsNullOrEmpty($SourceRel)) { $HarnessDir } else { Join-Path $HarnessDir $SourceRel }
    $dest = Join-Path $ClaudeDir $TargetRel

    if (Test-Path -LiteralPath $dest) {
        $existing = Get-Item -LiteralPath $dest -Force
        if ($existing.LinkType -eq 'SymbolicLink' -and $existing.Target -eq $src) {
            Invoke-Step -Action { Remove-Item -LiteralPath $dest -Force } -Description "unlink $dest"
            Write-Host "unlink: $dest"
        }
    }
}

function Get-Selection {
    param([string]$WlCsv)
    # uninstall 시에는 모든 자산을 순회해서 이전(더 넓은) 설치 흔적까지 정리.
    $args = @($SelectAssetsScript)
    if (-not $Uninstall) {
        if ($WlCsv)           { $args += "--workload=$WlCsv" }
        if ($SkipWorkloadCsv) { $args += "--skip-workload=$SkipWorkloadCsv" }
    }
    return & node @args
}

function Invoke-HookMerge {
    $argList = @($MergeScript)
    if ($DryRun)    { $argList += '--dry-run' }
    if ($Uninstall) { $argList += '--uninstall' }
    $argList += @('--hooks',    (Join-Path $HarnessDir 'hooks/hooks.json'))
    $argList += @('--settings', (Join-Path $ClaudeDir  'settings.json'))

    Write-Host ''
    Write-Host '==> Hook merge (settings.json)'
    & node @argList
}

function Remove-EmptyHarnessDirs {
    foreach ($sub in 'agents','commands','skills','rules') {
        $container = Join-Path $ClaudeDir (Join-Path $sub '_harness')
        if (Test-Path -LiteralPath $container) {
            Get-ChildItem -LiteralPath $container -Recurse -Directory -Force |
                Sort-Object FullName -Descending |
                Where-Object { -not (Get-ChildItem -LiteralPath $_.FullName -Force) } |
                ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force }
            if (-not (Get-ChildItem -LiteralPath $container -Force -ErrorAction SilentlyContinue)) {
                Remove-Item -LiteralPath $container -Force
            }
        }
    }
}

if (-not (Test-Path -LiteralPath $ClaudeDir)) {
    Write-Error "Claude config dir not found: $ClaudeDir. Set CLAUDE_HOME or create it first."
    exit 1
}

$ResolvedWorkloads = $null
if (-not $Uninstall) {
    $ResolvedWorkloads = Resolve-Workloads
    Test-Workloads -WlCsv $ResolvedWorkloads
    $label = if ($ResolvedWorkloads) { $ResolvedWorkloads } else { '<all>' }
    if ($SkipWorkloadCsv) { $label += " (skip: $SkipWorkloadCsv)" }
    Write-Host "workloads: $label"
    Write-Host ''
}

# 항상 repo-root 를 링크 — hooks.json 의 inline bootstrap 이
# %USERPROFILE%\.claude\_harness\scripts\lib\utils.js 를 찾는다.
if ($Uninstall) {
    Remove-HarnessSymlink -SourceRel '' -TargetRel '_harness'
} else {
    New-HarnessSymlink -SourceRel '' -TargetRel '_harness'
}

foreach ($line in Get-Selection -WlCsv $ResolvedWorkloads) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $parts = $line -split "`t"
    if ($parts.Count -lt 3) { continue }
    $sourceRel = $parts[1]
    $targetRel = $parts[2]
    if ($Uninstall) {
        Remove-HarnessSymlink -SourceRel $sourceRel -TargetRel $targetRel
    } else {
        New-HarnessSymlink -SourceRel $sourceRel -TargetRel $targetRel
    }
}

if ($WithHooks -or $Uninstall) {
    Invoke-HookMerge
}

if ($Uninstall -and -not $DryRun) {
    Remove-EmptyHarnessDirs
}

if (-not $Uninstall) {
    Write-Host ''
    if ($WithHooks) {
        Write-Host "Done. Symlinks installed and hooks merged into `$ClaudeDir\settings.json."
    } else {
        Write-Host "Done. Hooks are NOT auto-installed - re-run with -WithHooks to merge them,"
        Write-Host "or edit `$ClaudeDir\settings.json by hand."
    }
}
