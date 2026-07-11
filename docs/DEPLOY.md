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

## A. Backend tự deploy (GitHub Actions) — thiết lập 1 lần

Workflow đã có sẵn: `.github/workflows/deploy-backend.yml`. Chỉ thiếu quyền để GitHub gọi được GCP.

### A1. Tạo service account cho GitHub (chạy trong terminal / gõ `!` trong Claude Code)

```bash
gcloud iam service-accounts create github-deployer \
  --project=project-0a96f6c2-d0b9-44ce-b28 \
  --display-name="GitHub Actions deployer"
```

### A2. Cấp quyền cho service account đó (5 lệnh)

```bash
SA=github-deployer@project-0a96f6c2-d0b9-44ce-b28.iam.gserviceaccount.com

gcloud projects add-iam-policy-binding project-0a96f6c2-d0b9-44ce-b28 --member=serviceAccount:$SA --role=roles/run.admin --condition=None
gcloud projects add-iam-policy-binding project-0a96f6c2-d0b9-44ce-b28 --member=serviceAccount:$SA --role=roles/cloudbuild.builds.editor --condition=None
gcloud projects add-iam-policy-binding project-0a96f6c2-d0b9-44ce-b28 --member=serviceAccount:$SA --role=roles/storage.admin --condition=None
gcloud projects add-iam-policy-binding project-0a96f6c2-d0b9-44ce-b28 --member=serviceAccount:$SA --role=roles/serviceusage.serviceUsageConsumer --condition=None

# cho phép deployer "đóng vai" service account runtime của Cloud Run
gcloud iam service-accounts add-iam-policy-binding 70334084165-compute@developer.gserviceaccount.com \
  --project=project-0a96f6c2-d0b9-44ce-b28 \
  --member=serviceAccount:$SA --role=roles/iam.serviceAccountUser
```

Ý nghĩa: `run.admin` (deploy service), `cloudbuild.builds.editor` (chạy build), `storage.admin`
(upload source lên bucket build), `serviceUsageConsumer` (gọi API), `serviceAccountUser`
(gán runtime SA cho revision mới). Không có quyền xem/sửa dữ liệu khác.

### A3. Tạo key JSON

```bash
gcloud iam service-accounts keys create gcp-key.json --iam-account=$SA
```

File `gcp-key.json` xuất hiện ở thư mục hiện tại. **Đây là chìa khóa deploy — không commit, không gửi qua chat.**

### A4. Nạp key vào GitHub Secrets

1. Mở https://github.com/Minh27032004/medical-web/settings/secrets/actions
2. **New repository secret**
3. Name: `GCP_SA_KEY`
4. Secret: mở `gcp-key.json`, copy **toàn bộ nội dung** dán vào
5. **Add secret**, rồi **xóa file `gcp-key.json`** trên máy (`rm gcp-key.json`)

### A5. Kiểm chứng

- Vào tab **Actions** của repo → workflow "Deploy backend (Cloud Run)" → **Run workflow** (chạy tay lần đầu)
- Chạy xanh ✅ = từ giờ mọi push vào `main` có sửa `backend/**` sẽ tự deploy (~5-8 phút),
  kèm bước tự kiểm tra health sau deploy.

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
