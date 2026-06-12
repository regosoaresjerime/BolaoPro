# ============================================
# Validação: pagbank-create-order com CPF e telefone
# ============================================

$headers = @{
    'Content-Type' = 'application/json'
    'Authorization' = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3d2xrcXFnZHRhcmttc3RsY292Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2ODAwNjksImV4cCI6MjA5NjI1NjA2OX0.BE99pFQgFrGtw0ywgIgt8j8Rn6qmr4yy4-PxSAa0Fcc'
}

$createUrl = 'https://iwwlkqqgdtarkmstlcov.supabase.co/functions/v1/pagbank-create-order'

$userId = '6799da45-7651-452f-8d09-d75d22591dc2'
$groupId = 'a6ab651d-a151-4a38-8d54-59989125dd33'

function Testar($titulo, $body) {
    Write-Host ''
    Write-Host "=== $titulo ===" -ForegroundColor Cyan
    try {
        $r = Invoke-WebRequest -Uri $createUrl -Method POST -Headers $headers -Body $body -UseBasicParsing
        $json = $r.Content | ConvertFrom-Json
        Write-Host "STATUS: 200 OK" -ForegroundColor Green
        Write-Host "order_id: $($json.order_id)" -ForegroundColor Green
        Write-Host "status: $($json.status)" -ForegroundColor Green
        Write-Host "amount: R$ $($json.amount.value / 100)" -ForegroundColor Green
        Write-Host "expires_at: $($json.expires_at)" -ForegroundColor Green
        Write-Host "qr_code (primeiros 60 chars): $($json.qr_code.qr_code_text.Substring(0, [Math]::Min(60, $json.qr_code.qr_code_text.Length)))..." -ForegroundColor Green
        return $json
    } catch {
        Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $bodyText = $reader.ReadToEnd()
            Write-Host "Resposta: $bodyText" -ForegroundColor Red
        }
        return $null
    }
}

# ============================================
# TESTE 1: COM CPF e telefone REAIS
# ============================================
$body1 = @"
{"amount":1.00,"userId":"$userId","userEmail":"cliente1.teste.001@example.com","userName":"Maria Silva","userCpf":"52998224725","userPhone":"91988887777","groupId":"$groupId","groupName":"Teste Validacao"}
"@
Testar 'TESTE 1: Com CPF e telefone (deve gerar QR com dados reais)' $body1

# ============================================
# TESTE 2: SEM CPF e telefone (fallback do Edge Function)
# ============================================
$body2 = @"
{"amount":1.00,"userId":"$userId","userEmail":"cliente2.teste.002@example.com","userName":"Joao Santos","groupId":"$groupId","groupName":"Teste Fallback"}
"@
Testar 'TESTE 2: Sem CPF e telefone (fallback do Edge Function)' $body2

# ============================================
# TESTE 3: CPF com máscara (deve ser sanitizado)
# ============================================
$body3 = @"
{"amount":1.00,"userId":"$userId","userEmail":"cliente3.teste.003@example.com","userName":"Pedro Costa","userCpf":"123.456.789-09","userPhone":"(91) 98888-7777","groupId":"$groupId","groupName":"Teste Mascara"}
"@
Testar 'TESTE 3: CPF com mascara XXX.XXX.XXX-XX (deve sanitizar)' $body3

# ============================================
# TESTE 4: CPF inválido (10 dígitos) — deve usar fallback
# ============================================
$body4 = @"
{"amount":1.00,"userId":"$userId","userEmail":"cliente4.teste.004@example.com","userName":"Ana Oliveira","userCpf":"1234567890","userPhone":"91988887777","groupId":"$groupId","groupName":"Teste Cpf Invalido"}
"@
Testar 'TESTE 4: CPF com 10 digitos (deve usar fallback 12345678909)' $body4

Write-Host ''
Write-Host '=== FIM ===' -ForegroundColor Yellow
Write-Host 'Acesse o Table Editor e confira que as 4 transacoes foram criadas (status=pending).' -ForegroundColor Cyan
