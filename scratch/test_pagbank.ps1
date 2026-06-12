$headers = @{
    'Content-Type' = 'application/json'
    'Authorization' = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3d2xrcXFnZHRhcmttc3RsY292Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2ODAwNjksImV4cCI6MjA5NjI1NjA2OX0.BE99pFQgFrGtw0ywgIgt8j8Rn6qmr4yy4-PxSAa0Fcc'
}
$body = '{"amount":50,"userId":"test-user-id","userEmail":"test@test.com","userName":"Test","groupId":"test-group","groupName":"Test Group"}'

try {
    $response = Invoke-WebRequest -Uri 'https://iwwlkqqgdtarkmstlcov.supabase.co/functions/v1/pagbank-create-order' -Method POST -Headers $headers -Body $body -UseBasicParsing
    Write-Host 'STATUS:' $response.StatusCode
    Write-Host 'BODY:' $response.Content
} catch {
    $ex = $_.Exception.Response
    if ($ex) {
        Write-Host 'STATUS:' $ex.StatusCode.value__
        $stream = $ex.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        Write-Host 'BODY:' $reader.ReadToEnd()
    } else {
        Write-Host 'ERROR:' $_.Exception.Message
    }
}
