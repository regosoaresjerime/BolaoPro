$headers = @{
    'Content-Type' = 'application/json'
    'Authorization' = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3d2xrcXFnZHRhcmttc3RsY292Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2ODAwNjksImV4cCI6MjA5NjI1NjA2OX0.BE99pFQgFrGtw0ywgIgt8j8Rn6qmr4yy4-PxSAa0Fcc'
}

# IMPORTANTE: e-mail do cliente tem que ser DIFERENTE do e-mail do dono da conta PagBank
$body = '{"amount":1.00,"userId":"6799da45-7651-452f-8d09-d75d22591dc2","userEmail":"cliente.teste@example.com","userName":"Cliente Teste","groupId":"a6ab651d-a151-4a38-8d54-59989125dd33","groupName":"Teste Sandbox PagBank"}'

$url = 'https://iwwlkqqgdtarkmstlcov.supabase.co/functions/v1/pagbank-create-order'

try {
    $response = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -Body $body -UseBasicParsing
    Write-Host 'STATUS:' $response.StatusCode -ForegroundColor Green
    Write-Host 'BODY:'
    Write-Host $response.Content
} catch {
    $ex = $_.Exception.Response
    if ($ex) {
        Write-Host 'STATUS:' $ex.StatusCode.value__ -ForegroundColor Yellow
        $stream = $ex.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $bodyText = $reader.ReadToEnd()
        Write-Host 'BODY:'
        Write-Host $bodyText
    } else {
        Write-Host 'ERROR:' $_.Exception.Message -ForegroundColor Red
    }
}
