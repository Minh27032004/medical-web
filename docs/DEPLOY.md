# Hướng dẫn deploy & CI/CD

Mục tiêu: push code lên GitHub → **backend tự deploy lên Cloud Run**, **frontend tự deploy lên Vercel**.

## Kiến trúc deploy

```
git push main
 ├── thay đổi trong backend/**  → GitHub Actions → Cloud Build → Cloud Run (asia-southeast1)
 └── mọi thay đổi               → Vercel tự build frontend/ → CDN toàn cầu
```

- Backend URL: https://clinic-backend-70334084165.asia-southeast1.run.app
- GCP project: `project-0a96f6c2-d0b9-44ce-b28` · service `clinic-backend` · region `asia-southeast1`
- Env vars/secrets của backend nằm TRÊN Cloud Run (set lần đầu bằng `scripts/deploy-backend-gcloud.sh`);
  CI deploy không đụng tới nên không cần nhét secrets nghiệp vụ vào GitHub.

## A. Backend tự deploy (GitHub Actions) — ĐÃ THIẾT LẬP XONG (2026-07-11)

Xác thực bằng **Workload Identity Federation (OIDC)** — không có key/secret nào trên GitHub.
(Tài khoản GCP mới bị org policy `disableServiceAccountKeyCreation` cấm tạo key JSON,
nên đây vừa là cách duy nhất vừa là cách an toàn nhất.)

Những gì đã tạo trên GCP (chỉ cần làm lại nếu đổi project):

```bash
# 1. Service account deploy
gcloud iam service-accounts create github-deployer --project=<PROJECT_ID>

# 2. Quyền: run.admin, cloudbuild.builds.editor, storage.admin,
#    serviceusage.serviceUsageConsumer (project-level)
#    + iam.serviceAccountUser trên compute SA runtime

# 3. Workload Identity pool + provider OIDC của GitHub,
#    khóa chặt theo repo: assertion.repository=='Minh27032004/medical-web'
gcloud iam workload-identity-pools create github-pool --location=global ...
gcloud iam workload-identity-pools providers create-oidc github-provider ...

# 4. Cho repo impersonate SA
gcloud iam service-accounts add-iam-policy-binding github-deployer@... \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/70334084165/locations/global/workloadIdentityPools/github-pool/attribute.repository/Minh27032004/medical-web"
```

Cơ chế: khi workflow chạy, GitHub phát token OIDC chứa tên repo → GCP kiểm tra token đúng
repo này thì cấp quyền tạm thời của `github-deployer` (hết hạn sau job). Không có gì để lộ.

## B. Frontend tự deploy (Vercel) — thiết lập 1 lần

1. Vào https://vercel.com → đăng nhập bằng GitHub → **Add New… → Project**
2. **Import** repo `Minh27032004/medical-web`
3. Ở màn cấu hình:
   - **Root Directory** → bấm Edit → chọn **`frontend`** ← quan trọng nhất (monorepo)
   - Framework: Next.js (tự nhận)
4. **Environment Variables** — thêm 3 biến:
   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://cgnwrbbrtqyqmlpyrudx.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (publishable key — xem `frontend/.env.local`) |
   | `NEXT_PUBLIC_API_URL` | `https://clinic-backend-70334084165.asia-southeast1.run.app` |
5. **Deploy** → xong sẽ có domain dạng `https://<ten>.vercel.app`

Từ giờ **mọi push lên `main` Vercel tự build + deploy** (mặc định), nhánh khác có Preview URL riêng.

## C. Sau khi có domain Vercel — BẮT BUỘC

Backend đang chỉ cho phép CORS từ localhost. Cập nhật (1 lệnh, không cần build lại):

```bash
gcloud run services update clinic-backend \
  --region asia-southeast1 --project project-0a96f6c2-d0b9-44ce-b28 \
  --update-env-vars "FRONTEND_ORIGIN=https://<ten-cua-ban>.vercel.app"
```

Thiếu bước này frontend production sẽ bị lỗi CORS khi gọi API.

## Deploy tay (dự phòng)

- Backend: `bash scripts/deploy-backend-gcloud.sh project-0a96f6c2-d0b9-44ce-b28`
  (đọc secrets từ `backend/.env`, dùng khi cần đổi env vars)
- Xem log backend: `gcloud run services logs read clinic-backend --region asia-southeast1 --limit 50`
