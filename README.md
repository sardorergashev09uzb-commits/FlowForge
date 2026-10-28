# FlowForge Enterprise v2.0

**FlowForge** — jamoalar kundalik ishlarini rejalashtiradigan, vazifalarni taqsimlaydigan, muddatlarni kuzatadigan va loyihalar rivojini boshqaradigan ko‘p foydalanuvchili (**Multi-Tenant**) SaaS platformasi.

---

## Arxitektura va Texnologik Stack

- **Backend (`/backend`):** PHP 8.x + **Yii2 Framework (v2.0.55)** REST API (`/api/v1/*`)
  - **28+ jadvalli ma’lumotlar bazasi sxemasi** (`backend/migrations/m261028_000001_init_flowforge_schema.php`)
  - **Server-side Multi-Tenant RBAC (`TenantAccessGuard`):** `Owner`, `Admin`, `Member`, `Viewer` rollari va tenantlararo qat’iy izolyatsiya (IDOR himoyasi bilan)
  - **JWT + Device Session Tracking (`user_sessions`):** Qurilmalar, IP manzillar, faol sessiyalarni ko‘rish va masofadan uzish, 2-bosqichli Parolni Tiklash (`forgot-password` / `reset-password`)
  - **MySQL + SQLite WAL Auto-Fallback:** MySQL (`3306`) ishlab turgan bo‘lsa `flowforge_db` ga ulanadi, aks holda avtomatik ravishda `backend/runtime/flowforge_enterprise.sqlite` bazasida ishlaydi.
- **Frontend (`/frontend`):** **React 19 + TypeScript + Vite + Tailwind CSS + Zustand + Lucide Icons**
  - **4-qatlamli ichma-ich (Nested) Navigatsiya:**
    1. **Global Primary Rail:** Workspace Switcher, Pulse, Inbox, My Work, Spaces, Docs, Time Sheets, Reports, Settings & User Availability
    2. **Contextual Secondary Sidebar:** `Spaces` ➔ `Folders` ➔ `Projects` daraxti hamda 10 bo‘limli `Settings & Governance Center`
    3. **Project Workspace 9-Tab View Switcher:** `Overview`, `Kanban Board (Column + Swimlanes)`, `List (Bulk Actions)`, `Calendar (Drag-and-Drop)`, `Timeline (Real-Date Gantt)`, `Sprints`, `Docs / Wiki`, `Time Tracking`, `Project Settings`
    4. **Slide-Over Task Detail Drawer (360°) & `Ctrl+K` Command Palette:** Subtasklar, Checklistlar, Vazifalararo bog‘liqliklar (`BLOCKED_BY`), Haqiqiy fayl yuklash (`Attachments`), Vaqt taymeri, `@mention` izohlar, Pin va Emoji reaksiyalar.

---

## O‘rnatish va Ishga Tushirish

### 1. Backend (Yii2 REST API)

```bash
cd backend
composer install

# Migratsiyalarni qo'llash (28+ jadval)
php yii migrate --interactive=0

# Demo ma'lumotlar bazasini to'ldirish (Seed)
php yii seed/run

# Avtomatlashtirilgan RBAC va Multi-Tenant xavfsizlik testlarini ishga tushirish
php yii test/run

# Backend serverni ishga tushirish (http://127.0.0.1:8080)
php -S 127.0.0.1:8080 -t web web/router.php
```

### 2. Frontend (React + TypeScript + Vite)

```bash
cd frontend
npm install

# Development serverni ishga tushirish (http://127.0.0.1:5173)
npm run dev

# Production uchun tekshirish va yig'ish
npm run build
```

---

## Demo Hisoblar (`php yii seed/run` dan so‘ng)

Barcha demo hisoblar uchun parol: **`FlowForge!2026`**

| Foydalanuvchi | Email | Workspace Roli | Tavsif |
|---|---|---|---|
| **`sardorbek`** | `sardorbek@flowforge.uz` | **Owner** | To‘liq Workspace egasi, 2 ta workspace a’zosi |
| **`malika`** | `malika@flowforge.uz` | **Admin** | Workspace va loyiha administratori |
| **`javohir`** | `javohir@flowforge.uz` | **Member** | Dasturchi (loyiha va vazifalarda ishlash huquqi) |
| **`nilufar`** | `nilufar@flowforge.uz` | **Viewer** | Faqat ko‘rish (`Read-only`) huquqiga ega |
| **`aziz_external`** | `aziz@othercorp.uz` | **External Owner** | Alohida (`OtherCorp`) workspace egasi (Tenant izolyatsiya testi uchun) |
