@echo off
cd /d "e:\Dev\App - Boost Homebroker\scraper_lm"

echo ==============================================
echo Iniciando Scraper LigaMagic (Diario)
echo Data: %date% Hora: %time%
echo ==============================================

call npm start

echo.
echo Processo finalizado. Esta janela fechara em 10 segundos.
timeout /t 10
