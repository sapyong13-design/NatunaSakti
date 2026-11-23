@echo off
start "NatunaSakti" /min "C:\Users\faris\AppData\Local\NatunaSakti\runtime\python\Scripts\python.exe" "C:\Users\faris\AppData\Local\NatunaSakti\run-local.py"
timeout /t 3 /nobreak >nul
start "" http://127.0.0.1:5173
