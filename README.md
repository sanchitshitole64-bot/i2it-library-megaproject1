# 🏛️ I²IT Hinjewadi — Smart Digital Library & Queue Management System

**International Institute of Information Technology, Hinjewadi (Pune)**  
Real-time occupancy telemetry, RFID turnstile simulation, 3D shelf wayfinding, and intelligent queue resolution.

---

## 🌐 Live Demo

> Replace `YOUR-USERNAME` with your actual GitHub username after deployment.

**GitHub Pages URL:** `https://YOUR-USERNAME.github.io/i2it-smart-library-3d/`

---

## ✨ Features

- 📡 **Real-Time Cross-Device Sync** — Change occupancy on one device, see it instantly on all phones/PCs
- 🎥 **HD Library Video Tour** — Autoplay looping campus tour
- 📚 **Book Finder & Shelf Locator** — Search catalog, get exact rack/shelf location
- 🪑 **80-Seat Occupancy Grid** — Live seat status visualization
- 🔐 **Admin Portal** — Password-protected headcount controller
- 🌙 **Midnight Auto-Reset** — Automatic daily count reset at 00:00

---

## 🚀 Deploy to GitHub Pages (Step-by-Step)

### Step 1 — Install Git LFS (one time only)
The library video is tracked via Git LFS. Install it first:

```bash
# Windows (PowerShell — run as Administrator)
winget install GitHub.GitLFS

# OR download from: https://git-lfs.com/
```

Then enable LFS in your Git:
```bash
git lfs install
```

### Step 2 — Create a GitHub Repository

1. Go to [github.com](https://github.com) → **New repository**
2. Name it: `i2it-smart-library-3d`
3. Set it to **Public**
4. **Do NOT** check "Add README" (we already have one)
5. Click **Create repository**

### Step 3 — Push the Code

Open PowerShell in the project folder and run:

```powershell
cd "C:\Users\SANCHIT\Desktop\clg\i2it-smart-library-3d"

# Initialize git
git init
git lfs install

# Track large files via LFS
git lfs track "*.mp4"

# Add everything
git add .
git commit -m "Initial commit: I²IT Smart Library System"

# Connect to your GitHub repo (replace YOUR-USERNAME)
git remote add origin https://github.com/YOUR-USERNAME/i2it-smart-library-3d.git

# Push
git branch -M main
git push -u origin main
```

### Step 4 — Enable GitHub Pages

1. Go to your repo on GitHub
2. Click **Settings** tab
3. Click **Pages** in the left sidebar
4. Under **Source**, select **GitHub Actions**
5. The workflow (`deploy.yml`) will auto-run and deploy your site

### Step 5 — Open on Any Device

Your site will be live at:
```
https://YOUR-USERNAME.github.io/i2it-smart-library-3d/
```

Open this URL on your **phone, tablet, or any PC** — the occupancy count syncs in real-time across all of them! 📱💻

---

## 🔄 How Real-Time Sync Works (from GitHub Pages)

The sync uses **[ntfy.sh](https://ntfy.sh)** — a free, open-source pub/sub notification service:

```
Device A (Admin panel) ──► ntfy.sh cloud ──► Device B (Phone)
        +1 student                              sees update in ~1s
```

| Mechanism | Speed | How |
|-----------|-------|-----|
| SSE (Server-Sent Events) | Instant | ntfy.sh push stream |
| Polling fallback | ~1 second | JSON fetch every 1s |
| Cross-tab (same PC) | <1ms | BroadcastChannel API |

**Works from GitHub Pages** because all sync is client-side JavaScript calling ntfy.sh — no backend server needed.

---

## 🖥️ Run Locally (for development)

```powershell
cd "C:\Users\SANCHIT\Desktop\clg\i2it-smart-library-3d"
.\server.ps1
```

The server will show:
- **Local:** `http://localhost:8080/`
- **Network (phone/other PC):** `http://YOUR-LAN-IP:8080/`

---

## 🔐 Admin Access

- Click **Admin Portal** button in the header
- Password: `admin@11223344`
- Controls: Enter/Exit students, adjust count, reset

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | Vanilla HTML5 + CSS3 |
| Logic | Vanilla JavaScript (ES6+) |
| 3D/Animation | Three.js, Tween.js |
| Real-Time Sync | ntfy.sh (SSE + HTTP) |
| Hosting | GitHub Pages (static) |
| Audio | Web Audio API |
