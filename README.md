# 🚀 FlowForge Enterprise v2.0

<p align="center">
  <img src="https://img.shields.io/badge/Live%20Demo-Online%20(Render)-00c7b7?style=for-the-badge&logo=render&logoColor=white" alt="Live Demo" />
  <img src="https://img.shields.io/badge/PHP-8.2-777bb4?style=for-the-badge&logo=php&logoColor=white" alt="PHP 8.2" />
  <img src="https://img.shields.io/badge/Yii2-Framework-blue?style=for-the-badge&logo=yii&logoColor=white" alt="Yii2" />
  <img src="https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178c6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-38bdf8?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ed?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License" />
</p>

---

## 🌐 Onlayn Demo (Live Production)

Platforma to'liq bulutli serverda ishga tushirilgan va sinovdan o'tkazish uchun tayyor:

👉 **Jonli havola:** **[https://flowforge-cp5a.onrender.com](https://flowforge-cp5a.onrender.com)**

> [!NOTE]
> Bepul server (Free tier) nofaol holatda uyqu rejimiga o'tishi mumkin. Birinchi kirishda tizim uyg'onishi uchun taxminan 30–50 soniya talab etilishi mumkin.

---

## 🔑 Demo Hisoblar (Test Kirish Ma'lumotlari)

Tizimga kirish uchun quyidagi tayyor test hisoblaridan foydalanishingiz mumkin.
Barcha demo foydalanuvchilar uchun yagona parol: **`FlowForge!2026`**

| Foydalanuvchi | Email | Workspace Roli | Huquqlar doirasi va Tavsif |
|---|---|---|---|
| 👑 **`sardorbek`** | `sardorbek@flowforge.uz` | **Owner** | To‘liq Workspace egasi, xodimlar, to‘lovlar, barcha loyihalar boshqaruvi |
| 🛡 **`malika`** | `malika@flowforge.uz` | **Admin** | Workspace ma’muri, loyihalar va vazifalarni to‘liq tahrirlash huquqi |
| 💻 **`javohir`** | `javohir@flowforge.uz` | **Member** | Dasturchi/Ijrochi: vazifalar yaratish, siljitish, vaqt qayd etish |
| 👁 **`nilufar`** | `nilufar@flowforge.uz` | **Viewer** | Faqat ko‘rish huquqi (Read-only, xavfsizlik va audit uchun) |
| 🏢 **`aziz_external`** | `aziz@othercorp.uz` | **External Owner** | Alohida mustaqil kompaniya (`OtherCorp`) egasi (Multi-tenant izolyatsiyasini tekshirish uchun) |

---

## 📌 FlowForge Haqida

**FlowForge** — zamonaviy jamoalar uchun **Linear**, **ClickUp** va **YouTube Studio** kabi dunyo darajasidagi tizimlarning eng qulay yechimlarini o'zida birlashtirgan, ko‘p tarmoqli (**Multi-Tenant**) loyiha va vazifalarni boshqarish SaaS platformasi.

Tizim kichik startaplardan tortib yirik korxonalargacha bo'lgan jamoalarga vazifalarni vizual rejalashtirish, vaqtni nazorat qilish va loyihalarni o'z vaqtida topshirish imkonini beradi.

---

## ✨ Asosiy Imkoniyatlar va Afzalliklar

### 1. 🗂 Ichma-ich (Drill-Down / Multilevel) Arxitektura
* **Interaktiv Breadcrumb Menyusi:** Yuqori paneldagi `Workspace › Space › Loyiha › Ko'rinish` yo'li oddiy matn emas, balki har bir bo'g'ini ochiladigan interaktiv popoverlar bilan jihozlangan.
* **Qatlamli Filtrlar (Linear Style):** Oddiy brauzer select'lari o'rniga zamonaviy ichma-ich filtr popoveri:
  * ➔ *Ustuvorlik bo'yicha (Urgent, High, Medium, Low)*
  * ➔ *Mas'ul bo'yicha (Jonli qidiruv va avatarlar bilan)*
  * ➔ *Sprint bo'yicha (Faol va rejadagi sprintlar)*
  * ➔ *Teglar bo'yicha (Rangli yorliqlar)*
* **Kartalardagi `•••` Kontekst Menyusi:** Kanban doskasi va ro'yxatdagi har qanday vazifani ichiga kirmasdan turib doskaning o'zida statusini o'zgartirish, mas'ul tayinlash, ustuvorligini belgilash, milestone qilish yoki savatga yuborish.
* **Suzuvchi Ommaviy Amallar Dok-Paneli (Floating Bulk Dock):** Bir nechta vazifa belgilanganda ekran pastida macOS uslubidagi suzuvchi panel chiqadi.
* **Split "+ Yangi" Tugmasi:** Yangi vazifa, yangi sprint yoki yangi Wiki hujjatini 1 klikda yaratish.

### 2. 📊 Loyiha Boshqaruvining 9 Xil Ko'rinishi (Views)
1. **Overview (Umumiy Pasport):** Loyiha KPI statistikasi, maqsadli muddatlar, bajarilish foizi va muhim marralar (Milestones).
2. **Kanban Doskasi:** WIP limitlari, status ustunlari, ustuvorlik va mas'ul bo'yicha gorizontal qatorlar (**Swimlanes**), Drag-and-Drop.
3. **Jadval va Ro'yxat (List View):** Qulay guruhlash, ommaviy tahrirlash (Bulk Actions), saralash.
4. **Interaktiv Kalendar (Month View):** Vazifalarni kunlar bo'yicha ko'rish va sichqoncha bilan tortib boshqa kunga ko'chirish (Drag-and-Drop reschedule).
5. **Timeline / Gantt Grafikasi:** Boshlanish va tugash muddatlariga asoslangan real vaqt shkalasi.
6. **Sprintlar (Scrum / Agile):** Sprintlarni yaratish, maqsad belgilash, vazifalarni backlogdan sprintga o'tkazish.
7. **Loyiha Hujjatlari (Wiki Docs):** Loyiha talablari, arxitekturasi va qo'llanmalari uchun Markdown redaktor.
8. **Vaqt Hisobi (Time Sheets):** Jonli sekundomer (Stopwatch) va qo'lda yozilgan ish vaqtlari bo'yicha shaxsiy va jamoaviy hisobotlar.
9. **Loyiha Sozlamalari:** Loyiha ranglari, muddatlari, arxivlash va maxsus moslashtirilgan statuslar.

### 3. 🛡 Multi-Tenant RBAC va Xavfsizlik
* **Server-side Tenant Guard (`TenantAccessGuard`):** Har bir so'rov joriy workspace kontekstida tekshiriladi (IDOR va ma'lumotlar oqib ketishidan to'liq himoya).
* **Faol Qurilmalar va Sessiyalar Boshqaruvi:** Qaysi brauzer, qurilma va IP manzildan kirilganini ko'rish va masofadan turib sessiyani to'xtatish.
* **Xavfsiz Autentifikatsiya:** JWT Tokenlar, parolni xavfsiz tiklash, profil va interfeys zichligini (`Compact` / `Comfortable`) sozlash.

---

## 🛠 Texnologiyalar Staki

| Qism | Texnologiya | Tavsif |
|---|---|---|
| **Backend** | **PHP 8.2+ & Yii2 Framework** | RESTful API, 28+ jadvalli relyatsion arxitektura, RBAC |
| **Frontend** | **React 19, TypeScript, Vite** | Yuqori unumdorlikka ega SPA, zamonaviy komponentlar |
| **Styling** | **Tailwind CSS 3.4** | Moslashuvchan qorong'i dizayn (Dark Theme), silliq animatsiyalar |
| **State Management** | **Zustand** | Yengil va tezkor global holat boshqaruvi |
| **Belgilar & UI** | **Lucide Icons** | Zamonaviy piktogrammalar to'plami |
| **Ma'lumotlar Bazasi** | **MySQL 8.0 / SQLite (WAL)** | Ishlab chiqarishda MySQL, lokal yoki fallback holatda SQLite |
| **Konteynerlash** | **Docker & Docker Compose** | Ko'p bosqichli (Multi-stage) yig'ish, 1 ta yagona servis |

---

## 💻 Mahalliy Kompyuterda O'rnatish va Ishga Tushirish

### Talablar:
* **PHP 8.1+** (PDO, PDO_MySQL, PDO_SQLite, Mbstring, Zip kengaytmalari bilan)
* **Composer 2.x**
* **Node.js 20+** va **npm**

---

### 1-qadam: Backendni Sozlash

```bash
# Repozitoriyani yuklab oling
git clone https://github.com/sardorergashev09uzb-commits/FlowForge.git
cd FlowForge/backend

# PHP kutubxonalarini o'rnating
composer install

# Ma'lumotlar bazasi migratsiyalarini qo'llang (28+ jadval)
php yii migrate --interactive=0

# Demo ma'lumotlarni bazaga yozing (Seed)
php yii seed/run

# Xavfsizlik va RBAC testlarini tekshirib ko'ring
php yii test/run

# Backend serverni ishga tushiring (http://127.0.0.1:8080)
php -S 127.0.0.1:8080 -t web web/router.php
```

---

### 2-qadam: Frontendni Ishga Tushirish

Alohida yangi terminal oynasida:

```bash
cd FlowForge/frontend

# Node paketlarini o'rnating
npm install

# Dasturlash muhitini ishga tushiring (http://127.0.0.1:5173)
npm run dev
```

Brauzerda oching: **`http://127.0.0.1:5173`**

---

### ⚡ Bir Klikda Ishga Tushirish (Windows uchun)

Loyihaning bosh katalogidagi `start-dev.bat` faylini ikki marta bosish orqali backend va frontendni birdaniga ishga tushirishingiz mumkin:
```cmd
start-dev.bat
```

---

## 🐳 Docker Orqali Ishga Tushirish

Loyihada frontend va backendni yagona yengil konteynerga birlashtiruvchi tayyor `Dockerfile` mavjud:

```bash
# Docker orqali build qilish
docker build -t flowforge-app .

# Konteynerni ishga tushirish (port 8080)
docker run -d -p 8080:8080 --name flowforge flowforge-app
```

Shundan so'ng brauzerda **`http://localhost:8080`** manziliga kirsangiz, ham React interfeysi, ham Yii2 REST API yagona portda ishlaydi.

---

## 📡 REST API Asosiy Endpointlar Xaritasi

| Metod | Endpoint | Tavsif |
|---|---|---|
| `POST` | `/api/v1/auth/login` | Tizimga kirish va JWT token olish |
| `POST` | `/api/v1/auth/register` | Yangi foydalanuvchi va uning ilk workspace'ini ro'yxatdan o'tkazish |
| `GET` | `/api/v1/auth/me` | Joriy profil va faol sessiyalar haqida ma'lumot |
| `GET` | `/api/v1/workspaces` | Foydalanuvchi a'zo bo'lgan barcha ishchi muhitlar |
| `GET` | `/api/v1/workspaces/hierarchy?workspace_id={id}` | Butun loyiha va space daraxtini olish |
| `GET` | `/api/v1/projects?workspace_id={id}` | Loyihalar ro'yxati |
| `GET` | `/api/v1/projects/{id}` | Tanlangan loyihaning to'liq pasporti va statuslari |
| `GET` | `/api/v1/projects/{id}/tasks` | Loyihaga tegishli vazifalar (filtrlar va qidiruv bilan) |
| `POST` | `/api/v1/tasks` | Yangi vazifa yaratish |
| `PUT` | `/api/v1/tasks/{id}` | Vazifani tahrirlash (status, muddat, mas'ul, ustuvorlik) |
| `POST` | `/api/v1/tasks/{id}/move` | Kanban doskasida vazifani ustunlararo ko'chirish |
| `POST` | `/api/v1/tasks/{id}/time-entries` | Vazifaga ish vaqtini qo'shish |
| `POST` | `/api/v1/tasks/{id}/comments` | Vazifaga izoh qoldirish |
| `POST` | `/api/v1/tasks/{id}/attachments` | Vazifaga fayl/hujjat yuklash |
| `POST` | `/api/v1/workspaces/{id}/bulk-tasks` | Ommaviy amallar (bir vaqtning o'zida bir nechta vazifani o'zgartirish) |
| `GET` | `/api/v1/reports/overview?workspace_id={id}` | Tahliliy hisobotlar va diagramma ko'rsatkichlari |

---

## 📄 Litsenziya

Ushbu loyiha **MIT** litsenziyasi asosida tarqatiladi. Batafsil ma'lumot uchun repozitoriyadagi litsenziya qoidalariga qarang.

---

<p align="center">
  <b>FlowForge Enterprise</b> — Zamonaviy jamoaviy boshqaruv standarti.
</p>
