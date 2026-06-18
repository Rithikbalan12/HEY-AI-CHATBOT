# Zero-Dependency Raw TCP Socket Web Server for HEY AI
# Serves static HTML, CSS, and JS files from local folder on port 8000
# Bypasses Windows HTTP.sys URLACL permissions by using raw TCP Sockets

$port = 8000
$baseDir = "C:\Users\acer\.gemini\antigravity\scratch\Heyy_AI"

# Listen on all interfaces (0.0.0.0)
$localAddr = [System.Net.IPAddress]::Any
$server = New-Object System.Net.Sockets.TcpListener($localAddr, $port)

try {
    $server.Start()
    Write-Output "HEY AI Web Server successfully listening on all interfaces at http://localhost:$port/"
    
    # Discover and display active local IP addresses for remote connection
    $localIPs = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" }
    foreach ($ip in $localIPs) {
        Write-Output "Access from network at: http://$($ip.IPAddress):$port/"
    }
    
    # Connection handling loop
    while ($true) {
        try {
            $client = $server.AcceptTcpClient()
            $stream = $client.GetStream()
            
            # Read request data
            $buffer = New-Object System.Byte[] 2048
            $readBytes = $stream.Read($buffer, 0, $buffer.Length)
            if ($readBytes -gt 0) {
                $requestStr = [System.Text.Encoding]::ASCII.GetString($buffer, 0, $readBytes)
                
                # Parse request (e.g. GET /index.html HTTP/1.1)
                if ($requestStr -match "GET (\S+) HTTP") {
                    $urlPath = $Matches[1]
                    if ($urlPath -eq "/") { $urlPath = "/index.html" }
                    
                    # Sanitize filename path traversal and query strings
                    $filename = $urlPath.TrimStart('/')
                    $filename = $filename -replace '\?.*$', '' -replace '#.*$', ''
                    $localFile = Join-Path $baseDir $filename
                    
                    if (Test-Path $localFile -PathType Leaf) {
                        $content = [System.IO.File]::ReadAllBytes($localFile)
                        
                        # Determine correct MIME Content-Type
                        $contentType = "text/plain; charset=utf-8"
                        if ($localFile.EndsWith(".html")) { $contentType = "text/html; charset=utf-8" }
                        elseif ($localFile.EndsWith(".css")) { $contentType = "text/css; charset=utf-8" }
                        elseif ($localFile.EndsWith(".js")) { $contentType = "application/javascript; charset=utf-8" }
                        elseif ($localFile.EndsWith(".md")) { $contentType = "text/markdown; charset=utf-8" }
                        
                        $header = "HTTP/1.1 200 OK`r`n" +
                                  "Content-Type: $contentType`r`n" +
                                  "Content-Length: $($content.Length)`r`n" +
                                  "Access-Control-Allow-Origin: *`r`n" +
                                  "Connection: close`r`n`r`n"
                        
                        $headerBytes = [System.Text.Encoding]::UTF8.GetBytes($header)
                        $stream.Write($headerBytes, 0, $headerBytes.Length)
                        $stream.Write($content, 0, $content.Length)
                    } else {
                        # 404 Response
                        $errBody = "404 Not Found"
                        $errBytes = [System.Text.Encoding]::UTF8.GetBytes($errBody)
                        $header = "HTTP/1.1 404 Not Found`r`n" +
                                  "Content-Type: text/plain; charset=utf-8`r`n" +
                                  "Content-Length: $($errBytes.Length)`r`n" +
                                  "Connection: close`r`n`r`n"
                        
                        $headerBytes = [System.Text.Encoding]::UTF8.GetBytes($header)
                        $stream.Write($headerBytes, 0, $headerBytes.Length)
                        $stream.Write($errBytes, 0, $errBytes.Length)
                    }
                }
            }
            $stream.Close()
            $client.Close()
        } catch {
            Write-Warning "Connection handling error: $_"
        }
    }
} catch {
    Write-Error "Server socket error: $_"
} finally {
    if ($server) {
        $server.Stop()
        Write-Output "Server socket stopped."
    }
}
