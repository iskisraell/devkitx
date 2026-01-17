#Requires -Version 5.1
<#
.SYNOPSIS
    DevKitX installer for Windows
.DESCRIPTION
    Downloads and installs DevKitX CLI with all dependencies
.EXAMPLE
    irm https://raw.githubusercontent.com/iskisraell/devkitx/main/install.ps1 | iex
#>

$ErrorActionPreference = "Stop"

# Colors
function Write-Step { param($msg) Write-Host "  [*] $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "  [+] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "  [!] $msg" -ForegroundColor Yellow }
function Write-Err { param($msg) Write-Host "  [-] $msg" -ForegroundColor Red }

# Banner
Write-Host ""
Write-Host "  ╔═══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║  DevKitX Installer                        ║" -ForegroundColor Cyan
Write-Host "  ║  Developer Toolkit CLI                    ║" -ForegroundColor Cyan
Write-Host "  ╚═══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if running as admin (not required, but warn)
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($isAdmin) {
    Write-Warn "Running as Administrator - installing for current user only"
}

# Configuration
$DEVKITX_HOME = "$env:USERPROFILE\.devkitx"
$DEVKITX_BIN = "$DEVKITX_HOME\bin"
$RALPHY_HOME = "$env:USERPROFILE\.ralphy"
$REPO_URL = "https://github.com/iskisraell/devkitx"
$RALPHY_REPO_URL = "https://github.com/michaelshimeles/ralphy"
$RELEASE_URL = "$REPO_URL/releases/latest/download"

# Create directories
Write-Step "Creating DevKitX directories..."
New-Item -ItemType Directory -Force -Path $DEVKITX_HOME | Out-Null
New-Item -ItemType Directory -Force -Path $DEVKITX_BIN | Out-Null
New-Item -ItemType Directory -Force -Path "$DEVKITX_HOME\backups" | Out-Null
Write-Success "Directories created"

# =============================================================================
# RALPHY SETUP (Autonomous AI Coding Loops)
# =============================================================================
Write-Step "Setting up Ralphy (Autonomous AI Coding)..."

# Create Ralphy directory
New-Item -ItemType Directory -Force -Path $RALPHY_HOME | Out-Null

# Download ralphy.sh
$ralphyShPath = "$RALPHY_HOME\ralphy.sh"
try {
    Write-Step "Downloading ralphy.sh..."
    Invoke-WebRequest -Uri "$RALPHY_REPO_URL/raw/main/ralphy.sh" -OutFile $ralphyShPath -UseBasicParsing
    # Make it executable
    $content = Get-Content $ralphyShPath -Raw
    if ($content -notmatch "#!/usr/bin/env bash") {
        "#!/usr/bin/env bash`n" + $content | Set-Content $ralphyShPath
    }
    Write-Success "Downloaded ralphy.sh"
} catch {
    Write-Err "Failed to download ralphy.sh: $_"
    Write-Host "  Ralphy features will not be available" -ForegroundColor Gray
}

# Create PowerShell wrapper
$ralphyPs1Path = "$RALPHY_HOME\ralphy.ps1"
$ralphyPs1Content = @'
<#
.SYNOPSIS
    Ralphy - Windows wrapper for ralphy.sh
.DESCRIPTION
    Runs autonomous AI coding loops using OpenCode as the default engine
#>
[CmdletBinding()]
param(
    [Alias("p")]
    [string]$Prd = "PRD.md",
    [switch]$Parallel,
    [int]$MaxParallel = 3,
    [switch]$Fast,
    [switch]$BranchPerTask,
    [switch]$CreatePr,
    [switch]$DraftPr,
    [ValidateSet("opencode", "claude", "codex", "cursor")]
    [string]$Engine = "opencode",
    [int]$MaxIterations = 0,
    [switch]$DryRun,
    [Alias("yaml")]
    [string]$YamlFile,
    [string]$Github,
    [string]$GithubLabel,
    [switch]$Help
)

if ($Help) {
    Get-Help $MyInvocation.MyCommand.Path -Detailed
    exit 0
}

# Find Git Bash
$gitBashPaths = @(
    "$env:ProgramFiles\Git\bin\bash.exe",
    "$env:ProgramFiles(x86)\Git\bin\bash.exe",
    "$env:LOCALAPPDATA\Programs\Git\bin\bash.exe",
    "C:\Git\bin\bash.exe"
)
$bashExe = $gitBashPaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $bashExe) {
    Write-Host "ERROR: Git Bash not found. Please install Git for Windows." -ForegroundColor Red
    exit 1
}

# Find ralphy.sh
$ralphyScript = "$env:USERPROFILE\.ralphy\ralphy.sh"
if (-not (Test-Path $ralphyScript)) {
    Write-Host "ERROR: ralphy.sh not found. Run: dx ralph install" -ForegroundColor Red
    exit 1
}

# Build arguments
$args = @()
switch ($Engine) {
    "opencode" { $args += "--opencode" }
    "claude"   { $args += "--claude" }
    "codex"    { $args += "--codex" }
    "cursor"   { $args += "--cursor" }
}

if ($YamlFile) { $args += "--yaml", $YamlFile }
elseif ($Github) { $args += "--github", $Github; if ($GithubLabel) { $args += "--github-label", $GithubLabel } }
else { $args += "--prd", $Prd }

if ($Parallel) { $args += "--parallel", "--max-parallel", $MaxParallel }
if ($Fast) { $args += "--fast" }
if ($BranchPerTask) { $args += "--branch-per-task" }
if ($CreatePr) { $args += "--create-pr" }
if ($DraftPr) { $args += "--draft-pr" }
if ($MaxIterations -gt 0) { $args += "--max-iterations", $MaxIterations }
if ($DryRun) { $args += "--dry-run" }

$unixScript = $ralphyScript -replace '\\', '/' -replace '^C:', '/c'
$argString = $args -join " "

Write-Host ""
Write-Host "  RALPHY - Autonomous AI Coding Loop" -ForegroundColor Cyan
Write-Host "  Engine: $Engine | PRD: $(if ($YamlFile) { $YamlFile } else { $Prd })" -ForegroundColor DarkGray
if ($Parallel) { Write-Host "  Mode: Parallel ($MaxParallel agents)" -ForegroundColor DarkGray }
Write-Host ""

& $bashExe -c "$unixScript $argString"
exit $LASTEXITCODE
'@
$ralphyPs1Content | Out-File -FilePath $ralphyPs1Path -Encoding UTF8 -Force
Write-Success "Created ralphy.ps1 wrapper"

# Create batch wrapper for PATH
$ralphyCmdPath = "$RALPHY_HOME\ralphy.cmd"
"@powershell -ExecutionPolicy Bypass -File `"%USERPROFILE%\.ralphy\ralphy.ps1`" %*" | Out-File -FilePath $ralphyCmdPath -Encoding ASCII -Force
Write-Success "Created ralphy.cmd wrapper"

# Add ralphy to PATH
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$RALPHY_HOME*") {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$RALPHY_HOME", "User")
    Write-Success "Added ralphy to PATH"
} else {
    Write-Success "Ralphy already in PATH"
}

# Update profile with ralph aliases
Write-Step "Adding ralph aliases to profile..."
$ralphyAliases = @'

# Ralphy - Autonomous AI Coding
# Docs: https://github.com/michaelshimeles/ralphy
function ralph { 
    param([string]$args)
    if ($args) { 
        "$env:USERPROFILE\.ralphy\ralphy.cmd $args" | Invoke-Expression 
    } else { 
        "$env:USERPROFILE\.ralphy\ralphy.cmd" 
    } 
}
Set-Alias -Name ralph -Value "$env:USERPROFILE\.ralphy\ralphy.cmd" -Option AllScope -ErrorAction SilentlyContinue
'@
Write-Success "Ralphy setup complete"

# Check for Bun
Write-Step "Checking for Bun..."
$bunPath = Get-Command bun -ErrorAction SilentlyContinue
if (-not $bunPath) {
    Write-Warn "Bun not found, installing..."
    try {
        irm bun.sh/install.ps1 | iex
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "User") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "Machine")
        Write-Success "Bun installed"
    } catch {
        Write-Err "Failed to install Bun: $_"
        Write-Host "  Please install Bun manually: https://bun.sh" -ForegroundColor Gray
        exit 1
    }
} else {
    Write-Success "Bun found: $($bunPath.Source)"
}

# Check for Git
Write-Step "Checking for Git..."
$gitPath = Get-Command git -ErrorAction SilentlyContinue
if (-not $gitPath) {
    Write-Warn "Git not found"
    Write-Host "  Some features require Git. Install from: https://git-scm.com" -ForegroundColor Gray
} else {
    Write-Success "Git found"
}

# Download DevKitX
Write-Step "Downloading DevKitX..."

# Try to download pre-built binary first
$dxExePath = "$DEVKITX_BIN\dx.exe"
try {
    $downloadUrl = "$RELEASE_URL/dx.exe"
    Invoke-WebRequest -Uri $downloadUrl -OutFile $dxExePath -UseBasicParsing
    Write-Success "Downloaded pre-built binary"
} catch {
    Write-Warn "Pre-built binary not available, building from source..."
    
    # Clone and build
    $tempDir = "$env:TEMP\devkitx-install"
    if (Test-Path $tempDir) {
        Remove-Item -Recurse -Force $tempDir
    }
    
    Write-Step "Cloning repository..."
    git clone --depth 1 $REPO_URL $tempDir 2>&1 | Out-Null
    
    Write-Step "Installing dependencies..."
    Push-Location $tempDir
    & bun install 2>&1 | Out-Null
    
    Write-Step "Building executable..."
    & bun build src/index.ts --compile --outfile "$DEVKITX_BIN\dx.exe" 2>&1 | Out-Null
    Pop-Location
    
    # Cleanup
    Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
    Write-Success "Built from source"
}

# Create devkitx.exe alias
Copy-Item $dxExePath "$DEVKITX_BIN\devkitx.exe" -Force

# Download/create profile additions
Write-Step "Setting up shell enhancements..."
$profileAdditions = @'
# DevKitX PowerShell Profile Enhancements
# Generated by DevKitX installer

# dx go wrapper - reads path from temp file and actually changes directory
function dxgo {
    param([string]$name)
    
    $goPathFile = "$env:USERPROFILE\.devkitx\go-path.txt"
    
    if (Test-Path $goPathFile) {
        Remove-Item $goPathFile -Force
    }
    
    if ($name) {
        $path = dx go $name --path-only 2>&1
        if ($LASTEXITCODE -eq 0 -and $path -and (Test-Path $path)) {
            Set-Location $path
        }
    } else {
        dx go
        
        if (Test-Path $goPathFile) {
            $path = (Get-Content $goPathFile -Raw).Trim()
            if ($path -and (Test-Path $path)) {
                Set-Location $path
            }
            Remove-Item $goPathFile -Force
        }
    }
}

# Aliases
Set-Alias -Name go -Value dxgo -Option AllScope -ErrorAction SilentlyContinue
function dxc { dx create $args }
function dxl { dx list }
function dxs { dx status }
function dxo { dx open $args }

# Git shortcuts
function gs { git status }
function gp { git push }
function gl { git pull }
function gd { git diff }
function glog { git log --oneline --graph --decorate -20 }

# pnpm shortcuts
function pd { pnpm dev }
function pb { pnpm build }
function pi { pnpm install }

# Ralphy - Autonomous AI Coding (loaded from ralphy.ps1 wrapper)
# Run: dx ralph help --export for full documentation

# Welcome message (only in interactive sessions)
if ($Host.UI.RawUI.WindowTitle -and -not $env:DEVKITX_QUIET) {
    Write-Host ""
    Write-Host " DevKitX Developer Environment" -ForegroundColor Cyan
    Write-Host " Type 'dx' for commands, 'go' to switch projects" -ForegroundColor DarkGray
    Write-Host " Ralphy: dx ralph help | dx ralph run --help" -ForegroundColor DarkGray
    Write-Host ""
}
'@

$profileAdditionsPath = "$DEVKITX_HOME\profile-additions.ps1"
$profileAdditions | Out-File -FilePath $profileAdditionsPath -Encoding UTF8 -Force
Write-Success "Shell enhancements created"

# Add to PATH
Write-Step "Updating PATH..."
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$DEVKITX_BIN*") {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$DEVKITX_BIN", "User")
    $env:Path = "$env:Path;$DEVKITX_BIN"
    Write-Success "Added to PATH"
} else {
    Write-Success "Already in PATH"
}

# Update PowerShell profile
Write-Step "Updating PowerShell profile..."
$profilePath = $PROFILE.CurrentUserAllHosts
if (-not $profilePath) {
    $profilePath = $PROFILE
}

$profileDir = Split-Path $profilePath -Parent
if (-not (Test-Path $profileDir)) {
    New-Item -ItemType Directory -Force -Path $profileDir | Out-Null
}

if (-not (Test-Path $profilePath)) {
    New-Item -ItemType File -Force -Path $profilePath | Out-Null
}

$profileContent = Get-Content $profilePath -Raw -ErrorAction SilentlyContinue
$loadLine = '. "$env:USERPROFILE\.devkitx\profile-additions.ps1"'

if ($profileContent -notlike "*devkitx*profile-additions*") {
    Add-Content -Path $profilePath -Value "`n# Load DevKitX`n$loadLine"
    Write-Success "Profile updated"
} else {
    Write-Success "Profile already configured"
}

# Verify installation
Write-Step "Verifying installation..."
$env:Path = "$env:Path;$DEVKITX_BIN"
try {
    $version = & "$DEVKITX_BIN\dx.exe" --version 2>&1
    Write-Success "DevKitX installed: v$version"
} catch {
    Write-Warn "Could not verify installation"
}

# Done!
Write-Host ""
Write-Host "  ╔═══════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║  Installation Complete!                   ║" -ForegroundColor Green
Write-Host "  ╚═══════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor White
Write-Host ""
Write-Host "  1. Restart PowerShell (or run: . `$PROFILE)" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Create your first project:" -ForegroundColor Gray
Write-Host "     dx create my-app" -ForegroundColor Cyan
Write-Host ""
Write-Host "  3. View all commands:" -ForegroundColor Gray
Write-Host "     dx --help" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Ralphy - Autonomous AI Coding:" -ForegroundColor White
Write-Host "     dx ralph help           # Full documentation" -ForegroundColor Cyan
Write-Host "     dx ralph init           # Initialize project" -ForegroundColor Cyan
Write-Host "     dx ralph install        # Install ralphy.sh" -ForegroundColor Cyan
Write-Host "     dx ralph run            # Run Ralphy loop" -ForegroundColor Cyan
Write-Host "     dx ralph run --parallel # Parallel agents" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Documentation: https://github.com/iskisraell/devkitx" -ForegroundColor DarkGray
Write-Host "  Ralphy Docs:   https://github.com/michaelshimeles/ralphy" -ForegroundColor DarkGray
Write-Host ""
