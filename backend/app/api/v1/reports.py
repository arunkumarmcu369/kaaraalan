from datetime import date
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin
from app.crud import reports as crud
from app.db.session import get_db
from app.models.user import User
from app.services.report_export import build_csv_report, build_pdf_report

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/daily")
async def daily_report(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_admin)],
    format: str = Query("pdf", pattern="^(pdf|csv)$"),
    range: str = Query("today", pattern="^(today|yesterday|7d|30d|custom)$"),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
):
    if range == "custom" and (not date_from or not date_to):
        raise HTTPException(status_code=400, detail="Custom range requires date_from and date_to")

    try:
        data = await crud.build_daily_report(
            db,
            admin=admin,
            range_key=range,
            date_from=date_from,
            date_to=date_to,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    stamp = data["meta"]["generated_at"].strftime("%Y%m%d_%H%M%S")
    if format == "csv":
        content = build_csv_report(data)
        return Response(
            content=content,
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="kaaraalan_daily_report_{stamp}.csv"'
            },
        )

    content = build_pdf_report(data)
    return Response(
        content=content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="kaaraalan_daily_report_{stamp}.pdf"'
        },
    )
