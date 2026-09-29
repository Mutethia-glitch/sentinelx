param([switch]$ExpectDenied)
$ErrorActionPreference = 'Stop'
$origin = if ($env:APP_ORIGIN) { $env:APP_ORIGIN } else { 'http://localhost:3000' }
$email = Read-Host 'Your SentinelX application login email'
$passphrase = Read-Host 'Your APPLICATION passphrase' -AsSecureString
$credential = [System.Net.NetworkCredential]::new('', $passphrase)
$loginBody = @{ email = $email; password = $credential.Password } | ConvertTo-Json -Compress
$session = $null
$ruleId = $null
function Assert-Rejected([scriptblock]$Action, [int]$ExpectedStatus) {
    $rejected = $false
    try { $null = & $Action }
    catch { if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq $ExpectedStatus) { $rejected = $true } else { throw } }
    if (-not $rejected) { throw 'Expected request rejection.' }
}
try {
    $null = Invoke-RestMethod -Method Post -Uri "$origin/api/auth/login" -Headers @{ Origin = $origin } -ContentType 'application/json' -Body $loginBody -SessionVariable session
    $fixturePath = Join-Path $PSScriptRoot '../fixtures/rules/simulated-authentication.json'
    $fixture = Get-Content -LiteralPath $fixturePath -Raw | ConvertFrom-Json
    $fixture.name = "Synthetic Task 12 verification $([Guid]::NewGuid().ToString('N'))"
    $body = $fixture | ConvertTo-Json -Depth 10 -Compress
    if ($ExpectDenied) {
        Assert-Rejected { Invoke-RestMethod -Uri "$origin/api/rules" -WebSession $session } 403
        Assert-Rejected { Invoke-RestMethod -Method Post -Uri "$origin/api/rules/validate" -Headers @{ Origin = $origin } -ContentType 'application/json' -Body $body -WebSession $session } 403
        Write-Host 'Viewer rule access and management rejection verified.'
    } else {
        $validation = Invoke-RestMethod -Method Post -Uri "$origin/api/rules/validate" -Headers @{ Origin = $origin } -ContentType 'application/json' -Body $body -WebSession $session
        if (-not $validation.valid) { throw 'Rule validation failed.' }
        $fixture.threshold = 0
        $invalidBody = $fixture | ConvertTo-Json -Depth 10 -Compress
        Assert-Rejected { Invoke-RestMethod -Method Post -Uri "$origin/api/rules/validate" -Headers @{ Origin = $origin } -ContentType 'application/json' -Body $invalidBody -WebSession $session } 400
        $fixture.threshold = 5
        $created = Invoke-RestMethod -Method Post -Uri "$origin/api/rules" -Headers @{ Origin = $origin } -ContentType 'application/json' -Body $body -WebSession $session
        $ruleId = $created.rule.id
        if (-not $ruleId -or $created.rule.enabled -or $created.rule.version -ne 1) { throw 'Unexpected creation result.' }
        $fixture | Add-Member -NotePropertyName version -NotePropertyValue $created.rule.version
        $fixture.enabled = $true
        $fixture.threshold = 7
        $fixture.reason = 'Verify editing and explicitly enabling synthetic rule configuration'
        $updateBody = $fixture | ConvertTo-Json -Depth 10 -Compress
        $updated = Invoke-RestMethod -Method Put -Uri "$origin/api/rules/$ruleId" -Headers @{ Origin = $origin } -ContentType 'application/json' -Body $updateBody -WebSession $session
        if (-not $updated.rule.enabled -or $updated.rule.version -ne 2 -or $updated.rule.definition.threshold -ne 7) { throw 'Unexpected update result.' }
        Assert-Rejected { Invoke-RestMethod -Method Put -Uri "$origin/api/rules/$ruleId" -Headers @{ Origin = $origin } -ContentType 'application/json' -Body $updateBody -WebSession $session } 409
        $fixture.version = $updated.rule.version
        $fixture.enabled = $false
        $fixture.reason = 'Leave synthetic verification rule disabled'
        $disableBody = $fixture | ConvertTo-Json -Depth 10 -Compress
        $disabled = Invoke-RestMethod -Method Put -Uri "$origin/api/rules/$ruleId" -Headers @{ Origin = $origin } -ContentType 'application/json' -Body $disableBody -WebSession $session
        $loaded = Invoke-RestMethod -Uri "$origin/api/rules/$ruleId" -WebSession $session
        if ($disabled.rule.enabled -or $loaded.rule.enabled -or $loaded.rule.version -ne 3 -or $loaded.rule.categoryCode -ne 'BRUTE_FORCE' -or $loaded.rule.mitreTechniqueIds -notcontains 'T1110') { throw 'Unexpected persisted configuration.' }
        Write-Host 'Rule creation, editing, enable/disable, validation and version protection verified.'
        Write-Host "Synthetic rule receipt: $ruleId (left disabled)"
    }
} catch {
    Write-Host 'Rule verification failed. Check application credentials, role, migrations, selectable category and running server locally.'
    exit 1
} finally {
    if ($session) {
        if ($ruleId) {
            try {
                $latest = Invoke-RestMethod -Uri "$origin/api/rules/$ruleId" -WebSession $session
                if ($latest.rule.enabled) {
                    $cleanup = Get-Content -LiteralPath $fixturePath -Raw | ConvertFrom-Json
                    $cleanup.name = $fixture.name
                    $cleanup.enabled = $false
                    $cleanup.reason = 'Disable synthetic verification rule after checking'
                    $cleanup | Add-Member -NotePropertyName version -NotePropertyValue $latest.rule.version
                    $cleanupBody = $cleanup | ConvertTo-Json -Depth 10 -Compress
                    $null = Invoke-RestMethod -Method Put -Uri "$origin/api/rules/$ruleId" -Headers @{ Origin = $origin } -ContentType 'application/json' -Body $cleanupBody -WebSession $session
                }
            } catch { Write-Host 'Synthetic rule cleanup failed. Check the saved rule locally before continuing.' }
        }
        try { $null = Invoke-RestMethod -Method Post -Uri "$origin/api/auth/logout" -Headers @{ Origin = $origin } -ContentType 'application/json' -Body '{}' -WebSession $session } catch { Write-Host 'Verification session logout failed. Check locally.' }
    }
    Remove-Variable passphrase,credential,loginBody,body,invalidBody,updateBody,disableBody,cleanupBody -ErrorAction SilentlyContinue
}
