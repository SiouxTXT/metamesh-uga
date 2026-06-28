# Deploy all MetaMesh-UGA Workers
$workers = @(
    "discovery",
    "aggregator", 
    "inserter",
    "updater",
    "eliminatore",
    "alerts",
    "agent-billing",
    "gateway"
)

$results = @()

foreach ($worker in $workers) {
    Write-Host "Deploying $worker..." -ForegroundColor Cyan
    try {
        $output = & wrangler deploy --config "packages/$worker/wrangler.toml" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ $worker deployed" -ForegroundColor Green
            $results += @{ Worker = $worker; Status = "SUCCESS"; Output = $output }
        } else {
            Write-Host "  ❌ $worker failed" -ForegroundColor Red
            $results += @{ Worker = $worker; Status = "FAILED"; Output = $output }
        }
    } catch {
        Write-Host "  ❌ $worker error: $_" -ForegroundColor Red
        $results += @{ Worker = $worker; Status = "ERROR"; Output = $_.Exception.Message }
    }
}

# Summary
Write-Host "`n=== DEPLOY SUMMARY ===" -ForegroundColor Yellow
$success = ($results | Where-Object { $_.Status -eq "SUCCESS" }).Count
$failed = ($results | Where-Object { $_.Status -ne "SUCCESS" }).Count
Write-Host "Success: $success / $($workers.Count)" -ForegroundColor Green
Write-Host "Failed: $failed / $($workers.Count)" -ForegroundColor Red

# Save results
$results | ConvertTo-Json -Depth 3 | Set-Content "deploy-results.json"
Write-Host "`nResults saved to deploy-results.json" -ForegroundColor Cyan
