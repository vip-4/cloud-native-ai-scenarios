@echo off
chcp 65001 >nul
echo ==========================================
echo   Edge AI Gateway - LiteLLM Deployment
echo ==========================================
echo.

set LITELLM_CONFIG=%~dp0proxy_server_config.yaml
set LITELLM_DATA=%~dp0litellm-data

echo [1/3] Checking Docker...
docker --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not installed or not running
    pause
    exit /b 1
)
echo Docker is available

echo.
echo [2/3] Creating directories...
if not exist "%LITELLM_DATA%" mkdir "%LITELLM_DATA%"

echo.
echo [3/3] Starting LiteLLM Proxy...
echo.
echo Starting LiteLLM Proxy on http://localhost:4000
echo Configuration: %LITELLM_CONFIG%
echo.
echo Press Ctrl+C to stop
echo.

docker run -d ^
  --name litellm-proxy ^
  -p 4000:4000 ^
  -v "%LITELLM_CONFIG%:/app/config.yaml" ^
  -v "%LITELLM_DATA%:/app/data" ^
  -e DATABASE_URL=postgresql://user:pass@localhost:5432/litellm ^
  -e STORE_MODEL_IN_DB=false ^
  ghcr.io/berriai/litellm:latest ^
  --config /app/config.yaml ^
  --port 4000 ^
  --host 0.0.0.0

echo.
echo LiteLLM Proxy started!
echo.
echo Available endpoints:
echo   - Chat Completions: http://localhost:4000/v1/chat/completions
echo   - Models: http://localhost:4000/v1/models
echo   - Web UI: http://localhost:4000/ui
echo.
echo To view logs:
echo   docker logs -f litellm-proxy
echo.
pause
