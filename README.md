## Project Name

EnFlow Frontend (Next.js)

## 📌 Introduction

Repo frontend cho hệ thống EnFlow, xây dựng bằng **Next.js (App Router)** và TypeScript.

Điểm thiết kế quan trọng: frontend gọi API theo prefix **`/enflow/*`** và có cơ chế **proxy** sang backend khi chạy dev/prod thông qua `rewrites` trong `next.config.mjs`.

## 🚀 Features

- UI theo mô hình dashboard/task management
- Tích hợp gọi API qua lớp HTTP chung (`src/lib/http.ts`)
- Hỗ trợ 2 chế độ kết nối backend:
  - **Same-origin**: gọi `/enflow/*` (không cần CORS)
  - **Cross-origin**: gọi `https://api.example.com/enflow/*` qua `NEXT_PUBLIC_API_BASE_URL` (cần CORS từ BE)

## 🏗️ Architecture / Tech Stack

- **Framework**: Next.js 14 (output `standalone`)
- **Language**: TypeScript
- **UI**: React 18, Radix UI, TailwindCSS
- **Package manager**: npm
- **Node requirement**: `>= 18.18.0` (theo `package.json`)

## 📂 Project Structure

Các thư mục chính:

- `src/`: mã nguồn chính
  - `src/lib/`: http client, auth session, API wrappers
  - `src/components/`: components UI
  - `src/views/`: các màn hình (pages-level UI)
- `next.config.mjs`: rewrites proxy `/enflow/*` → backend target

## ⚙️ Installation & Setup

### Cài dependencies

```bash
npm i
```

### Biến môi trường

Tạo file `.env.local` tại root (không commit).

#### 1) `API_PROXY_TARGET` (khuyến nghị khi dev / chạy cùng server proxy)

- **Ý nghĩa**: backend origin để Next proxy mọi request `/enflow/*` sang BE.
- **Mặc định**: `http://localhost:8080`

Ví dụ:

```env
API_PROXY_TARGET=http://localhost:8080
```

#### 2) `NEXT_PUBLIC_API_BASE_URL` (khi deploy tách domain, gọi cross-origin)

- **Ý nghĩa**: ép browser gọi API bằng base URL tuyệt đối.
- **Ví dụ**:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
```

> Lưu ý: đổi `.env.local` thì cần **restart** dev server để Next nhận biến mới.

## ▶️ Usage

### Chạy dev

```bash
npm run dev
```

Hoặc xoá cache `.next` rồi chạy dev:

```bash
npm run dev:clean
```

Mặc định chạy ở `http://localhost:3000`.

### Build & chạy production

Build:

```bash
npm run build
```

Chạy:

```bash
npm run start
```

## 🔗 API / Integration

Frontend gọi API theo các cách sau:

- **Same-origin (khuyến nghị khi deploy sau reverse proxy)**:
  - FE gọi `/enflow/...`
  - Reverse proxy (Nginx/Apache) route `/enflow/` sang BE
- **Cross-origin**:
  - Set `NEXT_PUBLIC_API_BASE_URL=https://api.example.com`
  - FE sẽ gọi `https://api.example.com/enflow/...`
  - BE phải cấu hình CORS: `ENFLOW_CORS_ALLOWED_ORIGINS=https://app.example.com`

## 🧪 Testing

Hiện repo có script kiểm tra TypeScript:

```bash
npm run typecheck
```


## 📸 Screenshots / Demo


## 🤝 Contributing

- Đảm bảo:
  - `npm run typecheck` pass
  - Chạy dev và kiểm tra các luồng chính (login, workspace, tasks)


  