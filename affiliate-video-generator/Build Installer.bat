@echo off
setlocal enabledelayedexpansion
title Affiliate Video Generator - Build Installer
cd /d "%~dp0"

echo ============================================================
echo   Affiliate Video Generator
echo   Build Installer (.exe untuk Windows)
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js tidak ditemukan.
    echo Install dulu dari https://nodejs.org lalu jalankan lagi file ini.
    echo.
    pause
    exit /b 1
)

echo [INFO] Node.js terdeteksi:
node --version
echo.

for /f "delims=" %%I in ('where npm.cmd 2^>nul') do set "NPM_CMD=%%I"
if not defined NPM_CMD (
    for /f "delims=" %%I in ('where npm 2^>nul') do set "NPM_CMD=%%I"
)
if not defined NPM_CMD (
    echo [ERROR] npm tidak ketemu. Install ulang Node.js.
    echo.
    pause
    exit /b 1
)
echo [INFO] npm di: %NPM_CMD%
echo.

if not exist "node_modules\" (
    echo [INFO] Install dependency dulu...
    call "%NPM_CMD%" install --no-audit --no-fund
    if errorlevel 1 (
        echo.
        echo [ERROR] npm install gagal. Screenshot pesan di atas.
        echo.
        pause
        exit /b 1
    )
    echo.
)

echo [INFO] Mulai build installer ^(bisa makan waktu 5-10 menit^)...
echo Hasil akhir: dist-electron\AffiliateVideoGenerator-Setup.exe
echo             dist-electron\AffiliateVideoGenerator-Portable.exe
echo.

call "%NPM_CMD%" run build
set EXITCODE=%ERRORLEVEL%

if "%EXITCODE%"=="0" (
    echo.
    echo ============================================================
    echo   BERHASIL!
    echo   File installer ada di folder: dist-electron\
    echo ============================================================
    start "" explorer "%~dp0dist-electron"
) else (
    echo.
    echo ============================================================
    echo   GAGAL ^(exit code: %EXITCODE%^). Screenshot pesan di atas.
    echo ============================================================
)

echo.
pause
exit /b %EXITCODE%
