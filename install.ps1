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
# 그 외 옵션:
#   -WithHooks   hooks 를 settings.json 에 병합. 대화형이면 워크로드 설치 후
#                hooks·mcp 추가 설치를 물어보므로 생략 가능; 이 플래그를 주면
#                hooks 는 묻지 않고 바로 병합한다.
#   -NoExtras    워크로드 외(hooks·mcp) 추가 설치 프롬프트를 건너뛴다.
#   -NoHomeLink  $env:CLAUDE_HOME 이 %USERPROFILE%\.claude 가 아닐 때도
#                %USERPROFILE%\.claude\_harness 보조 링크를 만들지 않음
#
# 요구사항: Windows 10+ + Developer Mode 또는 관리자 권한, Node.js on PATH.

[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$Uninstall,
    [switch]$Force,
    [switch]$WithHooks,
    [switch]$NoExtras,
    [switch]$NoHomeLink,
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

# 워크로드 외(hooks·mcp) 추가 설치 프롬프트. 대화형 콘솔일 때만 묻는다.
function Confirm-Extra {
    param([string]$Question)
    if ($NoExtras -or -not [Environment]::UserInteractive -or [Console]::IsInputRedirected) {
        return $false
    }
    $reply = Read-Host "$Question [y/N]"
    return ($reply -match '^(y|yes)$')
}

function Show-McpInfo {
    Write-Host ''
    Write-Host '==> MCP servers'
    Write-Host "  MCP 설정 샘플: $HarnessDir\.mcp.json (github·context7·exa·brave-search·sentry·time·playwright)"
    Write-Host '  활성화: 필요한 서버를 ~/.claude.json 또는 프로젝트 .mcp.json 의 mcpServers 에 복사.'
    Write-Host '  키는 환경변수로 주입 — $env:GITHUB_PAT, $env:BRAVE_API_KEY (.env.example 참고).'
    Write-Host '  exa·sentry 는 remote(HTTP), time 은 uvx(uv 설치 필요).'
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

# repo-root 를 $ClaudeDir\_harness 로 링크.
# hooks.json 의 inline bootstrap 은 다음 순서로 harness root 를 찾는다:
#   1) $env:CLAUDE_PLUGIN_ROOT (claude-code 가 직접 주입)
#   2) $env:CLAUDE_PROJECT_DIR\.claude\_harness, $env:CLAUDE_PROJECT_DIR\.claude
#   3) %USERPROFILE%\.claude, %USERPROFILE%\.claude\_harness, %USERPROFILE%\.claude\plugins\_harness
if ($Uninstall) {
    Remove-HarnessSymlink -SourceRel '' -TargetRel '_harness'
} else {
    New-HarnessSymlink -SourceRel '' -TargetRel '_harness'
}

# 보조 링크: CLAUDE_HOME 이 %USERPROFILE%\.claude 가 아니고 hooks 도 같이 머지할 때,
# 일부 환경 (CLAUDE_PROJECT_DIR 미주입 등) 을 위한 안전망으로
# %USERPROFILE%\.claude\_harness 를 함께 만들어 둔다. -NoHomeLink 로 끌 수 있다.
$DefaultClaudeDir = Join-Path $env:USERPROFILE '.claude'
if (-not $Uninstall -and $WithHooks -and -not $NoHomeLink -and ($ClaudeDir -ne $DefaultClaudeDir)) {
    $homeLink = Join-Path $DefaultClaudeDir '_harness'
    if (-not (Test-Path -LiteralPath $homeLink)) {
        Write-Host ''
        Write-Host "note: `$ClaudeDir=$ClaudeDir (not $DefaultClaudeDir)."
        Write-Host "note: creating safety link $homeLink -> $HarnessDir"
        Write-Host 'note: (re-run with -NoHomeLink to skip)'
        if (-not (Test-Path -LiteralPath $DefaultClaudeDir)) {
            Invoke-Step -Action { New-Item -ItemType Directory -Path $DefaultClaudeDir -Force | Out-Null } -Description "mkdir $DefaultClaudeDir"
        }
        Invoke-Step -Action { New-Item -ItemType SymbolicLink -Path $homeLink -Target $HarnessDir | Out-Null } -Description "link $homeLink -> $HarnessDir"
    }
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

# 워크로드 외 자산(hooks·mcp). uninstall: 함께 제거. install: -WithHooks 면 바로
# 병합, 아니면 대화형 콘솔일 때 hooks·mcp 를 각각 물어본다(-NoExtras/리다이렉트 skip).
$hooksDone = $false
if ($Uninstall) {
    Invoke-HookMerge
} elseif ($WithHooks) {
    Invoke-HookMerge
    $hooksDone = $true
} elseif (-not $NoExtras -and [Environment]::UserInteractive -and -not [Console]::IsInputRedirected) {
    Write-Host ''
    Write-Host '──> 워크로드 외 추가 설치 (선택)'
    if (Confirm-Extra 'hooks 를 settings.json 에 병합할까요? (포맷·품질·세션 훅)') {
        Invoke-HookMerge
        $hooksDone = $true
    }
    if (Confirm-Extra 'MCP 서버 설정 안내를 볼까요?') {
        Show-McpInfo
    }
}

if ($Uninstall -and -not $DryRun) {
    Remove-EmptyHarnessDirs
}

if (-not $Uninstall) {
    Write-Host ''
    if ($hooksDone) {
        Write-Host "Done. Symlinks installed and hooks merged into `$ClaudeDir\settings.json."
    } else {
        Write-Host "Done. Symlinks installed. Hooks NOT merged - re-run with -WithHooks"
        Write-Host "(or answer yes to the hooks prompt) to enable them."
    }
}
