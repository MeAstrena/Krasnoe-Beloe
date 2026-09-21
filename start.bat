@echo off
chcp 65001 >nul
title Красное&Белое — сервер

cd /d "%~dp0"

echo.
echo   Запуск сервера Красное&Белое...
echo.

if not exist "node_modules" (
    echo   node_modules не найден. Устанавливаю зависимости...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo   ОШИБКА: не удалось установить зависимости.
        pause
        exit /b 1
    )
    echo.
)

call npm start

echo.
echo   Сервер остановлен.
pause