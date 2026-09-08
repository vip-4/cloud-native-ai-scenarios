#!/usr/bin/env bash
# 发送飞书消息工具脚本
# 用法: FEISHU_APP_ID=xx FEISHU_APP_SECRET=xx FEISHU_CHAT_ID=oc_xxx TEXT="消息内容" send-feishu-notification.sh
set -euo pipefail

: "${FEISHU_APP_ID:?FEISHU_APP_ID required}"
: "${FEISHU_APP_SECRET:?FEISHU_APP_SECRET required}"
: "${FEISHU_CHAT_ID:?FEISHU_CHAT_ID required}"
: "${TEXT:?TEXT required}"

TOKEN=$(curl -sf -X POST 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal' \
  -H 'Content-Type: application/json; charset=utf-8' \
  -d "{\"app_id\":\"${FEISHU_APP_ID}\",\"app_secret\":\"${FEISHU_APP_SECRET}\"}" \
  | jq -r '.tenant_access_token')

CONTENT=$(python3 -c 'import json,sys; print(json.dumps({"text": sys.argv[1]}, ensure_ascii=False))' "$TEXT")

RESP=$(curl -sf -X POST "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json; charset=utf-8' \
  -d "{\"receive_id\":\"${FEISHU_CHAT_ID}\",\"msg_type\":\"text\",\"content\":${CONTENT}}")

echo "✓ 飞书消息已发送: $(echo "$RESP" | jq -r '.code // .msg || "ok"')"