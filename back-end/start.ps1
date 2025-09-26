# start.ps1 - Run Cypher (Windows)

# Activate Python venv
& .\venv\Scripts\Activate.ps1

# Start Flask backend
$flask = Start-Process python -ArgumentList "main.py" -PassThru

# Start Node internal API
$node = Start-Process node -ArgumentList "node_internal_api\app.js" -PassThru

Write-Host "Cypher running - Flask: http://127.0.0.1:5000 | Node: http://localhost:3000"
Write-Host "Press Ctrl+C to stop"
Write-Host "Access Cypher by going to http://localhost:5000"

# Wait for Ctrl+C
try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
} catch {
    # On Ctrl+C, stop processes
    Write-Host "Stopping Cypher..."
    Stop-Process -Id $flask.Id -ErrorAction SilentlyContinue
    Stop-Process -Id $node.Id -ErrorAction SilentlyContinue
}
