# Deploy: Hostinger (frontend) + Railway (backend + Postgres)

This project is set up for:

| Piece | Where | URL |
|-------|--------|-----|
| Frontend (React `dist`) | Hostinger File Manager | https://kaaraalan.in |
| Backend (FastAPI) | Railway | https://api.kaaraalan.in |
| PostgreSQL | Railway Postgres | (internal `DATABASE_URL`) |

---

## 1. Create the API subdomain (required)

You need **`api.kaaraalan.in`** pointing at Railway. Do this in Hostinger DNS (domain is on Hostinger).

### A. Hostinger — add DNS record

1. Log in to [Hostinger](https://hpanel.hostinger.com) → **Domains** → **kaaraalan.in** → **DNS / Name Servers**
2. Add a record:

| Type | Name | Target / Points to | TTL |
|------|------|--------------------|-----|
| **CNAME** | `api` | `<your-service>.up.railway.app` | 300 or Auto |

   - You get the Railway hostname after creating the service (e.g. `kaaralan-api-production.up.railway.app`).
   - Prefer CNAME to Railway’s domain. If Hostinger forces A records only for some plans, use Railway’s docs for the current IP/target.

3. Save and wait for DNS (often a few minutes; up to 24–48h).

### B. Railway — attach custom domain

1. Open your backend service → **Settings** → **Networking** → **Custom Domain**
2. Add: `api.kaaraalan.in`
3. Railway will show the CNAME target if needed — match it in Hostinger
4. Wait until Railway shows the domain as **Verified** / SSL ready

Verify:

```bash
curl https://api.kaaraalan.in/health
```

Expected: `{"status":"ok","app":"Kaaralan Goli Soda"}`

---

## 2. Deploy backend + Postgres on Railway

### Create project

1. [railway.app](https://railway.app) → New Project
2. **Add PostgreSQL**
3. **Add service** from this GitHub repo (or CLI deploy)
4. Set **Root Directory** to `backend` (monorepo)
5. Railway uses `backend/Dockerfile` + `start.sh` (runs Alembic migrations, then Uvicorn)

### Railway variables (backend service)

Link Postgres so `DATABASE_URL` is injected, then set:

```env
SECRET_KEY=<long-random-string>
COOKIE_SECURE=true
COOKIE_DOMAIN=
FRONTEND_ORIGIN=https://kaaraalan.in
ADMIN_SEED_USERNAME=admin
ADMIN_SEED_PASSWORD=<strong-password>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
IDLE_SESSION_TIMEOUT_MINUTES=60
```

Notes:

- Leave **`COOKIE_DOMAIN` empty** so auth cookies are host-only on `api.kaaraalan.in` (works with `withCredentials` from `kaaraalan.in`).
- Optional: set `COOKIE_DOMAIN=.kaaraalan.in` if you prefer shared subdomain cookies.
- App auto-converts Railway’s `postgresql://…` URL to `postgresql+asyncpg://…`.
- Change the admin password after first login.

Schema: `start.sh` runs `alembic upgrade head` on every deploy.

---

## 3. Build & upload frontend to Hostinger

Env is already in `frontend/.env.production` (baked at build time):

```env
VITE_API_BASE_URL=https://api.kaaraalan.in/api/v1
VITE_WS_BASE_URL=wss://api.kaaraalan.in/api/v1/ws
VITE_IDLE_TIMEOUT_MINUTES=60
```

### Automated deploy (GitHub Actions)

On every push to `main`, [`.github/workflows/deploy-frontend.yml`](./.github/workflows/deploy-frontend.yml):

1. Installs frontend dependencies (`npm ci`)
2. Runs `npm run build`
3. Uploads `frontend/dist/` contents to Hostinger via FTP/FTPS
4. Syncs/overwrites files in `public_html`

Backend is unchanged — Railway still auto-deploys the API from GitHub separately.

#### GitHub Secrets to add

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Secret | Example / typical value | Where to get it |
|--------|-------------------------|-----------------|
| `FTP_SERVER` | `ftp.kaaraalan.in` or Hostinger hostname | Hostinger hPanel → **Websites** → your site → **Files** → **FTP Accounts** (or **Hosting** → **FTP**). Use the **FTP hostname** (often `ftp.yourdomain.com` or `ftp.hostinger.com`). |
| `FTP_USERNAME` | full FTP username | Same FTP Accounts page — create or copy the FTP user (often looks like `u123456789` or `u123456789.kaaraalan.in`). |
| `FTP_PASSWORD` | FTP password | Same page — set/reset the FTP account password. Prefer a dedicated FTP user limited to this site. |
| `FTP_SERVER_DIR` | `./` or `public_html/` | Path **relative to the FTP user’s home**, with a trailing slash. If the FTP account already lands inside `public_html`, use `./`. If the home is the hosting root, use `public_html/`. Confirm in File Manager / FTP client by seeing where you land after login. |

The workflow uses **FTPS on port 21** by default (see `.github/workflows/deploy-frontend.yml`). If deploy fails on TLS, edit the workflow: set `protocol: ftp` (still port `21`). This is FTP/FTPS, not Hostinger SFTP (often port `65002`).

**Notes**

- Never commit FTP passwords; secrets only.
- First run may take longer while the action builds a sync state file (`.ftp-deploy-sync-state.json`) on the server.
- `dangerous-clean-slate` is off; the action still syncs so remote files that are no longer in `dist` get removed over time as part of normal sync — treat `public_html` as owned by this app.
- To verify: **Actions** tab after a push to `main`, then open `https://kaaraalan.in/login`.
### Manual build (optional)

```bash
cd frontend
npm install
npm run build
```

### Manual upload (optional)

1. Hostinger → **File Manager** → open `public_html` (or the folder for `kaaraalan.in`)
2. Upload **contents** of `frontend/dist/` (including `.htaccess`)
3. Do **not** upload `.env` — Vite already embedded the values

`.htaccess` enables React Router deep links (`/login`, `/orders`, etc.).

### Important: marketing site

[https://kaaraalan.in](https://kaaraalan.in) currently shows a marketing site. Uploading this app to `public_html` **replaces** that site.

Options:

- Replace root with this admin/dealer app, **or**
- Put the app on another subdomain (e.g. `app.kaaraalan.in`) and keep marketing on the apex — then set `FRONTEND_ORIGIN=https://app.kaaraalan.in` and rebuild with matching `VITE_*` URLs.

---

## 4. Checklist after go-live

- [ ] `https://api.kaaraalan.in/health` OK
- [ ] `https://kaaraalan.in/login` loads
- [ ] Login works (cookies + CORS)
- [ ] WebSocket notifications work (wss)
- [ ] Admin password changed from seed default

### WhatsApp (optional)

See **[WHATSAPP.md](./WHATSAPP.md)** for full setup.

- [ ] Railway: `WHATSAPP_*` variables set, `WHATSAPP_ENABLED=true`
- [ ] Meta webhook Callback URL: `https://api.kaaraalan.in/api/v1/whatsapp/webhook`
- [ ] Meta Verify token matches `WHATSAPP_VERIFY_TOKEN`
- [ ] Utility templates approved (`order_received`, `order_approved`, `order_rejected`, `order_dispatched`)
- [ ] Meta payment method added (for business-initiated templates)
- [ ] Dealer phones stored as valid Indian mobiles

### If login fails (CORS / cookies)

- `FRONTEND_ORIGIN` must be exactly `https://kaaraalan.in` (no trailing slash)
- `COOKIE_SECURE=true` on HTTPS
- Frontend built with `https://api.kaaraalan.in/...` (not Railway’s `*.up.railway.app` if you use the custom domain)
- Browser must allow third-party… not needed here: `kaaraalan.in` and `api.kaaraalan.in` are same-site

---

## Local vs production env summary

**Frontend**

| File | Use |
|------|-----|
| `frontend/.env` | Local `npm run dev` |
| `frontend/.env.production` | Used automatically by `npm run build` |

**Backend**

| Place | Use |
|-------|-----|
| `backend/.env` | Local only (gitignored) |
| Railway Variables | Production |
