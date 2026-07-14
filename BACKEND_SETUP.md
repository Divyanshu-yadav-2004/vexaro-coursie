# Vexaro KYC — Full Stack Setup Guide

## 🏗️ Stack
| Layer | Tech |
|---|---|
| Frontend | React + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| Database | PostgreSQL |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| File Uploads | Multer (disk storage) |

---

## 📁 Project Structure

```
vexaro/
├── src/                    ← React Frontend
│   ├── components/
│   ├── utils/api.js        ← All API calls (replaces storage.js)
│   └── App.jsx
├── backend/                ← Express Backend
│   ├── src/
│   │   ├── index.js        ← Entry point (port 5000)
│   │   ├── routes/         ← auth.js, kyc.js, users.js
│   │   ├── middleware/     ← auth.js, roleGuard.js
│   │   └── db/index.js     ← PostgreSQL pool
│   ├── db/schema.sql       ← Database schema
│   ├── setup-db.js         ← One-time DB setup script
│   ├── uploads/            ← KYC document files (auto-created)
│   └── .env                ← Environment variables
└── vite.config.js          ← Proxies /api → localhost:5000
```

---

## 🚀 Setup Steps

### Step 1 — PostgreSQL Database

**Option A: Local PostgreSQL**
1. Install PostgreSQL if not already installed
2. Open `psql` and create the database:
   ```sql
   CREATE DATABASE vexaro_kyc;
   ```
3. Update `backend/.env`:
   ```
   DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/vexaro_kyc
   ```

**Option B: Neon (Free Cloud PostgreSQL — Recommended)**
1. Go to [neon.tech](https://neon.tech) → Create free account
2. Create a new project → Copy the connection string
3. Update `backend/.env`:
   ```
   DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/vexaro_kyc?sslmode=require
   ```

---

### Step 2 — Run Database Schema

```bash
cd backend
npm run setup-db
```

This creates all tables and seeds admin/owner accounts.

---

### Step 3 — Start Backend

```bash
cd backend
npm run dev
```

Backend runs on → **http://localhost:5000**  
Health check → **http://localhost:5000/api/health**

---

### Step 4 — Start Frontend

```bash
# In the root vexaro/ folder
npm run dev
```

Frontend runs on → **http://localhost:5173**

> Vite automatically proxies `/api/*` → `localhost:5000` so no CORS issues.

---

## 🔐 Default Credentials

| Role | Email | Password |
|---|---|---|
| Admin | admin@kycportal.com | `admin@kyc123` |
| Owner | owner@kycportal.com | `owner@kyc123` |

> ⚠️ Change these passwords in production!

---

## 📡 API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, get JWT token |
| GET | `/api/auth/me` | Get current user (JWT required) |

### KYC
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/kyc/submit` | Upload documents (multipart/form-data) |
| GET | `/api/kyc/my` | Get my KYC record |
| GET | `/api/kyc/all` | All records (admin/owner only) |
| PATCH | `/api/kyc/:id/status` | Approve/reject (admin/owner only) |

### Users
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/users` | All users (admin/owner only) |
| PATCH | `/api/users/profile` | Update own profile |

---

## 🌐 Production Deployment

Set these environment variables in your hosting platform:
```
DATABASE_URL=your_production_postgres_url
JWT_SECRET=a_very_long_random_secret_string
NODE_ENV=production
PORT=5000
```

For the frontend, set:
```
VITE_API_URL=https://your-backend-domain.com/api
```

---

## WhatsApp KYC Approval Notifications

The backend sends a WhatsApp Business Cloud API message automatically when a KYC record changes from any non-approved status to `approved`.

Set these variables in `backend/.env`:

```env
WHATSAPP_PHONE_NUMBER_ID=your_meta_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_meta_permanent_or_system_user_token
WHATSAPP_API_VERSION=v20.0
WHATSAPP_DEFAULT_COUNTRY_CODE=91
```

Recommended production template setup:

```env
WHATSAPP_KYC_APPROVED_TEMPLATE_NAME=kyc_approved
WHATSAPP_KYC_APPROVED_TEMPLATE_LANGUAGE=en_US
WHATSAPP_KYC_APPROVED_TEMPLATE_INCLUDE_NAME=true
```

Create and approve the template in Meta WhatsApp Manager. If `WHATSAPP_KYC_APPROVED_TEMPLATE_NAME` is set, the backend sends a template message and passes the customer name as body parameter `{{1}}`. If your template has no body parameters, set `WHATSAPP_KYC_APPROVED_TEMPLATE_INCLUDE_NAME=false`.

If no template name is configured, the backend falls back to a plain text message. That is useful for local/sandbox testing, but production business-initiated notifications normally need an approved WhatsApp template.

Approval response example:

```json
{
  "message": "KYC approved successfully",
  "kyc": {
    "id": 1,
    "userId": 3,
    "status": "approved"
  },
  "whatsapp": {
    "sent": true,
    "skipped": false,
    "to": "*******3210",
    "mode": "template",
    "status": 200,
    "messageId": "wamid..."
  }
}
```

End-to-end test:

1. Add the WhatsApp environment variables and restart the backend.
2. Ensure the test user has a registered mobile number in international format, or a 10-digit Indian number when `WHATSAPP_DEFAULT_COUNTRY_CODE=91`.
3. Log in as admin or owner and approve a pending KYC request.
4. Confirm the approval API response includes `whatsapp.sent: true`.
5. Check backend logs for `[whatsapp] notification sent` and the masked recipient number.
6. Confirm the message arrives on the user's WhatsApp number.

Failure checks:

- `whatsapp_not_configured`: missing `WHATSAPP_PHONE_NUMBER_ID` or `WHATSAPP_ACCESS_TOKEN`.
- `missing_mobile`: the user does not have a registered mobile number.
- `sent: false` with `status`/`response`: Meta returned an API error; verify token permissions, phone number ID, recipient opt-in/test-number setup, and template approval.

Meta reference: [WhatsApp Cloud API send messages](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages).
