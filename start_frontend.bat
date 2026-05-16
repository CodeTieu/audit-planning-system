@echo off
title APS Frontend - Port 5173
color 2F
REM ─────────────────────────────────────────────────────────
REM  Audit Planning System — Frontend Server (Port 5173)
REM  React + Vite dev server
REM  Run from: C:\Users\kanza\audit-planning-system\
REM ─────────────────────────────────────────────────────────

echo.
echo  ============================================
echo   AUDIT PLANNING SYSTEM - Frontend Server
echo  ============================================
echo   App:  http://localhost:5173
echo   Network: accessible via office network
echo  ============================================
echo.

REM Check if port 5173 is already in use
netstat -ano | findstr ":5173" | findstr "LISTENING" > nul
if %errorlevel% == 0 (
    echo WARNING: Port 5173 is already in use.
    echo The frontend may already be running.
    echo Open http://localhost:5173 in your browser.
    echo.
    pause
    exit
)

echo Starting frontend... Press Ctrl+C to stop.
echo.

cd frontend
npm run dev -- --port 5173 --host

echo.
echo Frontend stopped.
pause
