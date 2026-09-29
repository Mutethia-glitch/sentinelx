param([switch]$ExpectDenied, [switch]$Raw)
$ErrorActionPreference = 'Stop'
$origin = if ($env:APP_ORIGIN) { $env:APP_ORIGIN } else { 'http://localhost:3000' }
$email = Read-Host 'Your SentinelX application login email'
$passphrase = Read-Host 'Your APPLICATION passphrase' -AsSecureString
$credential = [System.Net.NetworkCredential]::new('', $passphrase)
$loginBody = @{ email = $email; password = $credential.Password } | ConvertTo-Json -Compress
$session = $null
try {
    $null = Invoke-RestMethod -Method Post -Uri "$origin/api/auth/login" -Headers @{ Origin = $origin } -ContentType 'application/json' -Body $loginBody -SessionVariable session
    $endpoint = if ($Raw) { "$origin/api/events/raw" } else { "$origin/api/events" }
    $fixtureName = if ($Raw) { 'raw-flat.json' } else { 'simulated-login.json' }
    $fixturePath = Join-Path $PSScriptRoot "../fixtures/events/$fixtureName"
    $event = Get-Content -LiteralPath $fixturePath -Raw | ConvertFrom-Json
    $now = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
    if ($Raw) { $event.rawData.time = $now } else { $event.timestamp = $now }
    $body = $event | ConvertTo-Json -Depth 10 -Compress
    if ($ExpectDenied) {
        $denied = $false
        try { $null = Invoke-RestMethod -Method Post -Uri $endpoint -Headers @{ Origin = $origin } -ContentType 'application/json' -Body $body -WebSession $session }
        catch { if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 403) { $denied = $true } else { throw } }
        if (-not $denied) { throw 'Expected permission rejection.' }
        Write-Host 'Viewer ingestion permission rejection verified.'
    } else {
        $receipt = Invoke-RestMethod -Method Post -Uri $endpoint -Headers @{ Origin = $origin } -ContentType 'application/json' -Body $body -WebSession $session
        if (-not $receipt.event.id) { throw 'Missing event receipt.' }
        if ($Raw) { $event.format = 'unsupported' } else { $event.severity = 'INVALID' }
        $invalidBody = $event | ConvertTo-Json -Depth 10 -Compress
        $rejected = $false
        try { $null = Invoke-RestMethod -Method Post -Uri $endpoint -Headers @{ Origin = $origin } -ContentType 'application/json' -Body $invalidBody -WebSession $session }
        catch { if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 400) { $rejected = $true } else { throw } }
        if (-not $rejected) { throw 'Expected validation rejection.' }
        if ($Raw) { Write-Host 'Raw normalization API and malformed input rejection verified.' } else { Write-Host 'Event ingestion and invalid payload rejection verified.' }
        Write-Host "Synthetic event receipt: $($receipt.event.id)"
    }
} catch {
    Write-Host 'Ingestion verification failed. Check application credentials, role, approved source and running server locally.'
    exit 1
} finally {
    if ($session) {
        try { $null = Invoke-RestMethod -Method Post -Uri "$origin/api/auth/logout" -Headers @{ Origin = $origin } -ContentType 'application/json' -Body '{}' -WebSession $session } catch { Write-Host 'Verification session logout failed. Check locally.' }
    }
    Remove-Variable passphrase,credential,loginBody,body,invalidBody -ErrorAction SilentlyContinue
}
