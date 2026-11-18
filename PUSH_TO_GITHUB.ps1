# ============================================================
#  I²IT Smart Library — One-Click GitHub Pages Deployer
#  Run this script ONCE to push to GitHub and go live.
#  After that, just re-run to push any new changes.
# ============================================================

$projectDir = $PSScriptRoot
Set-Location $projectDir

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "   I²IT Smart Library — GitHub Pages Deployer" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Check Git ────────────────────────────────────────
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    $candidatePaths = @(
        "C:\Program Files\Git\bin",
        "C:\Program Files (x86)\Git\bin",
        "$env:LOCALAPPDATA\Programs\Git\bin"
    )
    # Also check GitHub Desktop's embedded Git
    $ghDesktopGit = Get-ChildItem "$env:LOCALAPPDATA\GitHubDesktop\app-*\resources\app\git\cmd" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($ghDesktopGit) {
        $candidatePaths += $ghDesktopGit.FullName
    }
    foreach ($path in $candidatePaths) {
        if (Test-Path "$path\git.exe") {
            $env:PATH = "$path;" + $env:PATH
            break
        }
    }
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Git is not found." -ForegroundColor Red
    Write-Host "Download from: https://git-scm.com/download/win" -ForegroundColor Yellow
    Write-Host "Then re-run this script." -ForegroundColor Yellow
    pause; exit 1
}
Write-Host "[OK] Git found: $(git --version)" -ForegroundColor Green

# ── Step 2: Ask for GitHub username ──────────────────────────
Write-Host ""
$username = Read-Host "Enter your GitHub username (e.g. sanchit123)"
if (-not $username) { Write-Host "Username required." -ForegroundColor Red; pause; exit 1 }

$repoName = "i2it-smart-library-3d"
$repoUrl  = "https://github.com/$username/$repoName.git"
$pagesUrl = "https://$username.github.io/$repoName/"

Write-Host ""
Write-Host "Repository: $repoUrl" -ForegroundColor Cyan
Write-Host "Live URL will be: $pagesUrl" -ForegroundColor Green
Write-Host ""

# ── Step 3: Init git if needed ───────────────────────────────
if (-not (Test-Path ".git")) {
    Write-Host "Initializing Git repository..." -ForegroundColor Yellow
    git init
    git branch -M main
}

# ── Step 4: Set remote ───────────────────────────────────────
$existingRemote = git remote get-url origin 2>$null
if ($existingRemote) {
    git remote set-url origin $repoUrl
    Write-Host "[OK] Remote updated to $repoUrl" -ForegroundColor Green
} else {
    git remote add origin $repoUrl
    Write-Host "[OK] Remote set to $repoUrl" -ForegroundColor Green
}

# ── Step 5: Configure git identity if needed ─────────────────
$gitUser  = git config user.name 2>$null
$gitEmail = git config user.email 2>$null
if (-not $gitUser) {
    $name = Read-Host "Enter your name for git commits (e.g. Sanchit)"
    git config user.name "$name"
}
if (-not $gitEmail) {
    $email = Read-Host "Enter your GitHub email"
    git config user.email "$email"
}

# ── Step 6: Stage and commit ─────────────────────────────────
Write-Host ""
Write-Host "Staging all files..." -ForegroundColor Yellow

# Exclude the duplicate video from git tracking
if (Test-Path ".gitignore") {
    # Already exists
} else {
    "picsart-video-2026-11-18T11-24-31-014Z-compressed.mp4" | Out-File .gitignore -Encoding utf8
}

git add .
$status = git status --short
if (-not $status) {
    Write-Host "[OK] Nothing new to commit — pushing existing state." -ForegroundColor Green
} else {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
    git commit -m "I2IT Smart Library update — $timestamp"
    Write-Host "[OK] Committed." -ForegroundColor Green
}

# ── Step 7: Push ─────────────────────────────────────────────
Write-Host ""
Write-Host "Pushing to GitHub... (you may be asked for credentials)" -ForegroundColor Yellow
Write-Host "(Use your GitHub username + a Personal Access Token as password)" -ForegroundColor DarkGray
Write-Host "(Get token from: GitHub → Settings → Developer Settings → Personal Access Tokens)" -ForegroundColor DarkGray
Write-Host ""
git push -u origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Push failed. Common causes:" -ForegroundColor Red
    Write-Host "  1. Repo '$repoName' doesn't exist on GitHub yet." -ForegroundColor Yellow
    Write-Host "     → Go to github.com/new and create it (do NOT add README)" -ForegroundColor Yellow
    Write-Host "  2. Wrong password — use a Personal Access Token, not your GitHub password." -ForegroundColor Yellow
    Write-Host "     → github.com → Settings → Developer Settings → Tokens (classic) → Generate new" -ForegroundColor Yellow
    Write-Host "  3. Wrong username entered." -ForegroundColor Yellow
    pause; exit 1
}

# ── Step 8: Final instructions ───────────────────────────────
Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host "   PUSHED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Now enable GitHub Pages:" -ForegroundColor Cyan
Write-Host "  1. Go to: https://github.com/$username/$repoName/settings/pages" -ForegroundColor White
Write-Host "  2. Under 'Source', select: GitHub Actions" -ForegroundColor White
Write-Host "  3. Wait 2-3 minutes for the first deploy" -ForegroundColor White
Write-Host ""
Write-Host "Your live site will be at:" -ForegroundColor Cyan
Write-Host "  $pagesUrl" -ForegroundColor Green
Write-Host ""
Write-Host "Share this URL — open on any phone or PC and the" -ForegroundColor White
Write-Host "occupancy counter syncs in real-time across all devices!" -ForegroundColor White
Write-Host ""
Start-Process "https://github.com/$username/$repoName/settings/pages"
pause
