# Kaaralan Goli Soda

Full-stack distribution management for **Kaaralan Goli Soda** — Admin (manufacturer) and Dealer (retailer) portals with JWT cookie auth, stock control on approval, and live WebSocket notifications.

## Stack

- **Frontend:** React (Vite), Tailwind CSS v4, Manrope, Axios, TanStack Query, Zustand, React Hook Form + Zod, ECharts, Lottie, React Router
- **Backend:** FastAPI, SQLAlchemy 2 (async), Alembic, PostgreSQL, JWT httpOnly cookies, WebSockets

## Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+

## Database setup

```bash
# Create database (adjust user/password as needed)
psql -U postgres -c "CREATE DATABASE kaaralan_goli_soda;"
```

Copy env files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Update `DATABASE_URL` in `backend/.env` if your Postgres credentials differ.

## Backend

```bash
cd backend
python -m venv venv

# Windows
.\venv\Scripts\activate
# macOS/Linux
# source venv/bin/activate

pip install -r requirements.txt
python -m alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

On first startup the API seeds an admin user and prints credentials (from env):

- Username: `admin`
- Password: `admin`

It also seeds these **test dealers** (username = password):

| Dealer | Username | Password |
|--------|----------|----------|
| Erode | `erode` | `erode` |
| Coimbatore | `coimbatore` | `coimbatore` |
| Tiruppur | `tiruppur` | `tiruppur` |
| Namakkal | `namakkal` | `namakkal` |
| Ooty | `ooty` | `ooty` |
| Dindigul | `dindigul` | `dindigul` |
| Kollimalai | `kollimalai` | `kollimalai` |
| Karur | `karur` | `karur` |
| Salem | `salem` | `salem` |

API docs: http://localhost:8000/docs

## Frontend

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173

## Roles & flows

| Role | Capabilities |
|------|----------------|
| **Admin** | Products/variants, dealers (auto credentials), stocks, prices, approve/reject orders, live dashboard + notification bell |
| **Dealer** | Place order (Flavour \| Glass \| PET matrix), order history |

**Stock rule:** quantities decrease only when an admin **approves** an order (atomic check + deduct + stock_movements).

## Auth notes

- Access token (15m) + refresh token (7d) in httpOnly cookies
- Refresh tokens rotate; reuse of a revoked token invalidates the session
- Frontend idle timeout (default 60 minutes) forces re-login

## Project layout

```
frontend/   React app
backend/    FastAPI app + alembic migrations
```

## Health check

```bash
curl http://localhost:8000/health
```

## Production deploy

Frontend → **Hostinger** (`https://kaaraalan.in`) via GitHub Actions FTP on push to `main`.  
Backend + Postgres → **Railway** (`https://api.kaaraalan.in`).

See **[DEPLOY.md](./DEPLOY.md)** for DNS, Railway variables, Hostinger FTP secrets, and the frontend workflow.
