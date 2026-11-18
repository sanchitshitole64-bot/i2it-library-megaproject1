param(
    [int]$port = 8080,
    [switch]$NoBrowser
)

$folder = $PSScriptRoot

# ============================================================
# Discover local LAN IP for phone/multi-device access
# ============================================================
$lanIP = $null
try {
    $lanIP = (Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object { $_.PrefixOrigin -eq 'Dhcp' -or ($_.PrefixOrigin -eq 'Manual' -and $_.IPAddress -notlike '169.*') } |
        Select-Object -First 1).IPAddress
} catch {}

if (-not $lanIP) {
    # Fallback: pick first non-loopback non-link-local IPv4
    try {
        $lanIP = (Get-NetIPAddress -AddressFamily IPv4 |
            Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.*' } |
            Select-Object -First 1).IPAddress
    } catch {}
}

# Listen on all interfaces so phones and other PCs can connect
$localPrefix  = "http://localhost:$port/"
$networkPrefix = if ($lanIP) { "http://$($lanIP):$port/" } else { $null }

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($localPrefix)
# Also bind to the network IP so other devices can reach this server
if ($networkPrefix) {
    try { $listener.Prefixes.Add($networkPrefix) } catch {}
}
# Bind wildcard so ALL network interfaces are covered (requires admin or urlacl)
try {
    $wildcardPrefix = "http://+:$port/"
    $listener2 = New-Object System.Net.HttpListener
    $listener2.Prefixes.Add($wildcardPrefix)
    $listener2.Start()
    $listener2.Stop()
    $listener.Prefixes.Clear()
    $listener.Prefixes.Add($wildcardPrefix)
} catch {
    # Wildcard failed (no admin), keep specific bindings
}

try {
    $listener.Start()

    Write-Host ""
    Write-Host "==========================================================================" -ForegroundColor Cyan
    Write-Host "   I²IT Hinjewadi - Smart Digital Library · Multi-Device Web Server" -ForegroundColor Green
    Write-Host "==========================================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   This PC / Browser:" -ForegroundColor White
    Write-Host "   --> http://localhost:$port/" -ForegroundColor Yellow
    Write-Host ""
    if ($lanIP) {
        Write-Host "   Other Devices on Same WiFi (Phone / Laptop / Tablet):" -ForegroundColor White
        Write-Host "   --> http://$($lanIP):$port/" -ForegroundColor Green
        Write-Host ""
        Write-Host "   Scan this QR on your phone (or type the URL above):" -ForegroundColor Cyan
        Write-Host "   http://$($lanIP):$port/" -ForegroundColor Green
    } else {
        Write-Host "   Network IP not detected. Run 'ipconfig' to find your IP." -ForegroundColor DarkYellow
    }
    Write-Host ""
    Write-Host "   Press Ctrl+C to stop the server." -ForegroundColor Gray
    Write-Host "==========================================================================" -ForegroundColor Cyan
    Write-Host ""

    # Launch default browser automatically unless -NoBrowser is passed
    if (-not $NoBrowser) {
        Start-Process "http://localhost:$port/"
    }

    # ============================================================
    # Request Handler Loop
    # ============================================================
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request  = $context.Request
        $response = $context.Response

        # Add CORS headers so browser fetch to ntfy.sh works fine
        $response.Headers.Add("Access-Control-Allow-Origin", "*")
        $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")

        try {
            $localPath = $request.Url.LocalPath
            if ($localPath -eq "/" -or $localPath -eq "") {
                $localPath = "/index.html"
            }

            $filePath = Join-Path $folder ($localPath.TrimStart('/').Replace('/', '\'))

            if (Test-Path $filePath -PathType Leaf) {
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $contentType = switch ($ext) {
                    ".html" { "text/html; charset=utf-8" }
                    ".css"  { "text/css; charset=utf-8" }
                    ".js"   { "application/javascript; charset=utf-8" }
                    ".json" { "application/json; charset=utf-8" }
                    ".svg"  { "image/svg+xml" }
                    ".png"  { "image/png" }
                    ".jpg"  { "image/jpeg" }
                    ".ico"  { "image/x-icon" }
                    ".mp4"  { "video/mp4" }
                    ".webm" { "video/webm" }
                    default { "application/octet-stream" }
                }

                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $response.ContentType = $contentType
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $response.StatusCode = 404
                $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $localPath")
                $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
            }
        } catch {
            # Client disconnected or canceled (expected with large video streaming)
        } finally {
            try { $response.Close() } catch {}
        }
    }
}
catch {
    Write-Host ""
    Write-Host "ERROR: Could not start server on port $port." -ForegroundColor Red
    Write-Host "If you see 'access denied', right-click PowerShell and 'Run as Administrator'." -ForegroundColor Yellow
    Write-Host "Or change port: .\server.ps1 -port 3000" -ForegroundColor Yellow
}
finally {
    try { $listener.Stop(); $listener.Close() } catch {}
}
