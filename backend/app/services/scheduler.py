from __future__ import annotations

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.config import settings
from app.db.session import SessionLocal
from app.services.business import (
    current_week_key,
    send_department_task_due_reminders,
    send_risk_overdue_reminders,
    send_weekly_update_reminders,
)


scheduler = AsyncIOScheduler(timezone=settings.scheduler_timezone)


async def run_weekly_update_digest() -> None:
    with SessionLocal() as db:
        await send_weekly_update_reminders(db, current_week_key())


async def run_department_task_due_scan() -> None:
    with SessionLocal() as db:
        await send_department_task_due_reminders(db)


async def run_risk_overdue_scan() -> None:
    with SessionLocal() as db:
        await send_risk_overdue_reminders(db)


def start_scheduler() -> None:
    if not settings.scheduler_enabled or scheduler.running:
        return
    scheduler.add_job(
        run_weekly_update_digest,
        CronTrigger(day_of_week="fri", hour=17, minute=0, timezone=settings.scheduler_timezone),
        id="weekly_update_digest",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
    scheduler.add_job(
        run_department_task_due_scan,
        CronTrigger(hour=9, minute=0, timezone=settings.scheduler_timezone),
        id="department_task_due_scan",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
    scheduler.add_job(
        run_risk_overdue_scan,
        CronTrigger(hour=9, minute=0, timezone=settings.scheduler_timezone),
        id="risk_overdue_scan",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
    scheduler.start()


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)


def scheduler_status() -> dict:
    jobs = []
    if scheduler.running:
        for job in scheduler.get_jobs():
            jobs.append(
                {
                    "id": job.id,
                    "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
                }
            )
    return {
        "enabled": settings.scheduler_enabled,
        "running": scheduler.running,
        "timezone": settings.scheduler_timezone,
        "delivery_mode": settings.notification_delivery_mode,
        "allowlist_emails": sorted(settings.notification_allowlist_emails),
        "jobs": jobs,
    }
