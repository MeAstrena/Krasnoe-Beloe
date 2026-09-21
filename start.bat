@echo off
chcp 65001 >nul
title KB Server

cd /d "%~dp0"

echo.
echo   Запуск сервера...
echo.

if not exist "node_modules" (
    echo   node_modules не найден. Устанавливаю зависимости...
    call npm install
    if errorlevel 1 (
        echo   ОШИБКА: не удалось установить зависимости.
        pause
        exit /b 1
    )
)

call npm start

echo.
echo   Сервер остановлен.
pause