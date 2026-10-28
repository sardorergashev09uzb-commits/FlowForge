@echo off
echo Starting FlowForge Enterprise Yii2 API (http://127.0.0.1:8080) and React Frontend (http://localhost:5173)...
start "FlowForge Yii2 Backend" cmd /k "cd /d c:\laragon\www\FlowForge\backend && php -S 127.0.0.1:8080 -t web web/router.php"
start "FlowForge React Frontend" cmd /k "cd /d c:\laragon\www\FlowForge\frontend && npm.cmd run dev"
