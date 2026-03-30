# 🏙️ CleanCity AI – Smart Municipal Waste Surveillance

> **AI-powered enforcement for cleaner, smarter cities**

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.8+
- MongoDB (local or Atlas)

### 1. Backend
```bash
cd backend
npm install
# Edit .env if needed (MongoDB URI, JWT secret)
node utils/seed.js   # Seed demo users & reports
npm run dev           # Starts on http://localhost:5000
```

### 2. AI Service
```bash
cd ai-service
pip install -r requirements.txt
python main.py        # Starts on http://localhost:8000
```
> YOLOv8 model (`yolov8n.pt`) auto-downloads on first run.

### 3. Frontend
```bash
cd frontend
npm install
npm run dev           # Starts on http://localhost:5173
```

---

## 🔐 Demo Login Credentials

| Role | Email | Password |
|------|-------|----------|
| 🏛 Super Admin | superadmin@cleancity.com | admin123 |
| 🧑‍💼 Ward Admin | admin@cleancity.com | admin123 |
| 👷 Field Worker | worker@cleancity.com | admin123 |
| 👤 Citizen | citizen@cleancity.com | admin123 |

---

## 🏗️ Architecture

```
frontend (React + Vite)  :5173
     ↕ REST API + Socket.io
backend (Node.js + Express)  :5000
     ↕ MongoDB (GeoJSON + RBAC)
     ↕ HTTP
ai-service (Python FastAPI)  :8000
     ↕ YOLOv8 inference
```

---

## 📦 Module Overview

| Module | Description |
|--------|-------------|
| **Auth** | JWT login, bcrypt, RBAC (4 roles) |
| **AI Detection** | YOLOv8 image + CCTV frame detection |
| **Citizen Reporting** | GPS-tagged photo upload |
| **Task Management** | Assign → In Progress → Complete workflow |
| **Real-time Alerts** | Socket.io rooms per role |
| **Analytics** | Ward stats, trends, hotspots (GeoJSON) |
| **Audit Logs** | Full governance trail |
| **Security** | Helmet, CORS, rate limiting, validation |

---

## 🌐 API Endpoints

```
POST /api/auth/register        Register
POST /api/auth/login           Login (returns JWT)
GET  /api/auth/me              Current user

POST /api/reports              Submit report (image upload)
GET  /api/reports              List reports (role-filtered)
GET  /api/reports/stats        Aggregated stats

POST /api/tasks                Assign cleanup task (admin)
GET  /api/tasks                List tasks
PUT  /api/tasks/:id            Update status / upload completion

GET  /api/analytics/dashboard  Overview stats
GET  /api/analytics/hotspots   GeoJSON hotspot clusters
GET  /api/analytics/trends     Time-series (last N days)
GET  /api/analytics/workers    Worker performance
GET  /api/analytics/wards      Ward-level breakdown

GET  /api/users                List all users (superadmin)
PUT  /api/users/:id/role       Change user role (superadmin)
GET  /api/audit                Audit logs (superadmin)
```

---

## 🤖 AI Service Endpoints

```
POST /detect-image   # Citizen image upload → YOLOv8 detection
POST /detect-frame   # CCTV base64 frame → YOLOv8 detection
GET  /health         # Health check
```

---

## 🚀 Deployment

| Component | Platform |
|-----------|----------|
| Frontend | Vercel |
| Backend | AWS / Render |
| AI Service | GPU Server / RunPod |
| Database | MongoDB Atlas |

---

## 📁 Project Structure

```
clean_city/
├── backend/
│   ├── config/         MongoDB connection
│   ├── models/         User, Report, Task, AuditLog
│   ├── middleware/     auth.js, audit.js, upload.js
│   ├── routes/         auth, reports, tasks, analytics, users, audit
│   ├── services/       aiService, socketService, notificationService
│   ├── utils/          helpers.js, seed.js
│   └── server.js
├── frontend/
│   └── src/
│       ├── context/    AuthContext, SocketContext
│       ├── services/   api.js (all Axios calls)
│       ├── pages/
│       │   ├── citizen/    Dashboard, NewReport
│       │   ├── admin/      Dashboard, TaskManagement
│       │   └── superadmin/ Dashboard, UserManagement, AuditLogs
│       └── components/ Sidebar, MapView
└── ai-service/
    ├── main.py         FastAPI app
    ├── detector.py     YOLOv8 wrapper
    └── requirements.txt
```

---

*Built with ❤️ for smarter municipal governance*
