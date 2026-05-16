@echo off
title APS Backend - Port 8001
color 1F
REM ─────────────────────────────────────────────────────────
REM  Audit Planning System — Backend Server (Port 8001)
REM  Django + PostgreSQL 17 (port 5434)
REM  Run from: C:\Users\kanza\audit-planning-system\
REM ─────────────────────────────────────────────────────────

echo.
echo  ============================================
echo   AUDIT PLANNING SYSTEM - Backend Server
echo  ============================================
echo   API:  http://127.0.0.1:8001/api/
echo   Admin: http://127.0.0.1:8001/admin/
echo   DB:   PostgreSQL 17 on port 5434
echo  ============================================
echo.

REM Check if port 8001 is already in use
netstat -ano | findstr ":8001" | findstr "LISTENING" > nul
if %errorlevel% == 0 (
    echo WARNING: Port 8001 is already in use.
    echo Another instance may be running.
    echo.
    pause
    exit
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Run Django server
echo Starting server... Press Ctrl+C to stop.
echo.
python manage.py runserver 127.0.0.1:8001

echo.
echo Backend stopped.
pause
