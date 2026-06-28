# MetaMesh-UGA - Deploy Completo a Regime
# Esegue deploy di tutti i workers e verifica lo stato

$ErrorActionPreference = "Continue"
$workers = @("discovery", "aggregator", "inserter", "updater", "eliminatore", "alerts", "agent-billing", "gateway")
$results = @()
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$logDir = "deploy-logs-$timestamp"
New-Item -ItemType Directory -Force -Path $logDir

Write-Host "=== METAMESH-UGA DEPLOY FINALE ===" -ForegroundColor Cyan
Write-Host "Timestamp: $timestamp" -ForegroundColor Gray
Write-Host ""

# 1. DEPLOY WORKERS
Write-Host "STEP 1: Deploy Workers (8 total)" -ForegroundColor Yellow
foreach ($worker in $workers) {
    Write-Host "  Deploying $worker..." -NoNewline -ForegroundColor Cyan
    try {
        $logFile = "$logDir\$worker-deploy.log"
        $output = & wrangler deploy 2>&1 | Tee-Object -FilePath $logFile
        
        if ($output -match "Successfully published" -or $output -match "Deployed") {
            Write-Host " ✅ SUCCESS" -ForegroundColor Green
            $results += @{ Name = $worker; Status = "SUCCESS"; Log = $logFile }
        } else {
            Write-Host " ❌ FAILED" -ForegroundColor Red
            $results += @{ Name = $worker; Status = "FAILED"; Log = $logFile; Error = $output }
        }
    } catch {
        Write-Host " ❌ ERROR" -ForegroundColor Red
        $results += @{ Name = $worker; Status = "ERROR"; Log = $logFile; Error = $_.Exception.Message }
    }
    Set-Location ..
}

# 2. SUMMARY
Write-Host ""
Write-Host "=== DEPLOY SUMMARY ===" -ForegroundColor Yellow
$successCount = ($results | Where-Object { $_.Status -eq "SUCCESS" }).Count
$failedCount = ($results | Where-Object { $_.Status -ne "SUCCESS" }).Count
Write-Host "Success: $successCount / 8" -ForegroundColor Green
Write-Host "Failed:  $failedCount / 8" -ForegroundColor $(if($failedCount -gt 0){"Red"}else{"Green"})

# 3. HEALTH CHECK (solo se workers deployati)
if ($successCount -gt 0) {
    Write-Host ""
    Write-Host "STEP 2: Health Check" -ForegroundColor Yellow
    try {
        $health = Invoke-RestMethod -Uri "https://api.metamesh-uga.dev/health" -TimeoutSec 10
        Write-Host "  API Gateway: " -NoNewline
        if ($health.status -eq "healthy") {
            Write-Host "✅ HEALTHY" -ForegroundColor Green
        } else {
            Write-Host "⚠️ DEGRADED" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  API Gateway: ❌ UNREACHABLE" -ForegroundColor Red
    }
    
    try {
        $tools = Invoke-RestMethod -Uri "https://api.metamesh-uga.dev/v1/tools" -TimeoutSec 10
        Write-Host "  Tools Count: $($tools.total)" -ForegroundColor Cyan
    } catch {
        Write-Host "  Tools API: ❌ ERROR" -ForegroundColor Red
    }
}

# 4. SAVE REPORT
$report = @{
    timestamp = Get-Date -Format "o"
    status = if($successCount -eq 8){"OPERATIONAL"}elseif($successCount -gt 0){"PARTIAL"}else{"FAILED"}
    workers_deployed = $successCount
    workers_total = 8
    workers = $results
}
$report | ConvertTo-Json -Depth 5 | Set-Content "$logDir\deploy-report.json"

Write-Host ""
Write-Host "Report saved to: $logDir\deploy-report.json" -ForegroundColor Cyan
Write-Host ""
Write-Host "=== METAMESH-UGA DEPLOY COMPLETE ===" -ForegroundColor $(if($successCount -eq 8){"Green"}else{"Yellow"})
