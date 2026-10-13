import logging
import smtplib
from email.message import EmailMessage

from .config import settings

log = logging.getLogger("kinetra.mailer")


def _one_line(s: str) -> str:
    return " ".join(s.split())


def _send(subject: str, body: str, reply_to: str) -> None:
    if not (settings.inquiry_notify_email and settings.smtp_host):
        log.info("Email skipped (INQUIRY_NOTIFY_EMAIL / SMTP_HOST not configured)")
        return
    msg = EmailMessage()
    msg["Subject"] = _one_line(subject)[:200]
    msg["From"] = settings.smtp_from or settings.smtp_user or settings.inquiry_notify_email
    msg["To"] = settings.inquiry_notify_email
    msg["Reply-To"] = reply_to
    msg.set_content(body)
    try:
        factory = smtplib.SMTP_SSL if settings.smtp_use_ssl else smtplib.SMTP
        with factory(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
            if settings.smtp_use_tls and not settings.smtp_use_ssl:
                smtp.starttls()
            if settings.smtp_user:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(msg)
    except Exception:
        log.exception("Failed to send notification email")


def send_inquiry_email(inquiry: dict) -> None:
    """Contact-form message -> INQUIRY_NOTIFY_EMAIL. Runs as a background task;
    failures are logged and never affect the visitor's response."""
    _send(
        f"New Kinetra inquiry from {inquiry['name']}",
        "A new inquiry was submitted on the website.\n\n"
        f"Name:  {inquiry['name']}\nEmail: {inquiry['email']}\nPhone: {inquiry['phone']}\n"
        f"City:  {inquiry['city']}\n\nMessage:\n{inquiry['message']}\n",
        inquiry["email"],
    )


def send_membership_email(app: dict) -> None:
    _send(
        f"New membership application: {app['plan_name']} ({app['name']})",
        "A new membership application was submitted on the website.\n\n"
        f"Name:       {app['name']}\nEmail:      {app['email']}\nPhone:      {app['phone']}\n"
        f"City:       {app['city']}\nPlan:       {app['plan_name']}\n"
        f"Branch:     {app['branch_name'] or 'Any branch'}\nStart date: {app['start_date']}\n"
        f"Goal:       {app['goal_label']}\n\nNotes:\n{app['notes'] or '-'}\n",
        app["email"],
    )
