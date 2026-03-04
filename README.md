# 360° Executive Evaluation System

## ระบบประเมินผู้บริหาร 360 องศา

ระบบประเมิน 360 องศาสำหรับผู้บริหารระดับ C-Suite/VP ที่เน้นการวัดความฉลาดทางอารมณ์ (EQ) การทำงานเป็นทีม การสื่อสาร และการผสานความร่วมมือเชิงกลยุทธ์

---

## Features

- **Admin Dashboard**: จัดการรอบการประเมิน, เพิ่มผู้ประเมิน, ส่งรหัสผ่านทางอีเมล
- **Evaluation Form**: แบบประเมิน 4 ด้าน ทั้ง Rating (1-5) และ Open-ended Feedback
- **Auto Password**: สร้างรหัสผ่านแบบสุ่มและส่งทางอีเมลอัตโนมัติ
- **One-time Evaluation**: ผู้ประเมินทำแบบประเมินได้เพียงครั้งเดียว
- **Period Control**: กำหนดช่วงเวลาการประเมิน พร้อมปิดระบบอัตโนมัติเมื่อหมดเวลา
- **Progress Monitoring**: ดูสถานะความคืบหน้าแบบ Real-time
- **Report Generation**: รายงานผลประเมินพร้อมพิมพ์/ดาวน์โหลด PDF
- **Email Reminders**: ส่งอีเมลแจ้งเตือนผู้ที่ยังไม่ได้ประเมิน
- **Responsive Design**: ใช้งานได้ทุกอุปกรณ์

---

## Tech Stack

| Component    | Technology                |
|-------------|---------------------------|
| Backend     | Node.js + Express         |
| Database    | SQLite (better-sqlite3)   |
| Frontend    | HTML/CSS/JS + Bootstrap 5 |
| Email       | Nodemailer (SMTP)         |
| PDF Export  | html2pdf.js               |

---

## Quick Start (การติดตั้งแบบเร็ว)

### Prerequisites

- [Node.js](https://nodejs.org/) v16 หรือสูงกว่า
- Git

### 1. Clone Repository

```bash
git clone https://github.com/<your-username>/360deg-evaluation.git
cd 360deg-evaluation
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
# คัดลอกไฟล์ตัวอย่าง
cp .env.example .env

# แก้ไขค่าใน .env ตามต้องการ
```

**ค่าที่ต้องตั้ง ใน `.env`:**

```env
# Email Configuration (SMTP)
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=info@365holding.co.th
SMTP_PASS=ev@lmanagement

# Server
PORT=3000
SESSION_SECRET=<เปลี่ยนเป็นค่าสุ่มที่ปลอดภัย>

# Admin Login
ADMIN_EMAIL=admin@365holding.co.th
ADMIN_PASSWORD=admin360eval
```

### 4. Start Server

```bash
npm start
```

Server จะเริ่มทำงานที่ `http://localhost:3000`

---

## Usage Guide (คู่มือการใช้งาน)

### สำหรับ Admin

1. **เข้า Admin Panel**: ไปที่ `http://localhost:3000/admin`
2. **ล็อกอิน**: ใช้อีเมลและรหัสผ่านที่ตั้งไว้ใน `.env`
3. **สร้างรอบการประเมิน**: 
   - ตั้งชื่อรอบ เช่น "Q1/2026"
   - กำหนดวันเริ่มต้นและวันสิ้นสุด
4. **เพิ่มผู้ประเมิน**: 
   - กรอกอีเมลทีละบรรทัด
   - ระบบจะสร้างรหัสผ่านแบบสุ่มให้อัตโนมัติ
5. **ส่งรหัสผ่าน**: กดปุ่ม "ส่งรหัสผ่านทั้งหมดทางอีเมล"
6. **ติดตามความคืบหน้า**: ดูได้ที่แท็บ "ความคืบหน้า"
7. **ส่งแจ้งเตือน**: กดปุ่ม "ส่งแจ้งเตือนผู้ที่ยังไม่ได้ประเมิน"
8. **ดูรายงาน**: แท็บ "รายงาน" → กด "ดูรายงาน" ของแต่ละคน

### สำหรับผู้ประเมิน

1. ได้รับอีเมลพร้อมรหัสผ่าน
2. เข้าสู่ระบบที่ `http://localhost:3000`
3. เลือกผู้ถูกประเมินแต่ละท่าน
4. ให้คะแนน 1-5 ในทุกหัวข้อ + เขียนข้อเสนอแนะ
5. ทำครบทุกคนแล้วกด "ส่งแบบประเมินทั้งหมด"
6. **⚠️ ทำได้ครั้งเดียวเท่านั้น**

---

## Deployment (การ Deploy บน Server)

### Option 1: VPS / Cloud Server

```bash
# 1. SSH เข้าเซิร์ฟเวอร์
ssh user@your-server

# 2. Clone และติดตั้ง
git clone https://github.com/<your-username>/360deg-evaluation.git
cd 360deg-evaluation
npm install

# 3. ตั้งค่า .env
cp .env.example .env
nano .env  # แก้ไขค่า

# 4. รันด้วย PM2 (สำหรับ production)
npm install -g pm2
pm2 start server.js --name "360eval"
pm2 save
pm2 startup
```

### Option 2: Docker

```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

```bash
docker build -t 360eval .
docker run -d -p 3000:3000 --env-file .env --name 360eval 360eval
```

### Option 3: Railway / Render / Fly.io

1. Push project ไปที่ GitHub
2. เชื่อมต่อ GitHub repo กับ Railway/Render
3. ตั้ง Environment Variables ตาม `.env.example`
4. Deploy อัตโนมัติ

### HTTPS / Domain (สำหรับ Production)

แนะนำใช้ Nginx reverse proxy + Let's Encrypt SSL:

```nginx
server {
    listen 80;
    server_name eval.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name eval.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/eval.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/eval.your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Project Structure

```
360deg-evaluation/
├── server.js            # Express server (main entry)
├── database.js          # SQLite database operations
├── email.js             # Email service (Nodemailer)
├── evaluationData.js    # Evaluation topics & questions data
├── package.json
├── .env                 # Environment variables (not in git)
├── .env.example         # Template for .env
├── .gitignore
├── 360degEval.md        # System specification
├── README.md            # This file
└── public/
    ├── index.html       # User login page
    ├── admin.html       # Admin dashboard
    ├── evaluate.html    # Evaluation form
    ├── report.html      # Report viewer (with PDF export)
    └── css/
        └── style.css    # Custom styles
```

---

## Database Schema

ระบบใช้ SQLite ไฟล์เดียว (`evaluation.db`) ซึ่งจะถูกสร้างอัตโนมัติเมื่อเริ่มระบบ

| Table                   | Description                          |
|------------------------|--------------------------------------|
| `evaluation_cycles`    | รอบการประเมิน (ชื่อ, วันเริ่ม, วันสิ้นสุด) |
| `users`                | ผู้ประเมิน (อีเมล, รหัสผ่าน, สถานะ)      |
| `rating_evaluations`   | คะแนนรายหัวข้อ (Part A)               |
| `openended_evaluations`| ข้อเสนอแนะแบบเปิด (Part B)            |

---

## Evaluation Topics (หัวข้อการประเมิน)

### Part A: Rating (คะแนน 1-5)

1. **ความฉลาดทางอารมณ์และการตระหนักรู้ตนเอง** (4 หัวข้อย่อย)
2. **การทำงานเป็นทีมและการสร้างความร่วมมือ** (4 หัวข้อย่อย)
3. **การสื่อสารและการสร้างแรงบันดาลใจ** (3 หัวข้อย่อย)
4. **การผสานความร่วมมือเชิงกลยุทธ์** (4 หัวข้อย่อย)

### Part B: Open-ended Feedback (4 ด้าน × 3 คำถาม = 12 คำถาม)

### Rating Scale

| คะแนน | ระดับ | ความหมาย |
|-------|-------|----------|
| 1 | ต้องปรับปรุงอย่างเร่งด่วน | แทบไม่เคยแสดงพฤติกรรมนี้ |
| 2 | ต่ำกว่าความคาดหวัง | แสดงเป็นบางครั้ง ไม่สม่ำเสมอ |
| 3 | ตามความคาดหวัง | แสดงสม่ำเสมอในสถานการณ์ปกติ |
| 4 | เกินความคาดหวัง | เป็นแบบอย่างที่ดี |
| 5 | โดดเด่นมาก | สร้างแรงบันดาลใจและช่วยพัฒนาผู้อื่น |

---

## Security Notes

- รหัสผ่านผู้ประเมินเป็นแบบสุ่ม ใช้ครั้งเดียว
- Session หมดอายุใน 4 ชั่วโมง
- ผู้ประเมินทำแบบประเมินได้เพียง 1 ครั้ง
- ระบบปิดอัตโนมัติเมื่อหมดช่วงเวลาประเมิน
- **Production**: ควรเปลี่ยน `SESSION_SECRET`, ใช้ HTTPS, และตั้งรหัสผ่าน Admin ที่ปลอดภัย

---

## Reset / New Cycle (การเริ่มต้นรอบใหม่)

1. เข้า Admin Panel
2. สร้างรอบการประเมินใหม่ (รอบเดิมจะถูกปิดอัตโนมัติ)
3. เพิ่มผู้ประเมินรอบใหม่
4. ส่งรหัสผ่านใหม่ทางอีเมล

ข้อมูลรอบเก่าจะยังคงอยู่ในฐานข้อมูลเพื่อการเปรียบเทียบ

---

## Test Accounts (สำหรับทดสอบ)

อีเมลทดสอบที่ถูก prefill ไว้ใน Admin Panel:

| Email | Purpose |
|-------|---------|
| khala1391@hotmail.com | Test User 1 |
| khala1391@gmail.com | Test User 2 |
| vmcar1391@gmail.com | Test User 3 |

---

## License

Internal use only - 365 Holding Co., Ltd.
