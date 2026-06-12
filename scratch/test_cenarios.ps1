# ============================================
# Script de Testes de Cenários PagBank (B)
# Cria 4 orders e testa 4 status diferentes
# ============================================

$headers = @{
    'Content-Type' = 'application/json'
    'Authorization' = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3d2xrcXFnZHRhcmttc3RsY292Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2ODAwNjksImV4cCI6MjA5NjI1NjA2OX0.BE99pFQgFrGtw0ywgIgt8j8Rn6qmr4yy4-PxSAa0Fcc'
}

$createUrl = 'https://iwwlkqqgdtarkmstlcov.supabase.co/functions/v1/pagbank-create-order'
$testUrl = 'https://iwwlkqqgdtarkmstlcov.supabase.co/functions/v1/pagbank-webhook-test'

$userId = '6799da45-7651-452f-8d09-d75d22591dc2'
$groupId = 'a6ab651d-a151-4a38-8d54-59989125dd33'

function Create-Order($amount, $label) {
    $body = @{
        amount = $amount
        userId = $userId
        userEmail = "cliente.teste.$([guid]::NewGuid().ToString().Substring(0,6))@example.com"
        userName = "Cliente Teste $label"
        groupId = $groupId
        groupName = "Teste $label"
    } | ConvertTo-Json -Compress

    Write-Host "`n[$label] Criando order de R$ $amount..." -ForegroundColor Cyan
    try {
        $r = Invoke-WebRequest -Uri $createUrl -Method POST -Headers $headers -Body $body -UseBasicParsing
        $json = $r.Content | ConvertFrom-Json
        Write-Host "[$label] OK - order_id = $($json.order_id)" -ForegroundColor Green
        return $json.order_id
    } catch {
        Write-Host "[$label] ERRO ao criar order: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            Write-Host "  Detalhes: $($reader.ReadToEnd())" -ForegroundColor Red
        }
        return $null
    }
}

function Simulate-Webhook($orderId, $label) {
    $body = "{`"orderId`":`"$orderId`"}"
    Write-Host "[$label] Simulando webhook (idempotência)..." -ForegroundColor Cyan
    try {
        $r = Invoke-WebRequest -Uri $testUrl -Method POST -Headers $headers -Body $body -UseBasicParsing
        Write-Host "[$label] OK - $($r.Content)" -ForegroundColor Green
    } catch {
        Write-Host "[$label] ERRO: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            Write-Host "  Detalhes: $($reader.ReadToEnd())" -ForegroundColor Red
        }
    }
}

# ============================================
# CENÁRIO 1 — IDEMPOTÊNCIA (mesma order paga 2x)
# ============================================
Write-Host "`n========== CENARIO 1: IDEMPOTENCIA ==========" -ForegroundColor Yellow
$order1 = Create-Order -amount 1.00 -label "IDEMPOTENCIA"
if ($order1) {
    Simulate-Webhook $order1 "1ª chamada"
    Simulate-Webhook $order1 "2ª chamada (deve retornar idempotent)"
}

# ============================================
# CENÁRIO 2 — PAGAMENTO NORMAL (caminho feliz)
# ============================================
Write-Host "`n========== CENARIO 2: PAGAMENTO NORMAL ==========" -ForegroundColor Yellow
$order2 = Create-Order -amount 2.50 -label "NORMAL"
if ($order2) {
    Simulate-Webhook $order2 "Normal"
}

# ============================================
# CENÁRIO 3 — ORDER INEXISTENTE
# ============================================
Write-Host "`n========== CENARIO 3: ORDER INEXISTENTE ==========" -ForegroundColor Yellow
Simulate-Webhook "ORDE_INEXISTENTE_FAKE_ID" "Inexistente"

# ============================================
# CENÁRIO 4 — NOVA ORDER PARA PÓS-TESTES
# ============================================
Write-Host "`n========== CENARIO 4: NOVA ORDER PARA USO FUTURO ==========" -ForegroundColor Yellow
$order4 = Create-Order -amount 5.00 -label "FUTURA"
if ($order4) {
    Write-Host "`nOrdem criada: $order4 - deixe em 'pending' para próximos testes" -ForegroundColor Magenta
}

Write-Host "`n========== FIM ==========" -ForegroundColor Yellow
Write-Host "Verifique o Table Editor para conferir as transacoes." -ForegroundColor Cyan
Write-Host "Devem existir agora:" -ForegroundColor Cyan
Write-Host "  - ORDE_FA9D13A1... (ja paga, do teste anterior) - R$ 1,00" -ForegroundColor Gray
Write-Host "  - $order1 (paga 2x, ver idempotencia)            - R$ 1,00" -ForegroundColor Gray
Write-Host "  - $order2 (paga)                                  - R$ 2,50" -ForegroundColor Gray
Write-Host "  - ORDE_INEXISTENTE_FAKE_ID (deve dar erro 404)" -ForegroundColor Gray
Write-Host "  - $order4 (ainda pending)" -ForegroundColor Gray
