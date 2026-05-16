@echo off
title Audit Planning System - Launcher
color 0E
REM ─────────────────────────────────────────────────────────
REM  AUDIT PLANNING SYSTEM — ONE-CLICK LAUNCHER
REM  Starts both backend and frontend in separate windows
REM  Double-click this file to start the system
REM ─────────────────────────────────────────────────────────

echo.
echo  ============================================
echo   AUDIT PLANNING SYSTEM - Starting...
echo  ============================================
echo.

REM Change to the project directory
cd /d "%~dp0"

echo  [1/2] Starting Backend API (port 8001)...
start "APS Backend" cmd /k "start_backend.bat"

REM Small delay so backend starts first
timeout /t 3 /nobreak > nul

echo  [2/2] Starting Frontend (port 5173)...
start "APS Frontend" cmd /k "start_frontend.bat"

echo.
echo  Both servers are starting in separate windows.
echo.
echo  Once ready, open your browser and go to:
echo.
echo    http://localhost:5173
echo.
echo  Login: admin / Admin@2024!
echo.
echo  You can close THIS window. Keep the other two open.
echo  ============================================
echo.
timeout /t 8 /nobreak > nul

REM Open browser automatically
start "" "http://localhost:5173"
