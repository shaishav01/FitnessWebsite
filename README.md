# Kinetra: fitness website + admin dashboard

A public marketing site and a staff dashboard for **Kinetra**, a fitness brand with cardio, Zumba & aerobics, strength, steam bath, personal trainers, diet plans and a healthy food court. Visitors can send a contact message or apply for a membership online; staff track both in the admin panel.

- **Public site:** gym-photo hero with an interactive 3D particle field, a services grid, a section for each of the seven services, an equipment gallery, coaching tracks, pricing (each plan lists exactly which services it covers), a membership application form, member stories, branch locations, an FAQ and a contact form. Light and dark themes, responsive down to phones.
- **Admin dashboard:** login, overview (customer, message and application totals with charts), add / edit / delete branches (city picked from a list of Indian cities), contact messages (mark handled), and membership applications (track status: new, contacted, enrolled, declined).
- **Backend:** Python, FastAPI, SQLAlchemy 2 (SQLite by default, PostgreSQL by config), JWT auth
- **Frontend:** plain HTML, CSS and JavaScript (no build step), Chart.js for the admin charts
- FastAPI serves both the API (`/api/...`) and the frontend, so there is one process to run.

## Run locally

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

- Public site: <http://localhost:8000/>
- Admin: <http://localhost:8000/admin/> (sections: Overview, Add branch, Manage branches, Contact messages, Membership applications)

On first run the database is created and filled with sample data, and an **admin password is generated and printed once in the terminal** (look for the "Admin account created" box). To choose your own instead, copy `backend/.env.example` to `backend/.env` and set `ADMIN_PASSWORD` before the first start. To reset a forgotten password: `python -m app.cli set-admin-password`.

Requires Python 3.10+. The pages load fonts from Google Fonts, Chart.js from jsDelivr and photos from Pexels, so they need internet access. If a photo fails to load, a gradient placeholder is shown.

## File structure

```
backend/
  requirements.txt
  .env.example              all settings, documented
  app/
    main.py                 app factory, security headers, static frontend mount
    config.py               settings (env / .env)
    database.py             engine + session (SQLite or PostgreSQL)
    models.py               Branch, Customer, Inquiry, MembershipApplication, RevenueRecord, AdminUser
    schemas.py              Pydantic request/response models + validation
    security.py             bcrypt hashing, JWT creation/verification
    ratelimit.py            in-memory rate limiter
    mailer.py               SMTP notifications for contact messages and membership applications
    catalog.py              services, membership plans, plan coverage, fitness goals (single source of truth)
    cities.py               Indian cities (+ state) for the branch dropdown
    seed.py                 admin bootstrap + realistic sample data (customers, messages, applications)
    cli.py                  clear sample data, CSV import, reset password
    routes/
      public.py             catalog, branches, POST contact message, POST membership application (no auth)
      auth.py               POST login, GET me
      branches.py           cities, list/create/edit/delete branches (admin)
      inquiries.py          contact messages: list, mark handled / reopen   (admin)
      memberships.py        membership applications: list, set status      (admin)
      metrics.py            totals + monthly series                         (admin)
frontend/
  index.html                public site
  admin/index.html          login + dashboard
  css/ base.css site.css admin.css
  js/  theme-init.js theme.js particles.js site.js admin.js
  assets/ logo.svg favicon.svg
```

## API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/public/catalog` | no | services, plans and fitness goals (drive pricing and the application form) |
| GET | `/api/public/branches` | no | branch list for the Locations section and the application form |
| POST | `/api/public/inquiries` | no | contact message (validated, rate-limited, emailed) |
| POST | `/api/public/memberships` | no | membership application (validated, rate-limited, emailed) |
| POST | `/api/auth/login` | no | returns a JWT (locks out after 5 failures / 15 min) |
| GET | `/api/auth/me` | yes | current admin |
| GET | `/api/admin/cities` | yes | Indian cities for the dropdown |
| GET / POST | `/api/admin/branches` | yes | list / create branch |
| PATCH / DELETE | `/api/admin/branches/{id}` | yes | edit (incl. city) / delete; `DELETE` needs `?force=true` when the branch has customers, and then removes them too |
| GET | `/api/admin/inquiries?status=&limit=&offset=` | yes | contact messages + counts |
| PATCH | `/api/admin/inquiries/{id}` | yes | body `{"status": "handled" \| "new"}` |
| GET | `/api/admin/memberships?status=&limit=&offset=` | yes | membership applications + counts |
| PATCH | `/api/admin/memberships/{id}` | yes | body `{"status": "new" \| "contacted" \| "enrolled" \| "declined"}` |
| GET | `/api/admin/metrics?months=12` | yes | totals and monthly customers / messages / applications |

Set `ENABLE_API_DOCS=true` to get interactive docs at `/api/docs`.

## Configuration

Everything is optional and set in `backend/.env` (see `.env.example`).

- **Database:** `DATABASE_URL`. Default is SQLite (`backend/fitness.db`). For PostgreSQL install the driver (`pip install "psycopg[binary]"`) and set `DATABASE_URL=postgresql+psycopg://user:pass@host:5432/dbname`.
- **Notification email:** set `INQUIRY_NOTIFY_EMAIL` (recipient) plus `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`. Every contact message and membership application is saved to the database first; the email is sent in the background, and a mail failure is logged but never shown to the visitor. Without SMTP settings, emails are skipped.
- **Services, prices, plan coverage and fitness goals:** edit `backend/app/catalog.py`; the pricing section, the plan summary and the application form update on restart. The service sections and photo grid themselves are in `frontend/index.html`, so a new service needs an entry in both places.

## Replacing the sample data with live data

Sample rows are flagged `is_sample`, so your own data is never touched.

1. Set `SEED_SAMPLE_DATA=false` in `backend/.env`.
2. Remove the demo data: `python -m app.cli clear-sample`
3. Add your branches in the admin dashboard (**Add branch**). Real messages and applications arrive through the website forms.
4. Import existing customers and revenue from CSV (branches must exist first; names must match exactly):

```bash
python -m app.cli import customers customers.csv   # name,email,phone,branch,plan,joined_at[,is_active]
python -m app.cli import revenue revenue.csv       # customer_email,branch,amount_inr,plan,paid_on
```

Revenue records are stored but no longer shown on the dashboard. Dates are `YYYY-MM-DD`, amounts are whole rupees, and `plan` is `spark`, `surge` or `apex` (or any id you add in `catalog.py`). For a clean slate you can also delete `backend/fitness.db` and restart.

## Notes for production

- Run behind HTTPS (for example nginx or Caddy) and start uvicorn with `--proxy-headers` so rate limits see the real client IP. Set `SECRET_KEY` and `ADMIN_PASSWORD` explicitly.
- Rate limits are in-memory and per process; with several workers, add limits at the proxy as well.
- Tables are created automatically on startup. For schema changes over time, add Alembic migrations.
- The admin token lives in `sessionStorage` and expires after `ACCESS_TOKEN_MINUTES` (default 60). A strict Content-Security-Policy is sent with every response; if you add a new external script, font or image host, allow it in `CSP` in `backend/app/main.py`.

## Content you should replace before launch

The following are placeholders written for the demo: hero numbers ("12k+ members", "40+ coaches", "6 cities"), service facts (machine counts, class counts and lengths, hours, steam temperature), the Zumba & aerobics class limits per plan, coaching tracks, the three member stories and the FAQ answers. They live in `frontend/index.html`. Plan names and prices are in `backend/app/catalog.py`. Branch cards come from the database.

## Photos

All images (hero, services, equipment, coaching) are hot-linked from the Pexels CDN (free to use under the [Pexels licence](https://www.pexels.com/license/)); each has a gradient fallback if it fails to load. To swap one, change the photo id in its `<img src="https://images.pexels.com/photos/ID/...">`. To host images yourself, put them in `frontend/assets/` and update the `img-src` rule in `backend/app/main.py`.

## Design notes

- **Motion:** only `transform` and `opacity` are animated. Tilt and parallax run in `requestAnimationFrame`, parallax only touches elements on screen, tilt is mouse-only, and parallax is switched off on narrow screens. With `prefers-reduced-motion`, all animation, tilt and parallax are disabled and content is shown immediately.
- **Theme:** light and dark follow the OS on first visit, then the toggle choice is remembered (`localStorage`). The admin shares the same tokens.
- **Hero particles:** `frontend/js/particles.js` draws a 3D particle field on a canvas over the gym photo. It tilts with the cursor, pushes particles away and links them to the pointer. It pauses when off-screen or when the tab is hidden, uses fewer particles on phones, and draws a single still frame under `prefers-reduced-motion`.
- **Charts:** colours come from a colour-blind-safe categorical palette; every chart has a Chart/Table switch, and the current month is drawn dashed because it is month-to-date.
