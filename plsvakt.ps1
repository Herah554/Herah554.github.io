# plsvakt.ps1 — vaktbikkje for nettverkslinken til PLS-en
# ==========================================================
# Pinger PLS-en. Svarer den ikke tre ganger paa rad, restartes
# nettverkskortet — det samme som aa disable/enable det for haand.
# Hvert brudd logges med tidspunkt i plsvakt.log, saa vi ser hvor
# ofte det ryker. Det er diagnose i seg selv.
#
# KJOERES SOM ADMINISTRATOR (Restart-NetAdapter krever det):
#   Hoyreklikk PowerShell -> Kjor som administrator, saa:
#   cd C:\Users\Teknisk-Felles\Documents\Bridge
#   powershell -ExecutionPolicy Bypass -File .\plsvakt.ps1
#
# Dette er et PLASTER som holder driften oppe mens rotaarsaken finnes.
# Det fjerner symptomet, ikke feilen.

$PLS  = "192.168.10.1"
$KORT = "Ethernet"          # navnet fra Get-NetAdapter
$FEIL_FOR_RESTART = 3       # pingfeil paa rad foer kortet restartes
$PAUSE_SEK = 5              # sekunder mellom hver ping
$LOGG = Join-Path $PSScriptRoot "plsvakt.log"

function Logg($tekst) {
    $linje = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $tekst
    Write-Host $linje
    Add-Content -Path $LOGG -Value $linje -Encoding UTF8
}

# .NET Ping er raskere og mer forutsigbar enn Test-Connection i PowerShell 5.1
$pinger = New-Object System.Net.NetworkInformation.Ping

Logg "=== plsvakt startet — pinger $PLS hvert $PAUSE_SEK s, restarter '$KORT' etter $FEIL_FOR_RESTART feil ==="
$feil = 0
$antallRestarter = 0
$sistOk = Get-Date

while ($true) {
    $ok = $false
    try {
        $svar = $pinger.Send($PLS, 1500)
        $ok = ($svar.Status -eq [System.Net.NetworkInformation.IPStatus]::Success)
    } catch { $ok = $false }

    if ($ok) {
        if ($feil -gt 0) { Logg "PLS svarer igjen (etter $feil feil)" }
        $feil = 0
        $sistOk = Get-Date
    } else {
        $feil++
        $status = (Get-NetAdapter -Name $KORT -ErrorAction SilentlyContinue).Status
        Logg "ping feilet ($feil/$FEIL_FOR_RESTART) — kortet er '$status'"
        if ($feil -ge $FEIL_FOR_RESTART) {
            $oppetid = [int]((Get-Date) - $sistOk).TotalSeconds
            $antallRestarter++
            Logg "BRUDD nr. $antallRestarter — linken holdt $oppetid s. Restarter '$KORT' ..."
            try {
                Restart-NetAdapter -Name $KORT -ErrorAction Stop
                Logg "Kortet restartet, venter 10 s paa link"
            } catch {
                Logg "FEIL ved restart: $($_.Exception.Message) — kjorer du som administrator?"
            }
            Start-Sleep -Seconds 10
            $feil = 0
        }
    }
    Start-Sleep -Seconds $PAUSE_SEK
}
