# PlatePredict — Mess Management & AI Optimization App

A full-stack web application that streamlines hostel dining operations, reduces food waste through AI-driven attendance prediction, and provides transparent financial tracking.

## Tech Stack

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **ORM:** Prisma
- **Database:** PostgreSQL 14+
- **Auth:** JWT (jsonwebtoken) + bcryptjs
- **Email:** Nodemailer (SMTP)
- **Payments:** Razorpay
- **Scheduling:** node-cron

### Frontend
- **Framework:** React 18 (Vite)
- **Routing:** React Router v6
- **HTTP Client:** Fetch API
- **Styling:** Vanilla CSS with custom design system

---

## Project Structure
```
platepredict/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   │   └── 001_ai_views_triggers.sql
│   └── seed.js
├── src/
│   ├── index.js
│   ├── config/
│   │   ├── prisma.js
│   │   └── razorpay.js
│   ├── middleware/
│   │   ├── auth.middleware.js
│   │   └── domain.middleware.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── student.routes.js
│   │   ├── manager.routes.js
│   │   └── webhook.routes.js
│   ├── cron/
│   │   └── token_expiry.js
│   └── utils/
│       └── email.util.js
├── client/               # React frontend
├── .env.example
├── .gitignore
└── package.json
```

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your DATABASE_URL, JWT_SECRET, SMTP, Razorpay keys
```

### 3. Initialize the database
```bash
npx prisma migrate dev --name init
psql $DATABASE_URL -f prisma/migrations/001_ai_views_triggers.sql
npx prisma generate
npm run prisma:seed
```

### 4. Start the server
```bash
npm run dev          # Development (nodemon)
npm start            # Production
```

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Initiate signup + send OTP |
| POST | `/api/v1/auth/verify-otp` | Verify OTP + set password |
| POST | `/api/v1/auth/login` | Login → JWT + role |

### Student (requires STUDENT role)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/student/dashboard` | Financials, today's menu, polls |
| POST | `/api/v1/student/poll` | Vote YES/NO on a meal |
| POST | `/api/v1/student/payment/initiate` | Create Razorpay payment order |
| GET | `/api/v1/student/history` | Meal/token/payment history |

### Manager (requires MANAGER role)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/manager/dashboard/upcoming-meal` | Poll aggregates |
| GET | `/api/v1/manager/ai/predict?menu_id=` | AI attendance prediction |
| GET | `/api/v1/manager/tokens/active?search=` | Active snack tokens |
| PUT | `/api/v1/manager/tokens/redeem` | Redeem a token |
| GET | `/api/v1/manager/defaulters` | Students with dues |
| POST | `/api/v1/manager/defaulters/remind` | Email reminders |
| GET | `/api/v1/manager/menus?date=` | List menus |
| POST | `/api/v1/manager/menus` | Create a menu |
| PUT | `/api/v1/manager/menus/:id` | Update a menu |
| DELETE | `/api/v1/manager/menus/:id` | Delete a menu |
| POST | `/api/v1/manager/attendance/record` | Record meal attendance |

### Webhook
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/webhook/payment-success` | Razorpay payment callback |

---

## Default Credentials (after seed)
```
Manager:  manager@college.edu  / Manager@1234
Student:  rahul.k@college.edu  / Student@1234
```

## Background Jobs
- **Token Expiry:** Runs every 30 min — expires unredeemed snack tokens after meal window closes
- **AI View Refresh:** Runs daily at 2 AM — refreshes the materialized view for prediction queries
