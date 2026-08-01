from __future__ import annotations

import csv
import io
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

LOGO_PATH = Path(__file__).resolve().parent.parent / "assets" / "kaaraalan-logo.png"
BRAND = colors.HexColor("#0f5c4c")
BRAND_LIGHT = colors.HexColor("#e8f3ef")
MUTED = colors.HexColor("#64748b")
LINE = colors.HexColor("#cbd5e1")
INK = colors.HexColor("#0f172a")


def _money(value) -> str:
    try:
        return f"Rs {Decimal(value or 0):,.2f}"
    except Exception:
        return f"Rs {value}"


def _dt(value) -> str:
    if not value:
        return "—"
    if isinstance(value, datetime):
        return value.astimezone().strftime("%d-%m-%Y %I:%M %p")
    return str(value)


def _date_only(value) -> str:
    if not value:
        return "—"
    if isinstance(value, datetime):
        return value.astimezone().strftime("%d-%m-%Y")
    return str(value)


def _time_only(value) -> str:
    if not value:
        return "—"
    if isinstance(value, datetime):
        return value.astimezone().strftime("%I:%M %p")
    return str(value)


def _signed(value: int) -> str:
    n = int(value or 0)
    if n > 0:
        return f"+{n}"
    return str(n)


def _logo_flowable():
    if not LOGO_PATH.exists():
        return None
    with PILImage.open(LOGO_PATH) as im:
        px_w, px_h = im.size
    if px_w <= 0 or px_h <= 0:
        return None
    max_w = 42 * mm
    max_h = 28 * mm
    ratio = px_w / px_h
    width = max_w
    height = width / ratio
    if height > max_h:
        height = max_h
        width = height * ratio
    logo = Image(str(LOGO_PATH), width=width, height=height)
    logo.hAlign = "CENTER"
    return logo


def build_csv_report(data: dict) -> bytes:
    buf = io.StringIO()
    writer = csv.writer(buf)
    meta = data["meta"]
    summary = data["summary"]

    writer.writerow([meta["company"]])
    writer.writerow([meta["title"]])
    writer.writerow(["Selected Report Period", meta["period_label"]])
    writer.writerow([])

    writer.writerow(["1. Dashboard Summary"])
    writer.writerow(["Pending Orders", summary["pending_orders"]])
    writer.writerow(["Total Orders", summary["total_orders"]])
    writer.writerow(["Revenue", _money(summary["revenue"])])
    writer.writerow(["Low Stock Alerts", summary["low_stock_alerts"]])
    writer.writerow([])

    writer.writerow(["2. Order Summary"])
    writer.writerow(["Order ID", "Dealer", "Date & Time", "Due Date", "Quantity", "Amount", "Status"])
    for row in data["orders"]:
        writer.writerow(
            [
                row["order_number"],
                row["dealer_name"],
                _dt(row["created_at"]),
                str(row["due_date"] or ""),
                row["total_quantity"],
                _money(row["total_amount"]),
                str(row["status"]).upper(),
            ]
        )
    writer.writerow([])

    writer.writerow(["3. Current Stock"])
    writer.writerow(["Flavour", "Glass", "PET (300 ml)", "PET (220 ml)", "Total"])
    for row in data["stock_rows"]:
        glass = int(row.get("glass") or 0)
        p300 = int(row.get("pet_300") or 0)
        p220 = int(row.get("pet_220") or 0)
        writer.writerow([str(row.get("flavour") or "").upper(), glass, p300, p220, glass + p300 + p220])
    totals = data["stock_totals"]
    tg = int(totals.get("glass") or 0)
    tp300 = int(totals.get("pet_300") or 0)
    tp220 = int(totals.get("pet_220") or 0)
    writer.writerow(["TOTAL", tg, tp300, tp220, tg + tp300 + tp220])
    writer.writerow([])

    writer.writerow(["4. Batch Production Summary"])
    writer.writerow(
        [
            "Flavour",
            "Total Crates Produced",
            "Total Batches Produced",
            "Total Syrup Used (kg)",
            "Production Date",
            "Production Time",
        ]
    )
    for row in data.get("batch_production") or []:
        writer.writerow(
            [
                row["flavour"],
                row["total_crates"],
                f"{row['total_batches']:.2f}",
                f"{row['total_syrup_kg']:.2f}",
                _date_only(row["produced_at"]),
                _time_only(row["produced_at"]),
            ]
        )
    writer.writerow([])

    writer.writerow(["5. Stock Update History"])
    writer.writerow(
        [
            "Date",
            "Time",
            "Flavour",
            "Crate Type",
            "Updated By",
            "Reason",
            "Previous Stock",
            "Change (+/-)",
            "New Stock",
        ]
    )
    for row in data.get("stock_history") or []:
        writer.writerow(
            [
                _date_only(row["created_at"]),
                _time_only(row["created_at"]),
                row["flavour"],
                row["bottle_type"],
                row["updated_by"],
                row["reason"],
                row["previous"],
                _signed(row["change"]),
                row["new"],
            ]
        )
    writer.writerow([])

    writer.writerow(["Generated From", "Kaaraalan Admin Portal"])
    writer.writerow(["Generated By", meta["generated_by"]])
    writer.writerow(["Generated On", _dt(meta["generated_at"])])

    return ("\ufeff" + buf.getvalue()).encode("utf-8")


def build_pdf_report(data: dict) -> bytes:
    meta = data["meta"]
    summary = data["summary"]
    buffer = io.BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=16 * mm,
        bottomMargin=18 * mm,
        title=meta["title"],
        author=meta["generated_by"],
    )

    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="Company",
            parent=styles["Heading1"],
            fontSize=16,
            textColor=BRAND,
            alignment=TA_CENTER,
            spaceAfter=2,
            spaceBefore=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="ReportTitle",
            parent=styles["Heading2"],
            fontSize=12,
            textColor=INK,
            alignment=TA_CENTER,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Section",
            parent=styles["Heading3"],
            fontSize=11,
            textColor=BRAND,
            spaceBefore=12,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Meta",
            parent=styles["Normal"],
            fontSize=9,
            textColor=MUTED,
            alignment=TA_CENTER,
            leading=13,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="HistTitle",
            parent=styles["Normal"],
            fontSize=9,
            textColor=INK,
            fontName="Helvetica-Bold",
            spaceBefore=2,
            spaceAfter=2,
        )
    )
    styles.add(
        ParagraphStyle(
            name="HistBody",
            parent=styles["Normal"],
            fontSize=8,
            textColor=INK,
            leading=11,
            alignment=TA_LEFT,
        )
    )
    styles.add(
        ParagraphStyle(
            name="FooterBlock",
            parent=styles["Normal"],
            fontSize=9,
            textColor=MUTED,
            alignment=TA_CENTER,
            leading=13,
        )
    )

    story = []

    logo = _logo_flowable()
    if logo:
        story.append(logo)
        story.append(Spacer(1, 6))

    story.append(Paragraph(meta["company"], styles["Company"]))
    story.append(Paragraph(meta["title"], styles["ReportTitle"]))
    story.append(
        Paragraph(
            f"Selected Report Period: <b>{meta['period_label']}</b>",
            styles["Meta"],
        )
    )

    # 1. Dashboard Summary
    story.append(Paragraph("1. Dashboard Summary", styles["Section"]))
    story.append(
        _kv_table(
            [
                ["Pending Orders", str(summary["pending_orders"])],
                ["Total Orders", str(summary["total_orders"])],
                ["Revenue", _money(summary["revenue"])],
                ["Low Stock Alerts", str(summary["low_stock_alerts"])],
            ]
        )
    )

    # 2. Order Summary
    story.append(Paragraph("2. Order Summary", styles["Section"]))
    order_rows = [["Order ID", "Dealer", "Date & Time", "Due Date", "Qty", "Amount", "Status"]]
    for row in data["orders"]:
        order_rows.append(
            [
                Paragraph(str(row["order_number"]), styles["HistBody"]),
                Paragraph(str(row["dealer_name"]), styles["HistBody"]),
                Paragraph(_dt(row["created_at"]), styles["HistBody"]),
                Paragraph(str(row["due_date"] or ""), styles["HistBody"]),
                str(row["total_quantity"]),
                _money(row["total_amount"]),
                str(row["status"]).upper(),
            ]
        )
    if len(order_rows) == 1:
        order_rows.append(["—", "No orders in this period", "—", "—", "—", "—", "—"])
    story.append(
        _data_table(
            order_rows,
            col_widths=[26 * mm, 28 * mm, 32 * mm, 22 * mm, 12 * mm, 26 * mm, 20 * mm],
        )
    )

    # 3. Current Stock
    story.append(Paragraph("3. Current Stock", styles["Section"]))
    stock_rows = [["Flavour", "Glass", "PET (300 ml)", "PET (220 ml)", "Total"]]
    for row in data["stock_rows"]:
        glass = int(row.get("glass") or 0)
        p300 = int(row.get("pet_300") or 0)
        p220 = int(row.get("pet_220") or 0)
        stock_rows.append(
            [str(row.get("flavour") or "").upper(), str(glass), str(p300), str(p220), str(glass + p300 + p220)]
        )
    totals = data["stock_totals"]
    tg = int(totals.get("glass") or 0)
    tp300 = int(totals.get("pet_300") or 0)
    tp220 = int(totals.get("pet_220") or 0)
    stock_rows.append(["TOTAL", str(tg), str(tp300), str(tp220), str(tg + tp300 + tp220)])
    story.append(
        _data_table(stock_rows, col_widths=[40 * mm, 30 * mm, 35 * mm, 35 * mm, 30 * mm], bold_last=True)
    )

    # 4. Batch Production Summary
    story.append(Paragraph("4. Batch Production Summary", styles["Section"]))
    batch_rows = [
        [
            "Flavour",
            "Total Crates",
            "Total Batches",
            "Syrup Used (kg)",
            "Production Date",
            "Production Time",
        ]
    ]
    for row in data.get("batch_production") or []:
        batch_rows.append(
            [
                row["flavour"],
                str(row["total_crates"]),
                f"{row['total_batches']:.2f}",
                f"{row['total_syrup_kg']:.2f}",
                _date_only(row["produced_at"]),
                _time_only(row["produced_at"]),
            ]
        )
    if len(batch_rows) == 1:
        batch_rows.append(["—", "No production in this period", "—", "—", "—", "—"])
    story.append(
        _data_table(
            batch_rows,
            col_widths=[28 * mm, 26 * mm, 28 * mm, 30 * mm, 30 * mm, 28 * mm],
        )
    )

    # 5. Stock Update History (card-style blocks)
    story.append(Paragraph("5. Stock Update History", styles["Section"]))
    history = data.get("stock_history") or []
    if not history:
        story.append(Paragraph("No stock updates in this period.", styles["HistBody"]))
    else:
        for row in history:
            change = int(row["change"])
            change_color = "#0f5c4c" if change > 0 else ("#dc2626" if change < 0 else "#64748b")
            block = [
                Paragraph(f"{_date_only(row['created_at'])} &nbsp;&nbsp; {_time_only(row['created_at'])}", styles["HistTitle"]),
                Paragraph(f"<b>{row['flavour']}</b>", styles["HistBody"]),
                Paragraph(str(row["bottle_type"]), styles["HistBody"]),
                Paragraph(f"Updated By: <b>{row['updated_by']}</b>", styles["HistBody"]),
                Paragraph(f"Reason: {row['reason']}", styles["HistBody"]),
                Paragraph(
                    f"Previous: <b>{row['previous']}</b> &nbsp;&nbsp; "
                    f"Change: <font color='{change_color}'><b>{_signed(change)}</b></font> &nbsp;&nbsp; "
                    f"New: <b>{row['new']}</b>",
                    styles["HistBody"],
                ),
            ]
            card = Table([[block]], colWidths=[170 * mm])
            card.setStyle(
                TableStyle(
                    [
                        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
                        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                        ("LEFTPADDING", (0, 0), (-1, -1), 8),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                        ("TOPPADDING", (0, 0), (-1, -1), 6),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ]
                )
            )
            story.append(KeepTogether([card, Spacer(1, 5)]))

    # Footer
    story.append(Spacer(1, 14))
    story.append(
        Paragraph(
            f"Generated From: <b>Kaaraalan Admin Portal</b><br/>"
            f"Generated By: <b>{meta['generated_by']}</b><br/>"
            f"Generated On: <b>{_dt(meta['generated_at'])}</b>",
            styles["FooterBlock"],
        )
    )

    def _on_page(canvas, doc_):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(MUTED)
        canvas.drawString(14 * mm, 10 * mm, meta["company"])
        canvas.drawRightString(A4[0] - 14 * mm, 10 * mm, f"Page {doc_.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=_on_page, onLaterPages=_on_page)
    return buffer.getvalue()


def build_orders_pdf(data: dict) -> bytes:
    """PDF for the Admin Orders page (filtered table export)."""
    meta = data["meta"]
    filters = data["filters"]
    orders = data["orders"]
    buffer = io.BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=16 * mm,
        bottomMargin=18 * mm,
        title=meta["title"],
        author=meta["generated_by"],
    )

    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="OrdersCompany",
            parent=styles["Heading1"],
            fontSize=16,
            textColor=BRAND,
            alignment=TA_CENTER,
            spaceAfter=2,
            spaceBefore=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="OrdersReportTitle",
            parent=styles["Heading2"],
            fontSize=12,
            textColor=INK,
            alignment=TA_CENTER,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="OrdersSection",
            parent=styles["Heading3"],
            fontSize=11,
            textColor=BRAND,
            spaceBefore=12,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="OrdersMeta",
            parent=styles["Normal"],
            fontSize=9,
            textColor=MUTED,
            alignment=TA_CENTER,
            leading=13,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="OrdersHistBody",
            parent=styles["Normal"],
            fontSize=8,
            textColor=INK,
            leading=11,
            alignment=TA_LEFT,
        )
    )
    styles.add(
        ParagraphStyle(
            name="OrdersFooterBlock",
            parent=styles["Normal"],
            fontSize=9,
            textColor=MUTED,
            alignment=TA_CENTER,
            leading=13,
        )
    )

    story = []

    logo = _logo_flowable()
    if logo:
        story.append(logo)
        story.append(Spacer(1, 6))

    story.append(Paragraph(meta["company"], styles["OrdersCompany"]))
    story.append(Paragraph(meta["title"], styles["OrdersReportTitle"]))
    story.append(
        Paragraph(
            f"Export date &amp; time: <b>{_dt(meta['generated_at'])}</b>",
            styles["OrdersMeta"],
        )
    )

    story.append(Paragraph("Applied Filters", styles["OrdersSection"]))
    story.append(
        _kv_table(
            [
                ["Report Period", filters["period_label"]],
                ["Status", filters["status_label"]],
                ["Dealer", filters["dealer_label"]],
            ]
        )
    )

    story.append(Paragraph("Orders", styles["OrdersSection"]))
    order_rows = [["Order #", "Dealer", "Date & Time", "Due", "Qty", "Amount", "Status"]]
    for row in orders:
        order_rows.append(
            [
                Paragraph(str(row["order_number"]), styles["OrdersHistBody"]),
                Paragraph(str(row["dealer_name"] or "—"), styles["OrdersHistBody"]),
                Paragraph(_dt(row["created_at"]), styles["OrdersHistBody"]),
                Paragraph(str(row["due_date"] or "—"), styles["OrdersHistBody"]),
                str(row["total_quantity"]),
                _money(row["total_amount"]),
                str(row["status"] or "").upper(),
            ]
        )
    if len(order_rows) == 1:
        order_rows.append(["—", "No orders for these filters", "—", "—", "—", "—", "—"])
    story.append(
        _data_table(
            order_rows,
            col_widths=[26 * mm, 28 * mm, 32 * mm, 22 * mm, 12 * mm, 26 * mm, 20 * mm],
        )
    )

    story.append(Paragraph("Totals", styles["OrdersSection"]))
    story.append(
        _kv_table(
            [
                ["Total Orders", str(data["total_orders"])],
                ["Total Amount", _money(data["total_amount"])],
            ]
        )
    )

    story.append(Spacer(1, 14))
    story.append(
        Paragraph(
            f"Generated From: <b>Kaaraalan Admin Portal</b><br/>"
            f"Generated By: <b>{meta['generated_by']}</b><br/>"
            f"Generated On: <b>{_dt(meta['generated_at'])}</b>",
            styles["OrdersFooterBlock"],
        )
    )

    def _on_page(canvas, doc_):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(MUTED)
        canvas.drawString(14 * mm, 10 * mm, meta["company"])
        canvas.drawRightString(A4[0] - 14 * mm, 10 * mm, f"Page {doc_.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=_on_page, onLaterPages=_on_page)
    return buffer.getvalue()


def _kv_table(rows):
    table = Table(rows, colWidths=[90 * mm, 80 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), BRAND_LIGHT),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.4, LINE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
            ]
        )
    )
    return table


def _data_table(rows, col_widths=None, bold_last: bool = False):
    table = Table(rows, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), BRAND),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, BRAND_LIGHT]),
    ]
    if bold_last and len(rows) > 1:
        style_cmds.append(("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"))
        style_cmds.append(("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#dbece6")))
    table.setStyle(TableStyle(style_cmds))
    return table
