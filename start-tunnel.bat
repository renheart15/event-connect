@echo off
echo Starting Cloudflare Tunnel for Event Connect...
echo.
echo Frontend will be available at: https://your-tunnel-url.trycloudflare.com
echo Backend will be available at: https://your-backend-tunnel-url.trycloudflare.com
echo.

REM Start frontend tunnel in background
start "Frontend Tunnel" cloudflared.exe tunnel --url http://localhost:5173
timeout /t 3 /nobreak >nul

REM Start backend tunnel in background  
start "Backend Tunnel" cloudflared.exe tunnel --url http://localhost:5000
timeout /t 3 /nobreak >nul

echo.
echo Tunnels started! Check the terminal windows for the actual URLs.
echo Press any key to stop all tunnels...
pause >nul

REM Kill all cloudflared processes
taskkill /f /im cloudflared.exe >nul 2>&1
echo Tunnels stopped.