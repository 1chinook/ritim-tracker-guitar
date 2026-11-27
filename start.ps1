param(
    [switch]$NoBrowser,
    [switch]$StopOnly
)

$ErrorActionPreference = 'Stop'
try {
    [Console]::InputEncoding = [System.Text.Encoding]::UTF8
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

$ProjectName = 'ritim-izi-gitar'
$OpenUrl = 'http://127.0.0.1:3002'
$ProjectDir = $PSScriptRoot

function Get-ListeningPids {
    param([Parameter(Mandatory = $true)][int]$Port)

    $pids = New-Object 'System.Collections.Generic.HashSet[int]'
    try {
        $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        foreach ($conn in $conns) {
            if ($conn.OwningProcess -gt 4 -and $conn.OwningProcess -ne $PID) {
                [void]$pids.Add([int]$conn.OwningProcess)
            }
        }
    } catch {}

    $prevEap = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $netstatLines = & netstat.exe -ano -p TCP 2>$null
    } finally {
        $ErrorActionPreference = $prevEap
    }

    foreach ($line in $netstatLines) {
        if ($line -match "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$") {
            $foundPid = [int]$Matches[1]
            if ($foundPid -gt 4 -and $foundPid -ne $PID) {
                [void]$pids.Add($foundPid)
            }
        }
    }
    return @($pids)
}

function Stop-ProcessTreeSafe {
    param([Parameter(Mandatory = $true)][int]$TargetPid)
    $prevEap = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & taskkill.exe /F /T /PID $TargetPid *> $null
    } finally {
        $ErrorActionPreference = $prevEap
    }
    Stop-Process -Id $TargetPid -Force -ErrorAction SilentlyContinue
}

function Stop-PortProcess {
    param([Parameter(Mandatory = $true)][int]$Port)

    $pidFile = Join-Path $env:TEMP ("projects-launcher-port-{0}.pid" -f $Port)
    if (Test-Path -LiteralPath $pidFile) {
        $rawPidLine = (Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
        if ($rawPidLine) {
            $parts = $rawPidLine.Trim().Split('|')
            $wrapperPid = 0
            [long]$expectedTicks = 0
            if ([int]::TryParse($parts[0], [ref]$wrapperPid) -and $wrapperPid -gt 4 -and $wrapperPid -ne $PID) {
                if ($parts.Length -gt 1) { [void][long]::TryParse($parts[1], [ref]$expectedTicks) }
                $proc = Get-Process -Id $wrapperPid -ErrorAction SilentlyContinue
                if ($proc -and $proc.ProcessName -match '^(powershell|pwsh)$') {
                    $matchesStart = $true
                    if ($expectedTicks -gt 0) {
                        try { $matchesStart = ($proc.StartTime.ToFileTimeUtc() -eq $expectedTicks) } catch { $matchesStart = $false }
                    }
                    if ($matchesStart) {
                        Write-Host "  [Temizlik] Onceki baslatici penceresi kapatiliyor (PID: $wrapperPid, Port: $Port)..." -ForegroundColor Yellow
                        Stop-ProcessTreeSafe -TargetPid $wrapperPid
                    }
                }
            }
        }
        Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
    }

    $listeningPids = Get-ListeningPids -Port $Port
    foreach ($targetPid in $listeningPids) {
        $proc = Get-Process -Id $targetPid -ErrorAction SilentlyContinue
        $procName = if ($proc) { $proc.ProcessName } else { 'bilinmeyen' }
        Write-Host "  [Temizlik] Port $Port uzerindeki eski surec sonlandiriliyor ($procName, PID: $targetPid)..." -ForegroundColor Yellow
        Stop-ProcessTreeSafe -TargetPid $targetPid
    }

    $deadline = (Get-Date).AddSeconds(6)
    while ((Get-Date) -lt $deadline) {
        if ((Get-ListeningPids -Port $Port).Count -eq 0) {
            return
        }
        Start-Sleep -Milliseconds 200
    }

    $remaining = Get-ListeningPids -Port $Port
    if ($remaining.Count -gt 0) {
        throw "Port $Port bosaltilamadi. Kalan PID'ler: $($remaining -join ', ')"
    }
}

function Test-TcpPort {
    param([Parameter(Mandatory = $true)][int]$Port)
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $task = $client.ConnectAsync('127.0.0.1', $Port)
        return ($task.Wait(300) -and $client.Connected)
    } catch {
        return $false
    } finally {
        $client.Dispose()
    }
}

function Wait-ServiceReady {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][int]$Port,
        [Parameter(Mandatory = $true)][string]$HealthUrl,
        [int]$TimeoutSec = 30,
        [System.Diagnostics.Process]$WrapperProcess = $null
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if ($null -ne $WrapperProcess -and $WrapperProcess.HasExited -and -not (Test-TcpPort -Port $Port)) {
            throw "$Name servisi beklenmedik sekilde kapandi (Cikis kodu: $($WrapperProcess.ExitCode))."
        }
        if (Test-TcpPort -Port $Port) {
            try {
                $response = Invoke-WebRequest -UseBasicParsing -Uri $HealthUrl -TimeoutSec 2 -ErrorAction Stop
                if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                    return
                }
            } catch {}
        }
        Start-Sleep -Milliseconds 350
    }
    throw "$Name servisi $TimeoutSec saniye icinde hazir olmadi ($HealthUrl)."
}

try {
    Write-Host "=== $ProjectName ===" -ForegroundColor Cyan

    Stop-PortProcess -Port 3002
    if ($StopOnly) {
        Write-Host "[OK] $ProjectName durduruldu (Port: 3002)." -ForegroundColor Green
        exit 0
    }

    $nodeCmd = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $nodeCmd) {
        throw "Node.js bulunamadi. Lutfen Node.js kurun."
    }

    if ((Test-Path -LiteralPath (Join-Path $ProjectDir 'package.json')) -and -not (Test-Path -LiteralPath (Join-Path $ProjectDir 'node_modules'))) {
        $npmCmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
        if (-not $npmCmd) {
            throw "node_modules eksik ancak npm.cmd bulunamadi."
        }
        Write-Host "[Kurulum] node_modules eksik; npm install calistiriliyor..." -ForegroundColor Yellow
        Push-Location $ProjectDir
        try {
            & $npmCmd.Source install
            if ($LASTEXITCODE -ne 0) {
                throw "npm install basarisiz oldu (Cikis kodu: $LASTEXITCODE)."
            }
        } finally {
            Pop-Location
        }
    }

    $Services = @(
        @{
            Name         = 'Ritim Izi Gitar Web'
            Port         = 3002
            WorkDir      = $ProjectDir
            HealthUrl    = 'http://127.0.0.1:3002/'
            WindowTitle  = 'ritim-izi-gitar [Port 3002]'
            TimeoutSec   = 30
            StartCommand = "& '$($nodeCmd.Source.Replace("'", "''"))' scripts/serve.mjs"
        }
    )

    $launched = @()
    foreach ($svc in $Services) {
        $titleEscaped = $svc.WindowTitle.Replace("'", "''")
        $dirEscaped = $svc.WorkDir.Replace("'", "''")
        $childScript = @"
try { `$Host.UI.RawUI.WindowTitle = '$titleEscaped' } catch {}
Set-Location -LiteralPath '$dirEscaped'
`$env:PORT = '$($svc.Port)'
Write-Host '========================================' -ForegroundColor Cyan
Write-Host '  $titleEscaped' -ForegroundColor Green
Write-Host '  URL: $OpenUrl' -ForegroundColor Cyan
Write-Host '  Kapatmak icin Ctrl+C veya pencereyi kapatin.' -ForegroundColor DarkGray
Write-Host '========================================' -ForegroundColor Cyan
$($svc.StartCommand)
"@
        $encoded = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($childScript))
        $proc = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', $encoded) -WorkingDirectory $svc.WorkDir -PassThru
        $pidFile = Join-Path $env:TEMP ("projects-launcher-port-{0}.pid" -f $svc.Port)
        $startTicks = try { $proc.StartTime.ToFileTimeUtc() } catch { 0 }
        Set-Content -LiteralPath $pidFile -Value ("{0}|{1}" -f $proc.Id, $startTicks) -Encoding ASCII
        $launched += @{ Service = $svc; Process = $proc }
        Write-Host "[Baslatildi] $($svc.Name) -> Port $($svc.Port) (Pencere PID: $($proc.Id))" -ForegroundColor Green
    }

    foreach ($item in $launched) {
        $svc = $item.Service
        Write-Host "[Bekleniyor] $($svc.Name) saglik kontrolu ($($svc.HealthUrl))..." -ForegroundColor Cyan
        Wait-ServiceReady -Name $svc.Name -Port $svc.Port -HealthUrl $svc.HealthUrl -TimeoutSec $svc.TimeoutSec -WrapperProcess $item.Process
        Write-Host "[Hazir] $($svc.Name) -> $($svc.HealthUrl)" -ForegroundColor Green
    }

    if (-not $NoBrowser) {
        Write-Host "[Tarayici] Aciliyor: $OpenUrl" -ForegroundColor Cyan
        Start-Process $OpenUrl
    }
    exit 0
} catch {
    Write-Host "[HATA] $($_.Exception.Message)" -ForegroundColor Red
    if (-not $NoBrowser -and [Environment]::UserInteractive) {
        try { $null = Read-Host 'Cikmak icin Enter tusuna basin' } catch {}
    }
    exit 1
}
