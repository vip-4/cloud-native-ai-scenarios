# Deploy script for ai-chat
$env:DATABASE_URL = "postgresql://neondb_owner:npg_rWOvA5QU9pFe@ep-square-boat-auqrsoiu-pooler.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

Set-Location "G:\其他计算机\我的计算机\001\ai-chat"

Write-Host "Running database migrations..."
npm run drizzle-kit -- push
