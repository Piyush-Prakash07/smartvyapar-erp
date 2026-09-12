# 📊 SmartVyapar ERP — Intelligent Cloud Enterprise & Finance Suite

<p align="center">
  <a href="https://smartvyapar-erp-1.onrender.com" target="_blank">
    <img src="https://img.shields.io/badge/Live%20Demo-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white" alt="Live Demo" />
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19.x-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/NestJS-11.x-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS 11" />
  <img src="https://img.shields.io/badge/TypeScript-5.7+-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Prisma-7.x-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma ORM" />
  <img src="https://img.shields.io/badge/PostgreSQL-16+-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/TailwindCSS-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS v4" />
  <img src="https://img.shields.io/badge/Vite-8.x-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite 8" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License MIT" />
</p>

---

## 🌟 Overview

**SmartVyapar ERP** is a modern, full-stack, enterprise-grade business management and financial accounting software crafted for Indian SMEs, retailers, wholesalers, and multi-branch enterprises. Built with extreme attention to performance, security, and aesthetics, SmartVyapar delivers end-to-end management for **GST-compliant invoicing**, **double-entry party ledgers (Khata)**, **real-time perpetual inventory control**, **multi-channel payment tracking**, and **granular multi-company management**.

---

## 📸 Key Capabilities & Highlights

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   SMARTVYAPAR ERP                                      │
├──────────────────┬──────────────────┬──────────────────┬───────────────────────────────┤
│ 🧾 GST Invoicing │ 📦 Stock Ledger  │ 📖 Digital Khata │ 💳 Multi-Payment Register     │
│  • B2B / B2C     │  • Daily Balances│  • Customer &    │  • Cash, UPI, Cheque, Cards   │
│  • CGST/SGST/IGST│  • Purchases &   │    Mahajan books │  • Instant PDF Receipts       │
│  • QR Payments   │    Sales sync    │  • Debit/Credit  │  • Real-time Reconciliation   │
│  • A4 & Thermal  │  • Adjustments   │    Timelines     │                               │
├──────────────────┴──────────────────┴──────────────────┴───────────────────────────────┤
│ 🏢 Multi-Tenant Multi-Company  •  🔐 Role-Based Access Control  •  🌓 Glassmorphic UI  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### ⚡ Core Feature Matrix

| Module | Features & Specifications |
| :--- | :--- |
| **🧾 GST Billing & Invoicing** | Auto-computes Intrastate (CGST + SGST) and Interstate (IGST) taxes, HSN code classification, dynamic UPI QR code generator for instant customer scan-and-pay, transport/logistics tracking, dual print modes (Thermal Slip & standard A4 PDF via `jsPDF` + `html2canvas`). |
| **🏢 Multi-Company Workspace** | Seamlessly switch between multiple companies under a single master account with strict tenant isolation and role-based permissions (`OWNER`, `ADMIN`, `ACCOUNTANT`, `CASHIER`, `INVENTORY_MANAGER`, `SALES_MANAGER`). |
| **📦 Dynamic Inventory Control** | Real-time stock valuation with cost, rate, and MRP tracking. Automatic inwards deduction from Sales Invoices and replenishment from Purchase Invoices with date-specific manual stock adjustments. |
| **👥 Customer & Mahajan Ledgers** | Dedicated directories for Customers (Buyers) and Mahajans (Suppliers/Vendors) featuring state-code validations, GSTIN checks, and instant contact records. |
| **📖 Digital Khata (Ledger Book)** | Comprehensive debit/credit account book displaying net pending balance, settlement history, and complete transaction breakdowns per party. |
| **📊 Daybook & Daily Register** | Granular daily timeline tracking of every cash, bank, and online transaction with intuitive date filters, opening/closing cash balances, and financial summaries. |
| **💳 Daily Payments Hub** | Record incoming customer payments and outgoing supplier disbursements across multiple channels (Cash, UPI, NEFT/RTGS, Cheque, Debit/Credit Card) with transaction references. |
| **🔐 Enterprise Authentication** | Dual-token authentication (short-lived JWT Access + Refresh token rotation), Bcrypt encryption, automated 6-digit OTP email verification via Nodemailer / Brevo SMTP. |
| **🎨 Glassmorphic Interface** | State-of-the-art UI with deep dark mode & clean light mode, responsive layout, smooth micro-interactions, built with Tailwind CSS v4 and Lucide icons. |

---

## 🏗️ System Architecture & Data Flow

```mermaid
flowchart TD
    subgraph Client ["Frontend (React 19 + Vite 8 + Tailwind CSS v4)"]
        UI[Glassmorphic UI / SPA]
        RQ[TanStack React Query Cache]
        AC[Auth & Multi-Company Context]
        PDF[jsPDF & Thermal Invoice Engine]
        QR[Dynamic UPI QR Code Engine]
    end

    subgraph Backend ["Backend API (NestJS 11 + Express + TypeScript)"]
        GW[CORS & Helmet Security & Rate Limiting]
        AUTH[Auth Guard & JWT Verification Pipe]
        CTRL[REST Controllers]
        SERV[Business Logic Services]
        VAL[Class-Validator & DTO Transformation]
        MAIL[Nodemailer / SMTP OTP Dispatcher]
    end

    subgraph Database ["Persistence Layer (PostgreSQL 16)"]
        PRISMA[Prisma ORM Client & Migrations]
        PG[(PostgreSQL Database)]
    end

    UI --> RQ
    RQ -->|HTTP / REST API (Axios)| GW
    GW --> AUTH
    AUTH --> CTRL
    CTRL --> VAL
    VAL --> SERV
    SERV --> MAIL
    SERV --> PRISMA
    PRISMA --> PG
```

---

## 🛠️ Technology Stack

### **Frontend**
- **Framework**: [React 19](https://react.dev/) + [Vite 8](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **State & Server Cache**: [TanStack Query v5](https://tanstack.com/query/latest)
- **Form Management & Validation**: [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)
- **Icons & Visuals**: [Lucide React](https://lucide.dev/)
- **Document Export & Generation**: [jsPDF](https://github.com/parallax/jsPDF) + [html2canvas](https://html2canvas.hertzen.com/)
- **QR Code Generation**: [qrcode.react](https://github.com/zpao/qrcode.react)

### **Backend**
- **Framework**: [NestJS 11](https://nestjs.com/) (Express platform)
- **ORM & Database Modeling**: [Prisma ORM 7](https://www.prisma.io/)
- **Database Engine**: [PostgreSQL 16+](https://www.postgresql.org/)
- **Security & Headers**: [Helmet](https://helmetjs.github.io/), [Passport JWT](http://www.passportjs.org/), [Cookie-Parser](https://github.com/expressjs/cookie-parser)
- **Validation**: [class-validator](https://github.com/typestack/class-validator) & [class-transformer](https://github.com/typestack/class-transformer)
- **Mailing Service**: [Nodemailer](https://nodemailer.com/) (Brevo / SMTP Relay)
- **Testing**: [Jest](https://jestjs.io/) & Supertest (Unit & End-to-End simulation suites)

---

## 📁 Repository Structure

```
smartvyapar/
├── backend/                        # NestJS 11 Server Application
│   ├── prisma/
│   │   ├── migrations/             # SQL migration files
│   │   └── schema.prisma           # Prisma Data Models & Relations
│   ├── src/
│   │   ├── common/                 # Config, Guards, Filters, Interceptors
│   │   ├── modules/
│   │   │   ├── auth/               # User registration, Login, OTP verification
│   │   │   ├── companies/          # Multi-company workspace management
│   │   │   ├── customers/          # Buyer directory & GSTIN records
│   │   │   ├── daybook/            # Cash flow & daily ledger registry
│   │   │   ├── invoices/           # Sales invoice creation, GST calculation
│   │   │   ├── items/              # Item catalog, pricing & inventory
│   │   │   ├── mahajans/           # Supplier & vendor directory
│   │   │   ├── mail/               # Transactional email & OTP delivery
│   │   │   ├── payments/           # Inward & outward payment records
│   │   │   ├── purchase-invoices/  # Vendor purchase bills & replenishment
│   │   │   ├── stock/              # Perpetual inventory adjustments & balance
│   │   │   └── store-subparts/     # Multi-branch / store partition routing
│   │   ├── app.module.ts           # Root module registration
│   │   └── main.ts                 # Bootstrap with Helmet, CORS & validation
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                       # React 19 + Vite 8 Client Application
│   ├── src/
│   │   ├── features/
│   │   │   ├── auth/               # Login, Register, OTP verification screens
│   │   │   ├── customers/          # Customer CRUD & balances
│   │   │   ├── dashboard/          # Analytics metrics, charts & summary
│   │   │   ├── daybook/            # Real-time transaction registers
│   │   │   ├── invoices/           # GST Invoice Builder & PDF generator
│   │   │   ├── items/              # Item master management
│   │   │   ├── khata/              # Party ledger & balance settlements
│   │   │   ├── mahajans/           # Supplier management
│   │   │   ├── payments/           # Payment entry & voucher print
│   │   │   ├── stock/              # Stock ledger & valuation
│   │   │   └── theme/              # Light / Dark mode context
│   │   ├── App.tsx                 # Core layout & tab routing
│   │   ├── main.tsx                # React DOM entry
│   │   └── index.css               # Design system & Tailwind CSS v4 tokens
│   ├── package.json
│   └── vite.config.ts
│
├── .env.example                    # Root environment configuration template
├── package.json                    # Monorepo workspaces & build orchestrator
└── README.md                       # Documentation & Developer Guide
```

---

## ⚙️ Prerequisites

Ensure your environment satisfies the following minimum requirements:

- **Node.js**: `v20.0.0` or higher (LTS recommended)
- **npm**: `v10.0.0` or higher (or `pnpm` / `yarn`)
- **PostgreSQL**: `v14.0` or higher (Local installation or Cloud instance like Supabase, Neon, AWS RDS)

---

## 🚀 Quick Start Guide

### 1. Clone the Repository

```bash
git clone https://github.com/Piyush-Prakash07/smartvyapar-erp.git
cd smartvyapar-erp
```

### 2. Install Dependencies

Install all dependencies across both workspaces from the root directory:

```bash
npm install
```

---

### 3. Configure Environment Variables

#### **Backend Configuration**
Create a `.env` file in the `backend/` directory (or copy from `backend/.env.example`):

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:
```env
# Database Connection (PostgreSQL)
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/smartvyapar?schema=public"

# Security Secrets (Use secure 32+ character strings)
JWT_ACCESS_SECRET="your-32-character-random-jwt-access-secret"
JWT_REFRESH_SECRET="your-32-character-random-jwt-refresh-secret"

# Server Configuration
PORT=5000
NODE_ENV="development"

# CORS Allowed Origins (Comma-separated)
FRONTEND_URL="http://localhost:5173"
FRONTEND_URLS="http://localhost:5173,http://127.0.0.1:5173"

# SMTP Email Configuration (Optional for Dev, fallback logs OTP to console)
SMTP_HOST="smtp-relay.brevo.com"
SMTP_PORT=587
SMTP_USER="your-smtp-login-email"
SMTP_PASS="your-smtp-master-key"
SMTP_FROM="SmartVyapar ERP <no-reply@smartvyapar.com>"
```

#### **Frontend Configuration**
Create a `.env` file in the `frontend/` directory (or copy from `frontend/.env.example`):

```bash
cp frontend/.env.example frontend/.env
```

Edit `frontend/.env`:
```env
# Backend API Base URL
VITE_API_URL="http://localhost:5000/api/v1"
```

---

### 4. Setup Database & Run Migrations

Generate the Prisma client and execute migrations to initialize database tables:

```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
cd ..
```

---

### 5. Launch the Application

You can start both frontend and backend concurrently from the root directory:

```bash
# Run both Backend & Frontend simultaneously
npm run dev
```

Alternatively, run them individually in separate terminals:

```bash
# Terminal 1: Start Backend (Port 5000)
npm run dev:backend

# Terminal 2: Start Frontend (Port 5173)
npm run dev:frontend
```

Open your browser and navigate to:
👉 **`http://localhost:5173`**

---

## 🔑 Environment Variables Reference

| Variable | Scope | Required | Description | Example |
| :--- | :--- | :---: | :--- | :--- |
| `DATABASE_URL` | Backend | **Yes** | PostgreSQL connection connection URI | `postgresql://user:pass@host:5432/dbname` |
| `JWT_ACCESS_SECRET` | Backend | **Yes** | Secret for signing short-lived access tokens | `7d8f9a2e3b...` (min 32 chars) |
| `JWT_REFRESH_SECRET` | Backend | **Yes** | Secret for signing long-lived refresh tokens | `a1b2c3d4e5...` (min 32 chars) |
| `PORT` | Backend | No | Port on which the NestJS server runs | `5000` (default) |
| `NODE_ENV` | Backend | No | Environment mode (`development` / `production`) | `development` |
| `FRONTEND_URL` | Backend | No | Primary allowed client origin for CORS | `http://localhost:5173` |
| `FRONTEND_URLS` | Backend | No | Comma-separated allowed client origins | `https://app.domain.com,http://localhost:5173` |
| `SMTP_HOST` | Backend | No | SMTP relay server for OTP delivery | `smtp-relay.brevo.com` |
| `SMTP_PORT` | Backend | No | SMTP relay port | `587` |
| `SMTP_USER` | Backend | No | SMTP username / login | `your-email@domain.com` |
| `SMTP_PASS` | Backend | No | SMTP API key / password | `secret-api-key` |
| `SMTP_FROM` | Backend | No | Display name & sender address | `"SmartVyapar" <no-reply@domain.com>` |
| `VITE_API_URL` | Frontend | No | Base REST endpoint for the backend API | `http://localhost:5000/api/v1` |

---

## 📡 Core API Reference

All backend endpoints are prefixed with `/api/v1` (except health check).

| Module | Method | Endpoint | Description | Auth |
| :--- | :---: | :--- | :--- | :---: |
| **Auth** | `POST` | `/api/v1/auth/register` | Create a new merchant user account | Public |
| **Auth** | `POST` | `/api/v1/auth/verify-email-otp` | Verify 6-digit email OTP | Public |
| **Auth** | `POST` | `/api/v1/auth/resend-email-otp` | Resend email verification OTP code | Public |
| **Auth** | `POST` | `/api/v1/auth/login` | Authenticate user & issue JWT tokens | Public |
| **Auth** | `POST` | `/api/v1/auth/refresh` | Rotate and issue new access token | Public (Cookie/Bearer) |
| **Auth** | `POST` | `/api/v1/auth/logout` | Revoke active refresh session | Required |
| **Companies** | `GET` | `/api/v1/companies` | List user's registered companies | Required |
| **Companies** | `POST` | `/api/v1/companies` | Create a new company profile | Required |
| **Invoices** | `GET` | `/api/v1/invoices` | List sales invoices with pagination & filters | Required |
| **Invoices** | `POST` | `/api/v1/invoices` | Generate new GST sales invoice | Required |
| **Purchase** | `GET` | `/api/v1/purchase-invoices` | List vendor purchase bills | Required |
| **Purchase** | `POST` | `/api/v1/purchase-invoices` | Create vendor purchase invoice | Required |
| **Items** | `GET` | `/api/v1/items` | Retrieve inventory item catalog | Required |
| **Items** | `POST` | `/api/v1/items` | Create new inventory item | Required |
| **Customers** | `GET` | `/api/v1/customers` | List registered customers & balances | Required |
| **Mahajans** | `GET` | `/api/v1/mahajans` | List suppliers & outstanding balances | Required |
| **Payments** | `GET` | `/api/v1/payments` | Fetch payments register & vouchers | Required |
| **Payments** | `POST` | `/api/v1/payments` | Record incoming or outgoing payment | Required |
| **Stock** | `GET` | `/api/v1/stock/ledger` | Calculate perpetual stock balance | Required |
| **Stock** | `POST` | `/api/v1/stock/adjust` | Record date-specific manual adjustment | Required |
| **Daybook** | `GET` | `/api/v1/daybook` | Get aggregated daily ledger records | Required |
| **Health** | `GET` | `/health` | API & database liveness check | Public |

---

## 🧪 Testing & Validation

Run comprehensive unit and end-to-end simulation suites:

```bash
# Run all backend unit & E2E tests
npm run test --workspace=backend

# Run test coverage analysis
npm run test:cov --workspace=backend

# Run frontend & backend static linting
npm run lint --workspace=backend
npm run lint --workspace=frontend
```

---

## 📦 Production Build

To compile both the NestJS server and Vite frontend bundle:

```bash
npm run build
```

The compiled bundles will be generated in:
- `backend/dist/`
- `frontend/dist/`

To start the production backend:
```bash
npm run start:prod --workspace=backend
```

---

## 🚢 Deployment Strategies

### **Backend (NestJS + PostgreSQL)**
- **Render / Railway / Fly.io / AWS ECS**: Deploy the `backend` workspace with the `start:prod` script. Configure environment variables in the provider dashboard.
- **Reverse Proxy**: Place behind Nginx or Cloudflare with `TRUST_PROXY=1` enabled.

### **Frontend (Vite SPA)**
- **Vercel / Netlify / Cloudflare Pages**: Point root directory to `frontend`, build command `npm run build`, output directory `dist`.
- Set `VITE_API_URL` environment variable pointing to your deployed backend URL.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'feat: Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Crafted with ❤️ for Indian businesses and global entrepreneurs.
</p>
