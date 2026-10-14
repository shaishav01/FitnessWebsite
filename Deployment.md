# Publishing Kinetra to production

The path below uses a single Linux server (Ubuntu) with Caddy for automatic HTTPS. The app is one process that serves the website, the admin panel and the API together, so there is only one thing to deploy. A short note on managed hosts like Render or Railway is at the end.

## 0. Before you start
- A domain name you control (e.g. `kinetra.example.com`) and a small server (1 vCPU / 1-2 GB RAM is enough).
- Your Gemini API key, and SMTP details if you want enquiry emails.
- Replace the placeholder content (hero numbers, stories, FAQ, facts) as listed in the README, and update `backend/knowledge/kinetra_knowledge_base.md` to match.

## 1. Point your domain at the server
Create a DNS **A record** for your domain pointing to the server's public IP. Wait a few minutes for it to propagate.

## 2. Prepare the server
```bash
ssh youruser@SERVER_IP
sudo apt update && sudo apt install -y python3 python3-venv python3-pip git ufw
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
```
Open only SSH, 80 and 443. The app itself will listen on localhost only.

## 3. Get the code onto the server
```bash
sudo mkdir -p /opt/kinetra && sudo chown $USER /opt/kinetra
git clone <your-repo-url> /opt/kinetra        # or copy the project folder with scp/rsync
cd /opt/kinetra/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```
The repo must include the `frontend/` folder next to `backend/`, because the backend serves it.

## 4. Choose the database
- **Simple (one server):** keep the default SQLite file. It works, but back it up (step 9) and run **one** app process only.
- **Recommended for growth:** PostgreSQL.
  ```bash
  sudo apt install -y postgresql
  sudo -u postgres psql -c "CREATE USER kinetra WITH PASSWORD 'STRONG_DB_PASSWORD';"
  sudo -u postgres psql -c "CREATE DATABASE kinetra OWNER kinetra;"
  pip install "psycopg[binary]"
  ```
  Then use `DATABASE_URL=postgresql+psycopg://kinetra:STRONG_DB_PASSWORD@localhost:5432/kinetra`.

## 5. Create the production settings
Create `/opt/kinetra/backend/.env` and lock it down:
```bash
nano /opt/kinetra/backend/.env
chmod 600 /opt/kinetra/backend/.env
```
```ini
DATABASE_URL=postgresql+psycopg://kinetra:STRONG_DB_PASSWORD@localhost:5432/kinetra

ADMIN_USERNAME=admin
ADMIN_PASSWORD=<long random password, 16+ chars>
SECRET_KEY=<output of: python3 -c "import secrets; print(secrets.token_urlsafe(48))">
ACCESS_TOKEN_MINUTES=60

INQUIRY_NOTIFY_EMAIL=you@yourcompany.com
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM=no-reply@yourdomain.com

GEMINI_API_KEY=<your key>
GEMINI_MODEL=gemini-2.5-flash

SEED_SAMPLE_DATA=false
ENABLE_API_DOCS=false
```
`SEED_SAMPLE_DATA=false` means no demo data is created. Your real branches go in through the admin panel.

## 6. First start test
```bash
cd /opt/kinetra/backend && source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000
```
In another terminal run `curl http://127.0.0.1:8000/api/health`. You should see `{"status":"ok"}`. Press `Ctrl+C` to stop. This run created the tables and the admin account from your `.env` password.

## 7. Run it as a service (starts on boot, restarts on crash)
```bash
sudo nano /etc/systemd/system/kinetra.service
```
```ini
[Unit]
Description=Kinetra website
After=network.target postgresql.service

[Service]
User=youruser
WorkingDirectory=/opt/kinetra/backend
ExecStart=/opt/kinetra/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --proxy-headers --forwarded-allow-ips=127.0.0.1
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now kinetra
sudo systemctl status kinetra
```
Notes:
- **No `--reload` and no `--workers`.** Rate limits and the login lockout are kept in memory per process, so use one process. For more capacity, also add rate limits at the proxy.
- `--proxy-headers` is required so rate limits see each visitor's real IP instead of the proxy's.

## 8. Put HTTPS in front with Caddy
```bash
sudo apt install -y caddy
sudo nano /etc/caddy/Caddyfile
```
```
kinetra.example.com {
    encode gzip
    reverse_proxy 127.0.0.1:8000
}
```
```bash
sudo systemctl reload caddy
```
Caddy obtains and renews the HTTPS certificate automatically. Open `https://kinetra.example.com/` for the site and `https://kinetra.example.com/admin/` for the admin panel.

**Optional hardening for the admin panel:** if only office staff need it, restrict `/admin/*`, `/api/admin/*` and `/api/auth/*` to your office IPs in the Caddyfile (`@admin path /admin/* /api/admin/* /api/auth/*` with `@notoffice not remote_ip <your.ip>` and `respond @notoffice 403`).

## 9. Backups
- **PostgreSQL:** a nightly dump, copied off the server:
  ```bash
  sudo crontab -e
  0 2 * * * sudo -u postgres pg_dump kinetra | gzip > /var/backups/kinetra-$(date +\%F).sql.gz
  ```
- **SQLite:** copy `backend/fitness.db` nightly (`sqlite3 fitness.db ".backup /var/backups/fitness.db"`).
- Test a restore at least once.

## 10. Go-live checklist
- [ ] `https://` works and `http://` redirects to it.
- [ ] Admin login works with your own password; the wrong password is rejected.
- [ ] Add your real branches in **Add branch**; the Locations section on the site updates.
- [ ] Submit a test contact message and a test membership application. Confirm both appear in the admin and the notification email arrives.
- [ ] Open the chatbot and ask a plan question and an off-topic question.
- [ ] Check the site on a phone, in light and dark mode.
- [ ] `/api/docs` returns 404 (docs disabled).
- [ ] Set a **budget/quota alert** on the Gemini key, since chat messages cost money.
- [ ] If you ever want to be sure no demo data exists: `cd backend && source .venv/bin/activate && python -m app.cli clear-sample`.

## 11. Updating the site later
```bash
cd /opt/kinetra && git pull
cd backend && source .venv/bin/activate && pip install -r requirements.txt
sudo systemctl restart kinetra
```
Edits to the knowledge-base file apply without a restart; everything else needs one. Tables are created automatically, but changes to the database structure later need migrations (Alembic), so plan for that before changing models on a live database.

## 12. Troubleshooting
- **Service won't start:** `sudo journalctl -u kinetra -n 50 --no-pager`
- **502 from Caddy:** the app isn't running; check `systemctl status kinetra`.
- **Chat says offline:** check `GEMINI_API_KEY` in `.env`, then restart the service and read the journal for the error.
- **Locked out of admin:** wait 15 minutes, or run `python -m app.cli set-admin-password` and restart.

## Managed hosts (Render, Railway, Fly.io, etc.)
These work too, with three differences:
- **Root directory** `backend`, build command `pip install -r requirements.txt "psycopg[binary]"`, start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips="*"`.
- Their disks are usually **temporary**, so use their managed PostgreSQL via `DATABASE_URL`. Don't use SQLite there.
- Put the settings from step 5 in the host's environment variables instead of a `.env` file. The host provides HTTPS and the domain setup.
