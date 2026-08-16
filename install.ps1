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
# 메뉴 카테고리: dev / cloud / ai / data / research / writing
# Sub-옵션 플래그:
#   -Dev           frontend, python, rust, nodejs, obsidian, chrome, claude
#   -Cloud         infra, finops, integration
#   -Ai            llm
#   -Data          duckdb, python-data, aws-analytics, mysql, postgres, mongodb, dynamodb, aws-rds
#   -Research      websearch, report
#   -Writing       general, social
# 상세(3단계) 플래그:
#   -WritingSocial voice, content, visual       (writing.social 상세)
#
# 그 외 옵션:
#   -WithHooks   hooks 를 settings.json 에 병합. 대화형이면 워크로드 설치 후
#                hooks·mcp 추가 설치를 물어보므로 생략 가능; 이 플래그를 주면
#                hooks 는 묻지 않고 바로 병합한다.
#   -WithMcp     MCP proxy(mcp-configs/proxy/)를 묻지 않고 바로 docker compose
#                up -d 로 기동한다. 비대화형에서도 동작. docker/데몬/compose
#                미비 시 경고만 하고 넘어간다.
#   -NoExtras    워크로드 외(hooks·mcp) 추가 설치 프롬프트를 건너뛴다.
#   -NoCore      baseline core 워크로드를 제외 (= -SkipWorkload core). core 는
#                글로벌에만 두고 프로젝트 로컬 설치엔 워크로드만 담고 싶을 때.
#                예: $env:CLAUDE_HOME="$PWD\.claude"; ./install.ps1 -NoCore -Category frontend
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
    [switch]$WithMcp,
    [switch]$NoExtras,
    [switch]$NoCore,
    [switch]$NoHomeLink,
    [switch]$All,
    [string[]]$Workload,
    [string[]]$SkipWorkload,
    [string[]]$Category,
    [string[]]$Dev,            # frontend, python, rust, nodejs, obsidian, chrome, claude
    [string[]]$Cloud,          # infra, finops, integration
    [string[]]$Ai,             # llm
    [string[]]$Data,           # duckdb, python-data, aws-analytics, mysql, postgres, mongodb, dynamodb, aws-rds
    [string[]]$Research,       # websearch, report
    [string[]]$Writing,        # general, social
    [string[]]$WritingSocial   # 상세: voice, content, visual (writing.social)
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
# -NoCore 는 -SkipWorkload core 의 별칭. 둘 다 주면 core 를 합쳐 제외.
$SkipWorkloadCsv = Join-CommaList (@($SkipWorkload) + $(if ($NoCore) { 'core' }))

$SelectAssetsScript    = Join-Path $HarnessDir 'scripts/install/select-assets.js'
$SelectWorkloadsScript = Join-Path $HarnessDir 'scripts/install/select-workloads.js'
$MergeScript           = Join-Path $HarnessDir 'scripts/install/merge-hooks.js'

function Build-MenuArgs {
    $args = @()
    if ($All) { $args += '--all' }

    $catCsv = Join-CommaList $Category
    if ($catCsv) { $args += "--category=$catCsv" }

    $pairs = @{
        dev              = (Join-CommaList $Dev)
        cloud            = (Join-CommaList $Cloud)
        ai               = (Join-CommaList $Ai)
        data             = (Join-CommaList $Data)
        research         = (Join-CommaList $Research)
        writing          = (Join-CommaList $Writing)
        'writing-social' = (Join-CommaList $WritingSocial)    # sub 레벨 상세 (writing.social)
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
    #
    # 한계: 이 순회는 선언 기반이라 **레포에서 이미 사라진 자산**의 링크(orphan)는
    # 지우지 못한다. install.sh 에는 unlink_orphans() 가 있지만 여기에는 없다 —
    # Windows 에서 검증할 수 없는 삭제 코드를 넣지 않기로 했다. Windows 사용자는
    # `npm run check-drift` 로 orphan 목록을 확인하고 (읽기 전용, 크로스 플랫폼)
    # 나온 경로를 직접 지운다.
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

# mcp 는 proxy-first: 프록시 가능한 서버(github·exa·context7·brave-search·time)는
# mcp-proxy 컨테이너에서 중앙 구동하고, 클라이언트는 localhost:9090 만 바라본다.
# OAuth·브라우저 의존 서버(sentry·playwright 등)는 클라이언트에 로컬로 남긴다.
function Set-McpProxy {
    $proxyDir = Join-Path $HarnessDir 'mcp-configs\proxy'
    Write-Host ''
    Write-Host '==> MCP proxy (mcp-configs/proxy/)'

    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Host '  x docker 없음 — MCP proxy 는 docker 컨테이너로 돕니다. 먼저 docker 를 설치하세요:' -ForegroundColor Yellow
        Write-Host '      Docker Desktop: https://docs.docker.com/desktop/windows-install/' -ForegroundColor Yellow
        Write-Host '  설치 후 다시 실행: .\install.ps1 -WithMcp' -ForegroundColor Yellow
        Write-Host '  (프록시 없이 쓰려면 .mcp.json 의 localhost:9090 항목을 직접 연결로 바꾸면 됩니다.)' -ForegroundColor Yellow
        return
    }
    if (-not $DryRun) {
        docker info *> $null
        if ($LASTEXITCODE -ne 0) {
            Write-Host '  x docker 데몬 미동작 — Docker Desktop 을 먼저 실행하세요.' -ForegroundColor Yellow
            Write-Host '  그다음 다시 실행: .\install.ps1 -WithMcp' -ForegroundColor Yellow
            return
        }
    }
    docker compose version *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Host '  docker compose(v2) 없음 — https://docs.docker.com/compose/install/ 설치 후 재실행.' -ForegroundColor Yellow
        return
    }

    # 시크릿: 셸/프로세스 env 가 우선(빈 .env 를 덮음). 없으면 proxy/.env 에서 읽음.
    $envFile = Join-Path $proxyDir '.env'
    if (-not $env:GITHUB_PAT -or -not $env:BRAVE_API_KEY) {
        Write-Host '  API 키 넣는 법 (하나 택):'
        Write-Host '    1) PowerShell 프로필 (권장) — notepad $PROFILE 에:'
        Write-Host '         $env:GITHUB_PAT = "ghp_..."      # github.com/settings/tokens'
        Write-Host '         $env:BRAVE_API_KEY = "BSA_..."    # api.search.brave.com/app/keys'
        Write-Host '       그다음 . $PROFILE 후 이 설치를 다시 실행.'
        Write-Host "    2) $envFile 에 직접 값 채우기 (.env.example 참고)."
    }
    if (-not (Test-Path -LiteralPath $envFile)) {
        Invoke-Step -Action { Copy-Item (Join-Path $proxyDir '.env.example') $envFile } -Description "copy .env"
    }

    # 선택된 워크로드에 맞는 proxy 서버만 골라 config.json 을 빌드한다.
    # (통짜로 전부 띄우지 않고 필요한 것만 — CLAUDE.md 의 "동시 MCP 10개 이하" 원칙.)
    $builder = Join-Path $HarnessDir 'scripts\install\build-mcp-config.js'
    $builderArgs = @("--workload=$ResolvedWorkloads")
    if ($DryRun) { $builderArgs += '--dry-run' }
    $buildOut = & node $builder @builderArgs 2>&1
    $buildOut | ForEach-Object { Write-Host "  $_" }
    $composeProfiles = @()
    if ($buildOut -match 'terraform 선택됨') { $composeProfiles = @('--profile', 'terraform') }

    $compose = Join-Path $proxyDir 'docker-compose.yaml'
    Write-Host '  docker compose up -d …'
    Invoke-Step -Action { docker compose @composeProfiles -f $compose --project-directory $proxyDir up -d } -Description 'docker compose up -d'

    Write-Host '  프록시 서버 → http://localhost:9090/<서버>/mcp (선택된 워크로드 기준, 위 목록 참고).'
    Write-Host '  로컬 유지: sentry(OAuth)·playwright(브라우저) — .mcp.json 에 직접.'
    Write-Host "  시크릿(GITHUB_PAT·BRAVE_API_KEY·OBSIDIAN_API_KEY)은 $envFile 한 곳에만."
    Write-Host '  확인: curl -i http://localhost:9090/time/mcp  (405 계열이면 정상 기동)'
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

$CheckGlobalScript = Join-Path $HarnessDir 'scripts/install/check-global.js'
$ManifestScript    = Join-Path $HarnessDir 'scripts/install/manifest.js'

# 1단계: 글로벌 baseline 설치 상태를 보고 (absent / outdated / current).
function Show-GlobalState {
    $json = & node $CheckGlobalScript "--claude-home=$ClaudeDir" "--root=$HarnessDir" 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $json) { return }
    try { $obj = ($json | Out-String | ConvertFrom-Json) } catch { return }
    # StrictMode 대비: 없는 속성 접근은 예외를 던지므로 PSObject.Properties 로 방어.
    $prop = { param($o, $n) if ($o.PSObject.Properties[$n]) { $o.$n } else { $null } }
    $state     = & $prop $obj 'state'
    $installedV = & $prop $obj 'installedVersion'
    $repoV     = & $prop $obj 'repoVersion'
    $installed = if ($installedV) { $installedV } else { 'none' }
    $repo = if ($repoV) { $repoV } else { '?' }
    $stateLabel = if ($state) { $state } else { 'unknown' }
    Write-Host "==> Global baseline: $stateLabel (installed: $installed, repo: $repo)"
    switch ($state) {
        'absent'   { Write-Host '    글로벌 하네스 없음 - 신규 설치합니다.' }
        'outdated' { Write-Host '    설치된 버전이 오래됨 - 갱신합니다 (필요 시 -Force).' }
        'current'  { Write-Host '    최신 상태 - 선택한 워크로드만 반영합니다.' }
    }
}

# 설치 종료 후 매니페스트 기록 (다음 실행의 상태 판정 근거).
function Write-HarnessManifest {
    param([string]$WlCsv)
    if ($DryRun) { Write-Host "[dry-run] write manifest ($ClaudeDir)"; return }
    $repo = (Get-Content -LiteralPath (Join-Path $HarnessDir 'VERSION') -Raw).Trim()
    & node $ManifestScript write "--claude-home=$ClaudeDir" "--version=$repo" "--workloads=$WlCsv" 2>$null
    if ($LASTEXITCODE -eq 0) {
        $wl = if ($WlCsv) { $WlCsv } else { '<all>' }
        Write-Host "manifest: $ClaudeDir\_harness-manifest.json (v$repo, workloads: $wl)"
    }
}

$ResolvedWorkloads = $null
if (-not $Uninstall) {
    Show-GlobalState
    Write-Host ''
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

# 워크로드 외 자산(hooks·mcp). uninstall: 함께 제거. install: -WithHooks / -WithMcp
# 면 각각 묻지 않고 바로 실행, 아니면 대화형 콘솔일 때 물어본다(-NoExtras/리다이렉트 skip).
$hooksDone = $false
$mcpDone = $false
if ($Uninstall) {
    Invoke-HookMerge
} else {
    # -WithHooks / -WithMcp 는 프롬프트 없이 바로 실행 (비대화형에서도 동작).
    if ($WithHooks) {
        Invoke-HookMerge
        $hooksDone = $true
    }
    if ($WithMcp) {
        Set-McpProxy
        $mcpDone = $true
    }
    # 남은 항목은 대화형 콘솔이고 -NoExtras 아닐 때만 물어본다.
    if (-not $NoExtras -and [Environment]::UserInteractive -and -not [Console]::IsInputRedirected `
        -and (-not $hooksDone -or -not $mcpDone)) {
        Write-Host ''
        Write-Host '──> 워크로드 외 추가 설치 (선택)'
        if (-not $hooksDone -and (Confirm-Extra 'hooks 를 settings.json 에 병합할까요? (포맷·품질·세션 훅)')) {
            Invoke-HookMerge
            $hooksDone = $true
        }
        if (-not $mcpDone -and (Confirm-Extra 'MCP proxy 를 지금 설치·기동할까요? (docker compose up -d)')) {
            Set-McpProxy
            $mcpDone = $true
        }
    }
}

if ($Uninstall -and -not $DryRun) {
    Remove-EmptyHarnessDirs
    Remove-Item -LiteralPath (Join-Path $ClaudeDir '_harness-manifest.json') -Force -ErrorAction SilentlyContinue
}

if (-not $Uninstall) {
    Write-HarnessManifest -WlCsv $ResolvedWorkloads
    Write-Host ''
    if ($hooksDone) {
        Write-Host "Done. Symlinks installed and hooks merged into `$ClaudeDir\settings.json."
        Write-Host "Hook profile: minimal. Raise it via env.HARNESS_HOOK_PROFILE in settings.json."
    } else {
        Write-Host "Done. Symlinks installed. Hooks NOT merged - re-run with -WithHooks"
        Write-Host "(or answer yes to the hooks prompt) to enable them."
    }
    Write-Host ''
    Write-Host "Check settings.json:  npm run optimize-settings   (add -- --apply to fix)"
    Write-Host "Check symlinks:       npm run check-drift"
}
