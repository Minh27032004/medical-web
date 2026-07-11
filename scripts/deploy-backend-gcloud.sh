#!/usr/bin/env bash
# Deploy backend lên Google Cloud Run.
# Yêu cầu: đã `gcloud auth login` và set đúng project.
#
# Cách chạy (Git Bash, từ thư mục gốc repo):
#   bash scripts/deploy-backend-gcloud.sh <PROJECT_ID>
#
# Secrets đọc từ backend/.env (không nằm trong repo).

set -euo pipefail

PROJECT_ID="${1:?Thiếu PROJECT_ID (gcloud projects list để xem)}"
REGION="asia-southeast1" # Singapore — gần VN nhất
SERVICE="clinic-backend"

# Đọc env từ backend/.env
set -a
source backend/.env
set +a

gcloud config set project "$PROJECT_ID"

echo "== Bật các API cần thiết (lần đầu hơi lâu) =="
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

echo "== Build + deploy Cloud Run =="
gcloud run deploy "$SERVICE" \
  --source backend \
  --region "$REGION" \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars "DATABASE_URL=$DATABASE_URL" \
  --set-env-vars "DATABASE_USERNAME=$DATABASE_USERNAME" \
  --set-env-vars "DATABASE_PASSWORD=$DATABASE_PASSWORD" \
  --set-env-vars "DB_POOL_SIZE=5" \
  --set-env-vars "SUPABASE_URL=$SUPABASE_URL" \
  --set-env-vars "SUPABASE_JWKS_URI=$SUPABASE_JWKS_URI" \
  --set-env-vars "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY" \
  --set-env-vars "GEMINI_API_KEY=$GEMINI_API_KEY" \
  --set-env-vars "GEMINI_MODEL=${GEMINI_MODEL:-gemini-3-flash-preview}" \
  --set-env-vars "GEMINI_EMBEDDING_MODEL=${GEMINI_EMBEDDING_MODEL:-gemini-embedding-2}" \
  --set-env-vars "FRONTEND_ORIGIN=${PROD_FRONTEND_ORIGIN:-http://localhost:3000}"

echo ""
echo "== Xong! URL dịch vụ: =="
gcloud run services describe "$SERVICE" --region "$REGION" --format "value(status.url)"
