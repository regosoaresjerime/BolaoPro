$headers = @{
    'Content-Type' = 'application/json'
    'Authorization' = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3d2xrcXFnZHRhcmttc3RsY292Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2ODAwNjksImV4cCI6MjA5NjI1NjA2OX0.BE99pFQgFrGtw0ywgIgt8j8Rn6qmr4yy4-PxSAa0Fcc'
}

# Order ID criado no teste anterior (REAL do PagBank)
$body = '{"orderId":"ORDE_FA9D13A1-755F-44CD-9163-297596BBE319"}'

$url = 'https://iwwlkqqgdtarkmstlcov.supabase.co/functions/v1/pagbank-webhook-test'

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
        Write-Host 'BODY:'
        Write-Host $reader.ReadToEnd()
    } else {
        Write-Host 'ERROR:' $_.Exception.Message -ForegroundColor Red
    }
}
