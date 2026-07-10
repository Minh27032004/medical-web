# Medical Web

Website khám chữa bệnh cho phòng khám gia đình (một phòng khám): đặt lịch khám, hồ sơ khám + đơn thuốc, cửa hàng thuốc, chat tư vấn (LLM + bác sĩ), báo cáo doanh thu.

## Cấu trúc monorepo

```
frontend/   Next.js (deploy Vercel)        — chưa scaffold
backend/    Spring Boot (deploy Render)    — chưa scaffold
docs/       Đặc tả chức năng, quyết định kiến trúc, kiến trúc hệ thống
.claude/    Cấu hình Claude Code (settings, skills)
CLAUDE.md   Ngữ cảnh dự án cho Claude Code — đọc đầu tiên
```

## Tài liệu

- [docs/FEATURES.md](docs/FEATURES.md) — đặc tả chức năng
- [docs/DECISIONS.md](docs/DECISIONS.md) — nhật ký quyết định (ADR)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — kiến trúc hệ thống

## Thiết lập môi trường dev

1. Cài Node.js ≥ 20 và JDK ≥ 21
2. MCP cho Claude Code: copy `.mcp.json.example` → `.mcp.json`, điền Supabase project ref + access token (nếu chưa cấu hình ở cấp user)
3. Secrets đặt trong `.env` từng phần (`frontend/.env.local`, `backend/.env`) — đã được gitignore
