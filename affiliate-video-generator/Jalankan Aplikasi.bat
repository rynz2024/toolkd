@echo off
setlocal enabledelayedexpansion
title Affiliate Video Generator - Mode Dev
cd /d "%~dp0"

echo ============================================================
echo   Affiliate Video Generator
echo   Mode Dev (klik tutup window ini untuk menghentikan app)
echo ============================================================
echo.

REM --- Cek Node.js (node.exe = .exe, jadi bisa langsung dipanggil) ---
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js tidak ditemukan di sistem Anda.
    echo.
    echo Silakan install Node.js LTS dulu dari https://nodejs.org
    echo Setelah install, tutup window ini dan jalankan lagi file .bat ini.
    echo.
    pause
    exit /b 1
)

echo [INFO] Node.js terdeteksi:
node --version
echo.

REM --- Resolve full path ke npm.cmd dan electron.cmd via Node sendiri ---
REM   Pakai full path supaya tidak ada konflik dengan resolusi PATH dan
REM   tidak butuh chcp 65001. Semua pemanggilan npm/electron pakai `call`.
for /f "delims=" %%I in ('where npm.cmd 2^>nul') do set "NPM_CMD=%%I"
if not defined NPM_CMD (
    for /f "delims=" %%I in ('where npm 2^>nul') do set "NPM_CMD=%%I"
)
if not defined NPM_CMD (
    echo [ERROR] npm tidak ketemu padahal Node.js sudah terinstal.
    echo Coba install ulang Node.js dan pastikan opsi "npm" ikut dicentang.
    echo.
    pause
    exit /b 1
)

echo [INFO] npm di: %NPM_CMD%
echo.

REM --- Install dependency kalau folder node_modules belum ada ---
if not exist "node_modules\" (
    echo [INFO] Pertama kali dijalankan, sedang install dependency...
    echo Proses ini bisa makan waktu 2-5 menit ^(download ~250 MB^).
    echo.
    call "%NPM_CMD%" install --no-audit --no-fund
    if errorlevel 1 (
        echo.
        echo [ERROR] npm install gagal. Screenshot pesan di atas dan kirim ke saya.
        echo.
        pause
        exit /b 1
    )
    echo.
    echo [INFO] Dependency selesai di-install.
    echo.
)

REM --- Build UI + jalankan Electron ---
echo [INFO] Compile UI dan menjalankan Affiliate Video Generator...
echo Tutup window app untuk keluar. Kalau ada error, window ini akan
echo tetap terbuka supaya bisa di-screenshot.
echo.

call "%NPM_CMD%" run start:built
set EXITCODE=%ERRORLEVEL%

echo.
echo ============================================================
echo   Aplikasi sudah ditutup ^(exit code: %EXITCODE%^)
echo ============================================================
echo.
pause
exit /b %EXITCODE%
