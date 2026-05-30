Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$script:serverProcess = $null
$script:pollTimer = $null
$script:localIP = "127.0.0.1"

function Get-LocalIP {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback|Bluetooth|Virtual|vEthernet' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -First 1).IPAddress
    if (-not $ip) { $ip = "127.0.0.1" }
    return $ip
}

function Start-Server {
    $btnStart.Enabled = $false
    $btnStop.Enabled = $true
    $status.Text = "Starting..."
    $status.ForeColor = "#fbbf24"
    $urlBox.Text = ""
    $lanUrl.Text = ""
    $script:localIP = Get-LocalIP

    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo.FileName = "cmd.exe"
    $proc.StartInfo.Arguments = "/c npm run dev -- --host 0.0.0.0 --port 5173"
    $proc.StartInfo.WorkingDirectory = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
    $proc.StartInfo.RedirectStandardOutput = $true
    $proc.StartInfo.RedirectStandardError = $true
    $proc.StartInfo.UseShellExecute = $false
    $proc.StartInfo.CreateNoWindow = $true
    $proc.EnableRaisingEvents = $true
    $proc.Start() | Out-Null
    $proc.BeginOutputReadLine()
    $proc.BeginErrorReadLine()
    $script:serverProcess = $proc

    $script:pollTimer = New-Object System.Windows.Forms.Timer
    $script:pollTimer.Interval = 300
    $script:pollTimer.Add_Tick({
        if ($script:serverProcess -and !$script:serverProcess.HasExited) {
            if ($urlBox.Text -eq "") {
                $urlBox.Text = "http://localhost:5173"
                $lanUrl.Text = "http://$($script:localIP):5173"
                $status.Text = "Running"
                $status.ForeColor = "#22c55e"
            }
        } else {
            $script:pollTimer.Stop()
            if ($btnStart.Enabled -eq $false) {
                $btnStart.Enabled = $true
                $btnStop.Enabled = $false
                $status.Text = "Stopped"
                $status.ForeColor = "#ef4444"
            }
        }
    })
    $script:pollTimer.Start()
}

function Stop-Server {
    if ($script:pollTimer) {
        $script:pollTimer.Stop()
        $script:pollTimer.Dispose()
        $script:pollTimer = $null
    }
    if ($script:serverProcess -and !$script:serverProcess.HasExited) {
        $script:serverProcess.Kill()
        $script:serverProcess.Dispose()
        $script:serverProcess = $null
    }
    $btnStart.Enabled = $true
    $btnStop.Enabled = $false
    $status.Text = "Stopped"
    $status.ForeColor = "#ef4444"
}

$form = New-Object System.Windows.Forms.Form
$form.Text = "FigmaLite Server"
$form.Size = New-Object System.Drawing.Size(480, 310)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedSingle"
$form.MaximizeBox = $false
$form.BackColor = "#0a0a0a"

$title = New-Object System.Windows.Forms.Label
$title.Text = "FigmaLite Dev Server"
$title.Font = New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)
$title.ForeColor = "#f8fafc"
$title.Size = New-Object System.Drawing.Size(440, 30)
$title.Location = New-Object System.Drawing.Point(20, 16)
$form.Controls.Add($title)

$status = New-Object System.Windows.Forms.Label
$status.Text = "Ready"
$status.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$status.ForeColor = "#94a3b8"
$status.Size = New-Object System.Drawing.Size(440, 20)
$status.Location = New-Object System.Drawing.Point(20, 50)
$form.Controls.Add($status)

$btnStart = New-Object System.Windows.Forms.Button
$btnStart.Text = "Start Server"
$btnStart.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
$btnStart.ForeColor = "White"
$btnStart.BackColor = "#2563eb"
$btnStart.FlatStyle = "Flat"
$btnStart.FlatAppearance.BorderSize = 0
$btnStart.Size = New-Object System.Drawing.Size(210, 40)
$btnStart.Location = New-Object System.Drawing.Point(20, 82)
$btnStart.Add_Click({ Start-Server })
$form.Controls.Add($btnStart)

$btnStop = New-Object System.Windows.Forms.Button
$btnStop.Text = "Stop Server"
$btnStop.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
$btnStop.ForeColor = "White"
$btnStop.BackColor = "#dc2626"
$btnStop.FlatStyle = "Flat"
$btnStop.FlatAppearance.BorderSize = 0
$btnStop.Enabled = $false
$btnStop.Size = New-Object System.Drawing.Size(210, 40)
$btnStop.Location = New-Object System.Drawing.Point(240, 82)
$btnStop.Add_Click({ Stop-Server })
$form.Controls.Add($btnStop)

$labelLocal = New-Object System.Windows.Forms.Label
$labelLocal.Text = "Local:"
$labelLocal.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$labelLocal.ForeColor = "#64748b"
$labelLocal.Size = New-Object System.Drawing.Size(50, 26)
$labelLocal.Location = New-Object System.Drawing.Point(20, 144)
$form.Controls.Add($labelLocal)

$urlBox = New-Object System.Windows.Forms.TextBox
$urlBox.ReadOnly = $true
$urlBox.Font = New-Object System.Drawing.Font("Consolas", 10)
$urlBox.ForeColor = "#60a5fa"
$urlBox.BackColor = "#1e1e1e"
$urlBox.BorderStyle = "FixedSingle"
$urlBox.Size = New-Object System.Drawing.Size(290, 24)
$urlBox.Location = New-Object System.Drawing.Point(70, 142)
$form.Controls.Add($urlBox)

$btnCopyLocal = New-Object System.Windows.Forms.Button
$btnCopyLocal.Text = "Copy"
$btnCopyLocal.Font = New-Object System.Drawing.Font("Segoe UI", 8)
$btnCopyLocal.ForeColor = "#94a3b8"
$btnCopyLocal.BackColor = "#1e1e1e"
$btnCopyLocal.FlatStyle = "Flat"
$btnCopyLocal.FlatAppearance.BorderSize = 1
$btnCopyLocal.Size = New-Object System.Drawing.Size(70, 26)
$btnCopyLocal.Location = New-Object System.Drawing.Point(370, 140)
$btnCopyLocal.Add_Click({
    if ($urlBox.Text) {
        [System.Windows.Forms.Clipboard]::SetText($urlBox.Text)
        $btnCopyLocal.Text = "Copied!"
        $t = New-Object System.Windows.Forms.Timer
        $t.Interval = 1500
        $t.Add_Tick({ $btnCopyLocal.Text = "Copy"; $this.Stop(); $this.Dispose() })
        $t.Start()
    }
})
$form.Controls.Add($btnCopyLocal)

$labelLan = New-Object System.Windows.Forms.Label
$labelLan.Text = "Network:"
$labelLan.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$labelLan.ForeColor = "#64748b"
$labelLan.Size = New-Object System.Drawing.Size(50, 26)
$labelLan.Location = New-Object System.Drawing.Point(20, 180)
$form.Controls.Add($labelLan)

$lanUrl = New-Object System.Windows.Forms.TextBox
$lanUrl.ReadOnly = $true
$lanUrl.Font = New-Object System.Drawing.Font("Consolas", 10)
$lanUrl.ForeColor = "#34d399"
$lanUrl.BackColor = "#1e1e1e"
$lanUrl.BorderStyle = "FixedSingle"
$lanUrl.Size = New-Object System.Drawing.Size(290, 24)
$lanUrl.Location = New-Object System.Drawing.Point(70, 178)
$form.Controls.Add($lanUrl)

$btnCopyLan = New-Object System.Windows.Forms.Button
$btnCopyLan.Text = "Copy"
$btnCopyLan.Font = New-Object System.Drawing.Font("Segoe UI", 8)
$btnCopyLan.ForeColor = "#94a3b8"
$btnCopyLan.BackColor = "#1e1e1e"
$btnCopyLan.FlatStyle = "Flat"
$btnCopyLan.FlatAppearance.BorderSize = 1
$btnCopyLan.Size = New-Object System.Drawing.Size(70, 26)
$btnCopyLan.Location = New-Object System.Drawing.Point(370, 176)
$btnCopyLan.Add_Click({
    if ($lanUrl.Text) {
        [System.Windows.Forms.Clipboard]::SetText($lanUrl.Text)
        $btnCopyLan.Text = "Copied!"
        $t = New-Object System.Windows.Forms.Timer
        $t.Interval = 1500
        $t.Add_Tick({ $btnCopyLan.Text = "Copy"; $this.Stop(); $this.Dispose() })
        $t.Start()
    }
})
$form.Controls.Add($btnCopyLan)

$hint = New-Object System.Windows.Forms.Label
$hint.Text = "Phone must be on the same WiFi network"
$hint.Font = New-Object System.Drawing.Font("Segoe UI", 8)
$hint.ForeColor = "#475569"
$hint.Size = New-Object System.Drawing.Size(380, 20)
$hint.Location = New-Object System.Drawing.Point(20, 220)
$form.Controls.Add($hint)

$form.Add_FormClosed({ Stop-Server })
$form.ShowDialog()
