@echo off
chcp 65001 >nul
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

echo [INFO] Node.js terdeteksi.
node --version
echo.

if not exist "node_modules\" (
    echo [INFO] Install dependency dulu...
    call npm install
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

call npm run build
set EXITCODE=%errorlevel%

if "%EXITCODE%"=="0" (
    echo.
    echo ============================================================
    echo   BERHASIL!
    echo   File installer ada di folder: dist-electron\
    echo ============================================================
    explorer "%~dp0dist-electron"
) else (
    echo.
    echo ============================================================
    echo   GAGAL ^(exit code: %EXITCODE%^). Screenshot pesan di atas.
    echo ============================================================
)

echo.
pause
exit /b %EXITCODE%
