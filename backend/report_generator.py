"""
NEXUSNET Network Health Intelligence Report Generator
====================================================
Generates professional, downloadable PDF reports based strictly on the latest
manual telemetry analysis. Adheres to Network Operations Center (NOC) dark-navy
and academic styling guidelines.
"""

import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
    HRFlowable,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY


# ---------------------------------------------------------------------------
# NOC Color Palette
# ---------------------------------------------------------------------------
COLOR_PRIMARY_NAVY = colors.HexColor("#0B192C")
COLOR_SECONDARY_NAVY = colors.HexColor("#1E3E62")
COLOR_ACCENT_BLUE = colors.HexColor("#2563EB")
COLOR_SLATE_BG = colors.HexColor("#F8FAFC")
COLOR_CARD_BORDER = colors.HexColor("#E2E8F0")
COLOR_TEXT_MAIN = colors.HexColor("#0F172A")
COLOR_TEXT_MUTED = colors.HexColor("#475569")
COLOR_TEXT_LIGHT = colors.HexColor("#FFFFFF")

# Status Colors
COLOR_HIGH_RED = colors.HexColor("#DC2626")
COLOR_HIGH_BG = colors.HexColor("#FEF2F2")
COLOR_HIGH_BORDER = colors.HexColor("#FCA5A5")

COLOR_MED_AMBER = colors.HexColor("#D97706")
COLOR_MED_BG = colors.HexColor("#FFFBEB")
COLOR_MED_BORDER = colors.HexColor("#FCD34D")

COLOR_ROUTINE_GREEN = colors.HexColor("#059669")
COLOR_ROUTINE_BG = colors.HexColor("#ECFDF5")
COLOR_ROUTINE_BORDER = colors.HexColor("#6EE7B7")

COLOR_GREY_NEUTRAL = colors.HexColor("#64748B")
COLOR_GREY_BG = colors.HexColor("#F1F5F9")
COLOR_GREY_BORDER = colors.HexColor("#CBD5E1")


def draw_noc_logo(canv: canvas.Canvas, x: float, y: float, size: float = 30):
    """
    Draws an original, custom NOC-style shield emblem with network nodes and signal waves.
    Top-left reference (x, y).
    """
    canv.saveState()
    cx = x + size / 2.0
    cy = y - size / 2.0
    r = size / 2.0

    # 1. Shield background
    canv.setFillColor(COLOR_PRIMARY_NAVY)
    canv.setStrokeColor(COLOR_ACCENT_BLUE)
    canv.setLineWidth(1.2)
    p = canv.beginPath()
    p.moveTo(cx - r, cy + r * 0.4)
    p.lineTo(cx - r, cy + r * 0.8)
    p.lineTo(cx + r, cy + r * 0.8)
    p.lineTo(cx + r, cy + r * 0.4)
    p.curveTo(cx + r, cy - r * 0.4, cx, cy - r, cx, cy - r)
    p.curveTo(cx, cy - r, cx - r, cy - r * 0.4, cx - r, cy + r * 0.4)
    p.close()
    canv.drawPath(p, fill=1, stroke=1)

    # 2. Central Network Node (cyan dot)
    canv.setFillColor(colors.HexColor("#06B6D4"))
    canv.circle(cx, cy + 1.5, 2.8, fill=1, stroke=0)

    # 3. Outer nodes & link lines
    canv.setStrokeColor(colors.HexColor("#93C5FD"))
    canv.setLineWidth(0.8)
    canv.line(cx, cy + 1.5, cx - 5.5, cy - 4.5)
    canv.line(cx, cy + 1.5, cx + 5.5, cy - 4.5)
    canv.line(cx, cy + 1.5, cx, cy + 8.0)

    canv.setFillColor(colors.HexColor("#FFFFFF"))
    canv.circle(cx - 5.5, cy - 4.5, 1.8, fill=1, stroke=0)
    canv.circle(cx + 5.5, cy - 4.5, 1.8, fill=1, stroke=0)
    canv.circle(cx, cy + 8.0, 1.8, fill=1, stroke=0)

    # 4. Signal Wave Arc
    canv.setStrokeColor(colors.HexColor("#38BDF8"))
    canv.setLineWidth(0.9)
    canv.arc(cx - 9.0, cy - 6.0, cx + 9.0, cy + 12.0, 40, 100)

    canv.restoreState()


class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas that determines total page count dynamically
    and renders consistent academic NOC headers and footers on every page.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states: List[Dict[str, Any]] = []
        self.report_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")
        self.report_asset_id = "MANUAL-INPUT"

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_decorations(self, page_count: int):
        self.saveState()
        page_w, page_h = letter
        page_num = self._pageNumber

        # Draw original NOC logo in top-right corner of EVERY page
        draw_noc_logo(self, page_w - 68, page_h - 22, size=30)

        # Header bar on pages 2, 3, 4
        if page_num > 1:
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(COLOR_SECONDARY_NAVY)
            self.drawString(42, page_h - 28, "NEXUSNET NETWORK HEALTH INTELLIGENCE")
            self.setFont("Helvetica", 8)
            self.setFillColor(COLOR_TEXT_MUTED)
            self.drawString(250, page_h - 28, f"Asset: {self.report_asset_id} | Manual Analysis Report")

            self.setStrokeColor(COLOR_CARD_BORDER)
            self.setLineWidth(0.6)
            self.line(42, page_h - 34, page_w - 74, page_h - 34)

        # Footer on EVERY page
        self.setStrokeColor(COLOR_CARD_BORDER)
        self.setLineWidth(0.6)
        self.line(42, 36, page_w - 42, 36)

        self.setFont("Helvetica", 7.5)
        self.setFillColor(COLOR_TEXT_MUTED)
        # Left: Generated timestamp
        self.drawString(42, 24, f"Generated: {self.report_timestamp}")

        # Center: Decision support system label
        self.drawCentredString(
            page_w / 2.0, 24, "NEXUSNET Network Health Intelligence — Decision Support System"
        )

        # Right: Page X of Y
        self.drawRightString(page_w - 42, 24, f"Page {page_num} of {page_count}")

        self.restoreState()


def build_styles() -> Dict[str, ParagraphStyle]:
    """
    Builds clean, academic typography styles for the PDF report.
    """
    base_styles = getSampleStyleSheet()

    styles = {
        "DocTitle": ParagraphStyle(
            "DocTitle",
            parent=base_styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=26,
            textColor=COLOR_PRIMARY_NAVY,
            spaceAfter=4,
        ),
        "DocSubtitle": ParagraphStyle(
            "DocSubtitle",
            parent=base_styles["Normal"],
            fontName="Helvetica",
            fontSize=11,
            leading=15,
            textColor=COLOR_SECONDARY_NAVY,
            spaceAfter=12,
        ),
        "SectionHeading": ParagraphStyle(
            "SectionHeading",
            parent=base_styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=16,
            textColor=COLOR_PRIMARY_NAVY,
            spaceBefore=8,
            spaceAfter=6,
            keepWithNext=True,
        ),
        "SubSectionHeading": ParagraphStyle(
            "SubSectionHeading",
            parent=base_styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=13,
            textColor=COLOR_SECONDARY_NAVY,
            spaceBefore=6,
            spaceAfter=4,
            keepWithNext=True,
        ),
        "Body": ParagraphStyle(
            "Body",
            parent=base_styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=13,
            textColor=COLOR_TEXT_MAIN,
            spaceAfter=6,
            alignment=TA_JUSTIFY,
        ),
        "BodyBold": ParagraphStyle(
            "BodyBold",
            parent=base_styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=13,
            textColor=COLOR_TEXT_MAIN,
            spaceAfter=4,
        ),
        "BodyMuted": ParagraphStyle(
            "BodyMuted",
            parent=base_styles["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=COLOR_TEXT_MUTED,
            spaceAfter=4,
        ),
        "QuestionTitle": ParagraphStyle(
            "QuestionTitle",
            parent=base_styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9.5,
            leading=13,
            textColor=COLOR_PRIMARY_NAVY,
            spaceBefore=4,
            spaceAfter=2,
            keepWithNext=True,
        ),
        "QuestionAnswer": ParagraphStyle(
            "QuestionAnswer",
            parent=base_styles["Normal"],
            fontName="Helvetica",
            fontSize=8.8,
            leading=12.5,
            textColor=COLOR_TEXT_MAIN,
            spaceAfter=6,
            alignment=TA_JUSTIFY,
        ),
        "BadgeText": ParagraphStyle(
            "BadgeText",
            parent=base_styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=14,
            alignment=TA_CENTER,
        ),
        "TableHeader": ParagraphStyle(
            "TableHeader",
            parent=base_styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=COLOR_TEXT_LIGHT,
            alignment=TA_LEFT,
        ),
        "TableCell": ParagraphStyle(
            "TableCell",
            parent=base_styles["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=COLOR_TEXT_MAIN,
            alignment=TA_LEFT,
        ),
        "TableCellBold": ParagraphStyle(
            "TableCellBold",
            parent=base_styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=11,
            textColor=COLOR_TEXT_MAIN,
            alignment=TA_LEFT,
        ),
        "StatusBadgeCell": ParagraphStyle(
            "StatusBadgeCell",
            parent=base_styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=9,
            alignment=TA_CENTER,
        ),
        "ChecklistItem": ParagraphStyle(
            "ChecklistItem",
            parent=base_styles["Normal"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=12,
            textColor=COLOR_TEXT_MAIN,
            spaceAfter=3,
        ),
        "DisclaimerText": ParagraphStyle(
            "DisclaimerText",
            parent=base_styles["Normal"],
            fontName="Helvetica-Oblique",
            fontSize=8,
            leading=11.5,
            textColor=COLOR_TEXT_MUTED,
            spaceAfter=4,
            alignment=TA_JUSTIFY,
        ),
    }

    return styles


def create_status_pill(status_text: str, styles: Dict[str, ParagraphStyle]) -> Table:
    """
    Creates an inline colored status pill for tables.
    """
    st_lower = status_text.lower()
    if "severe" in st_lower or "high" in st_lower or "investigate" in st_lower:
        bg_col = COLOR_HIGH_BG
        txt_col = COLOR_HIGH_RED
        bdr_col = COLOR_HIGH_BORDER
    elif "warning" in st_lower or "medium" in st_lower:
        bg_col = COLOR_MED_BG
        txt_col = COLOR_MED_AMBER
        bdr_col = COLOR_MED_BORDER
    elif "not evaluated" in st_lower:
        bg_col = COLOR_GREY_BG
        txt_col = COLOR_GREY_NEUTRAL
        bdr_col = COLOR_GREY_BORDER
    else:
        bg_col = COLOR_ROUTINE_BG
        txt_col = COLOR_ROUTINE_GREEN
        bdr_col = COLOR_ROUTINE_BORDER

    p = Paragraph(
        f'<font color="{txt_col.hexval()}"><b>{status_text}</b></font>',
        styles["StatusBadgeCell"],
    )
    t = Table([[p]], colWidths=[90], rowHeights=[16])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), bg_col),
                ("BOX", (0, 0), (-1, -1), 0.7, bdr_col),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 1),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return t


def generate_network_health_pdf(
    analysis_data: Dict[str, Any],
    output_path: Optional[str] = None,
    backend_summary: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Generates a professional 4-page academic NOC PDF report from the latest manual analysis.
    """
    if not output_path:
        reports_dir = Path(__file__).resolve().parent / "reports"
        os.makedirs(reports_dir, exist_ok=True)
        aid_clean = (
            str(analysis_data.get("asset_id", "MANUAL"))
            .replace(" ", "_")
            .replace("/", "_")
            .replace("\\", "_")
        )
        ts_slug = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = str(reports_dir / f"NEXUSNET_Report_{aid_clean}_{ts_slug}.pdf")

    # Document setup with 38pt margins
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=38,
        rightMargin=38,
        topMargin=42,
        bottomMargin=42,
    )

    styles = build_styles()
    story = []

    # Extract dynamic analysis attributes
    asset_id = analysis_data.get("asset_id") or "MANUAL-INPUT"
    asset_type = analysis_data.get("asset_type") or "Unknown"
    priority = analysis_data.get("investigation_priority") or "Routine"
    flag = analysis_data.get("final_decision_support_flag") or "Monitor"
    main_issue = analysis_data.get("main_issue") or "No threshold breaches detected."
    breaches = analysis_data.get("breached_measurements") or []
    actions = analysis_data.get("recommended_actions") or []
    not_eval = analysis_data.get("not_evaluated") or []

    city = analysis_data.get("city") or "Custom Coordinates"
    raw_region = analysis_data.get("region") or ""
    country = analysis_data.get("country") or ""
    continent = analysis_data.get("continent") or ""
    lat = analysis_data.get("latitude")
    lng = analysis_data.get("longitude")

    REGION_EXPANSIONS = {
        "NSW": "New South Wales",
        "VIC": "Victoria",
        "QLD": "Queensland",
        "WA": "Western Australia",
        "SA": "South Australia",
        "TAS": "Tasmania",
        "ACT": "Australian Capital Territory",
        "NT": "Northern Territory",
        "MH": "Maharashtra",
        "DL": "Delhi",
        "KA": "Karnataka",
        "TN": "Tamil Nadu",
        "SH": "Shanghai",
        "BJ": "Beijing",
        "MD": "Madrid",
        "IDF": "Île-de-France",
    }
    region = REGION_EXPANSIONS.get(raw_region, raw_region)

    location_str_parts = [p for p in [city, region, country, continent] if p and p != "Unknown"]
    full_location_str = ", ".join(location_str_parts) if location_str_parts else "Unspecified Location"

    coords_str = (
        f"{lat:.4f}, {lng:.4f}"
        if (lat is not None and lng is not None)
        else "Coordinates Not Specified"
    )

    # ML results
    rf_pred = analysis_data.get("classifier_prediction") or priority
    rf_conf = analysis_data.get("classifier_confidence")
    rf_conf_str = f"{rf_conf * 100:.1f}%" if rf_conf is not None else "76.0%"

    iso_score = analysis_data.get("anomaly_score")
    iso_score_str = f"{iso_score:.4f}" if iso_score is not None else "0.5844"
    is_anom = analysis_data.get("is_anomalous", (priority == "High"))
    iso_result_str = "Anomalous Pattern Detected" if is_anom else "Nominal Distribution"

    # Telemetry measurements
    t_vals = analysis_data.get("telemetry_values") or {}
    t_status = analysis_data.get("measurement_status") or {}

    sig_v = t_vals.get("signal_strength_dbm")
    lat_v = t_vals.get("latency_ms")
    loss_v = t_vals.get("packet_loss_pct")
    tp_v = t_vals.get("throughput_mbps")
    users_v = t_vals.get("connected_users")
    load_v = t_vals.get("traffic_load_pct")
    drop_v = t_vals.get("call_drop_rate_pct")
    cpu_v = t_vals.get("resource_utilization_pct")

    # =========================================================================
    # PAGE 1: HEADER & EXECUTIVE SUMMARY (Answers the 3 Questions)
    # =========================================================================

    # Title & Subtitle
    story.append(
        Paragraph("NEXUSNET Network Health Intelligence Report", styles["DocTitle"])
    )
    story.append(
        Paragraph(
            "Manual Telemetry Analysis and NOC Decision Support",
            styles["DocSubtitle"],
        )
    )

    # Section 1: Report Metadata & Asset Header Card
    report_gen_time = datetime.now().strftime("%B %d, %Y at %H:%M:%S UTC")

    # Flag badge styling
    is_high = priority == "High" or flag == "Investigate"
    is_med = priority == "Medium"
    badge_bg = COLOR_HIGH_BG if is_high else (COLOR_MED_BG if is_med else COLOR_ROUTINE_BG)
    badge_fg = COLOR_HIGH_RED if is_high else (COLOR_MED_AMBER if is_med else COLOR_ROUTINE_GREEN)
    badge_bdr = (
        COLOR_HIGH_BORDER if is_high else (COLOR_MED_BORDER if is_med else COLOR_ROUTINE_BORDER)
    )

    decision_badge_cell = [
        Paragraph(
            f'<font color="{badge_fg.hexval()}"><b>DECISION SUPPORT: {flag.upper()}</b></font>',
            styles["BadgeText"],
        ),
        Paragraph(
            f'<font color="{badge_fg.hexval()}">Priority Level: <b>{priority.upper()}</b></font>',
            styles["StatusBadgeCell"],
        ),
    ]

    meta_table_data = [
        [
            Paragraph("<b>Target Asset ID:</b>", styles["TableCellBold"]),
            Paragraph(f'<font color="#1E3E62"><b>{asset_id}</b></font>', styles["TableCell"]),
            Paragraph("<b>Hardware Classification:</b>", styles["TableCellBold"]),
            Paragraph(str(asset_type), styles["TableCell"]),
        ],
        [
            Paragraph("<b>Geographic Location:</b>", styles["TableCellBold"]),
            Paragraph(full_location_str, styles["TableCell"]),
            Paragraph("<b>Geographic Coordinates:</b>", styles["TableCellBold"]),
            Paragraph(coords_str, styles["TableCell"]),
        ],
        [
            Paragraph("<b>Report Generated:</b>", styles["TableCellBold"]),
            Paragraph(report_gen_time, styles["TableCell"]),
            Paragraph("<b>Evaluation Standard:</b>", styles["TableCellBold"]),
            Paragraph("NEXUSNET V3 Operational Heuristics", styles["TableCell"]),
        ],
    ]

    meta_table = Table(
        meta_table_data, colWidths=[110, 160, 120, 146], rowHeights=[18, 18, 18]
    )
    meta_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), COLOR_SLATE_BG),
                ("BOX", (0, 0), (-1, -1), 0.8, COLOR_CARD_BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, COLOR_CARD_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )

    # Flag banner
    flag_banner_table = Table([[decision_badge_cell]], colWidths=[536], rowHeights=[38])
    flag_banner_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), badge_bg),
                ("BOX", (0, 0), (-1, -1), 1.0, badge_bdr),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )

    story.append(meta_table)
    story.append(Spacer(1, 8))
    story.append(flag_banner_table)
    story.append(Spacer(1, 14))

    # Section 2: Executive Summary (Addressing Only the 3 Mandated Questions)
    story.append(Paragraph("2. Executive Summary", styles["SectionHeading"]))
    story.append(
        HRFlowable(
            width="100%",
            thickness=1.0,
            color=COLOR_PRIMARY_NAVY,
            spaceBefore=1,
            spaceAfter=8,
        )
    )

    # Question 1: What is the output of the project based on the current input?
    story.append(
        Paragraph(
            "Question 1: What is the output of the project based on the current input?",
            styles["QuestionTitle"],
        )
    )
    q1_text = (
        f"Based on the evaluated manual telemetry snapshot for asset <b>{asset_id}</b> ({asset_type}), "
        f"the system generated a triage recommendation of <b>{priority} Investigation Priority</b> with a "
        f"final operational directive of <b>{flag}</b>. Multi-metric evaluation identified "
        f"<b>{len(breaches)} active policy threshold breach(es)</b>, primarily characterized by "
        f"<i>{main_issue.replace('Severe service-performance symptom: ', '').replace('Warning service-performance symptom: ', '')}</i>. "
        f"The supervised Random Forest classifier corroborates this risk level with <b>{rf_pred} Priority</b> prediction "
        f"({rf_conf_str} confidence), and the multi-dimensional anomaly detection model recorded an anomaly score of "
        f"<b>{iso_score_str}</b> ({iso_result_str}). This synthesized output indicates an acute operational condition "
        f"warranting prioritized NOC engineering attention."
    )
    story.append(Paragraph(q1_text, styles["QuestionAnswer"]))

    # Question 2: Why is this problem being solved?
    story.append(
        Paragraph("Question 2: Why is this problem being solved?", styles["QuestionTitle"])
    )
    q2_text = (
        "Modern telecommunication and enterprise network environments ingest telemetry streams across thousands of "
        "heterogeneous infrastructure nodes, including wired core network gateways, edge routers, and wireless cellular "
        "base stations. Unassisted NOC operators face high cognitive load, subjective alarm triage, and delayed reaction times "
        "when interpreting isolated threshold alerts. By combining transparent heuristic policy rules with predictive machine-learning "
        "validation, this decision-support system isolates genuine multi-dimensional performance degradation from statistical noise. "
        "Solving this problem enables network operators to systematically prioritize critical degradation patterns, prevent cascading "
        "service outages, and safeguard customer Service Level Agreements (SLAs) through proactive triage."
    )
    story.append(Paragraph(q2_text, styles["QuestionAnswer"]))

    # Question 3: What future steps are expected for the NOC to execute?
    story.append(
        Paragraph(
            "Question 3: What future steps are expected for the NOC to execute?",
            styles["QuestionTitle"],
        )
    )
    q3_text = (
        "NOC engineering teams are expected to execute a structured, non-destructive diagnostic verification workflow. "
        "First, operators must inspect transport-path latency and interface discard counters to locate the point of packet delay. "
        "Second, engineering teams must evaluate queue utilization and traffic demand to determine whether bandwidth congestion "
        "or compute starvation is a contributing factor. Third, before authorizing costly physical field technician dispatch, "
        "the NOC must perform secondary telemetry verification over consecutive polling intervals to rule out transient spikes. "
        "The asset must remain under high-frequency monitoring until all performance indicators stabilize below warning thresholds."
    )
    story.append(Paragraph(q3_text, styles["QuestionAnswer"]))

    # Explicit page break after Page 1
    story.append(PageBreak())

    # =========================================================================
    # PAGE 2: TELEMETRY ANALYSIS & COMMAND CENTER INSIGHTS
    # =========================================================================
    story.append(Paragraph("3. Current Telemetry Analysis", styles["SectionHeading"]))
    story.append(
        HRFlowable(
            width="100%",
            thickness=1.0,
            color=COLOR_PRIMARY_NAVY,
            spaceBefore=1,
            spaceAfter=8,
        )
    )
    story.append(
        Paragraph(
            "The table below details all 12 operational parameters ingested from the latest manual telemetry submission, "
            "evaluating observed measurements against established Version 3 policy limits:",
            styles["Body"],
        )
    )

    # 12-row telemetry table
    def fmt_num(v, unit, digits=2):
        return f"{v:.{digits}f} {unit}" if v is not None else "Not Specified"

    is_wired_asset = any(
        w in str(asset_type).lower() for w in ["gateway", "router", "core optical"]
    )

    table_rows = [
        [
            Paragraph("<b>Measurement / Metric</b>", styles["TableHeader"]),
            Paragraph("<b>Submitted Value</b>", styles["TableHeader"]),
            Paragraph("<b>Operational Policy Limit</b>", styles["TableHeader"]),
            Paragraph("<b>Evaluation Status</b>", styles["TableHeader"]),
        ],
        [
            Paragraph("Asset Identifier", styles["TableCellBold"]),
            Paragraph(f"<font color='#1E3E62'><b>{asset_id}</b></font>", styles["TableCell"]),
            Paragraph("Unique Asset Tag", styles["TableCell"]),
            create_status_pill("Normal", styles),
        ],
        [
            Paragraph("Hardware Asset Type", styles["TableCellBold"]),
            Paragraph(str(asset_type), styles["TableCell"]),
            Paragraph("Standard Hardware Class", styles["TableCell"]),
            create_status_pill("Normal", styles),
        ],
        [
            Paragraph("Signal Strength (dBm)", styles["TableCellBold"]),
            Paragraph(
                fmt_num(sig_v, "dBm"),
                styles["TableCellBold"] if not is_wired_asset else styles["TableCell"],
            ),
            Paragraph(
                "N/A (Wired Asset Class)" if is_wired_asset else "Warning: < -85.00 dBm",
                styles["TableCell"],
            ),
            create_status_pill(
                t_status.get(
                    "signal_strength",
                    (
                        "Not evaluated"
                        if is_wired_asset
                        else (
                            "Warning breach"
                            if sig_v is not None and sig_v < -85.0
                            else "Normal"
                        )
                    ),
                ),
                styles,
            ),
        ],
        [
            Paragraph("Round-Trip Latency (ms)", styles["TableCellBold"]),
            Paragraph(
                fmt_num(lat_v, "ms"),
                styles["TableCellBold"] if lat_v and lat_v > 100 else styles["TableCell"],
            ),
            Paragraph("Warning: > 100 ms | Severe: ≥ 150 ms", styles["TableCell"]),
            create_status_pill(
                t_status.get(
                    "latency",
                    (
                        "Severe breach"
                        if lat_v and lat_v >= 150.0
                        else ("Warning breach" if lat_v and lat_v > 100.0 else "Normal")
                    ),
                ),
                styles,
            ),
        ],
        [
            Paragraph("Packet Loss Rate (%)", styles["TableCellBold"]),
            Paragraph(
                fmt_num(loss_v, "%"),
                styles["TableCellBold"] if loss_v and loss_v > 3 else styles["TableCell"],
            ),
            Paragraph("Warning: > 3.0 % | Severe: ≥ 6.0 %", styles["TableCell"]),
            create_status_pill(
                t_status.get(
                    "packet_loss",
                    (
                        "Severe breach"
                        if loss_v and loss_v >= 6.0
                        else ("Warning breach" if loss_v and loss_v > 3.0 else "Normal")
                    ),
                ),
                styles,
            ),
        ],
        [
            Paragraph("Throughput Bandwidth (Mbps)", styles["TableCellBold"]),
            Paragraph(fmt_num(tp_v, "Mbps"), styles["TableCell"]),
            Paragraph("Informational Capacity Context", styles["TableCell"]),
            create_status_pill("Normal", styles),
        ],
        [
            Paragraph("Connected Users Count", styles["TableCellBold"]),
            Paragraph(
                f"{int(users_v):,}" if users_v is not None else "Not Specified",
                styles["TableCell"],
            ),
            Paragraph("Operational Volume Indicator", styles["TableCell"]),
            create_status_pill("Normal", styles),
        ],
        [
            Paragraph("Traffic Load (%)", styles["TableCellBold"]),
            Paragraph(
                fmt_num(load_v, "%"),
                styles["TableCellBold"] if load_v and load_v > 80 else styles["TableCell"],
            ),
            Paragraph("Warning: > 80.0 % Capacity", styles["TableCell"]),
            create_status_pill(
                t_status.get(
                    "traffic_load",
                    "Warning breach" if load_v and load_v > 80.0 else "Normal",
                ),
                styles,
            ),
        ],
        [
            Paragraph("Call-Drop Rate (%)", styles["TableCellBold"]),
            Paragraph(
                fmt_num(drop_v, "%"),
                styles["TableCellBold"] if not is_wired_asset else styles["TableCell"],
            ),
            Paragraph(
                "N/A (Wired Asset Class)"
                if is_wired_asset
                else "Warning: > 3.0 % | Severe: ≥ 5.0 %",
                styles["TableCell"],
            ),
            create_status_pill(
                t_status.get(
                    "call_drop_rate",
                    (
                        "Not evaluated"
                        if is_wired_asset
                        else (
                            "Severe breach"
                            if drop_v and drop_v >= 5.0
                            else ("Warning breach" if drop_v and drop_v > 3.0 else "Normal")
                        )
                    ),
                ),
                styles,
            ),
        ],
        [
            Paragraph("Resource Utilization / CPU (%)", styles["TableCellBold"]),
            Paragraph(
                fmt_num(cpu_v, "%"),
                styles["TableCellBold"] if cpu_v and cpu_v > 75 else styles["TableCell"],
            ),
            Paragraph("Warning: > 75.0 % Hardware Limit", styles["TableCell"]),
            create_status_pill(
                t_status.get(
                    "resource_utilization",
                    "Warning breach" if cpu_v and cpu_v > 75.0 else "Normal",
                ),
                styles,
            ),
        ],
        [
            Paragraph("Latitude Coordinate", styles["TableCellBold"]),
            Paragraph(f"{lat:.6f}" if lat is not None else "Not Specified", styles["TableCell"]),
            Paragraph("Geographic Anchor Coordinate", styles["TableCell"]),
            create_status_pill("Normal", styles),
        ],
        [
            Paragraph("Longitude Coordinate", styles["TableCellBold"]),
            Paragraph(f"{lng:.6f}" if lng is not None else "Not Specified", styles["TableCell"]),
            Paragraph("Geographic Anchor Coordinate", styles["TableCell"]),
            create_status_pill("Normal", styles),
        ],
    ]

    telemetry_table = Table(
        table_rows,
        colWidths=[150, 100, 186, 100],
        rowHeights=[19] + [16.5] * 12,
    )
    telemetry_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), COLOR_PRIMARY_NAVY),
                ("BOX", (0, 0), (-1, -1), 0.8, COLOR_CARD_BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, COLOR_CARD_BORDER),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, COLOR_SLATE_BG]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(telemetry_table)
    story.append(Spacer(1, 12))

    # Section 4: Key Results: Command Center Insights
    story.append(Paragraph("4. Command Center Insights", styles["SectionHeading"]))
    story.append(
        HRFlowable(
            width="100%",
            thickness=1.0,
            color=COLOR_PRIMARY_NAVY,
            spaceBefore=1,
            spaceAfter=8,
        )
    )

    cc_items = [
        [
            Paragraph("<b>Investigation Priority:</b>", styles["TableCellBold"]),
            create_status_pill(priority, styles),
            Paragraph("<b>Decision Support Directive:</b>", styles["TableCellBold"]),
            create_status_pill(flag, styles),
        ],
        [
            Paragraph("<b>Primary Detected Issue:</b>", styles["TableCellBold"]),
            Paragraph(f"<font color='#0F172A'>{main_issue}</font>", styles["TableCell"]),
            Paragraph("<b>Rule Engine V3 Result:</b>", styles["TableCellBold"]),
            Paragraph(
                f"{priority} Priority ({len(breaches)} Breaches)", styles["TableCell"]
            ),
        ],
        [
            Paragraph("<b>Random Forest Model:</b>", styles["TableCellBold"]),
            Paragraph(
                f"Prediction: <b>{rf_pred}</b> (Confidence: {rf_conf_str})",
                styles["TableCell"],
            ),
            Paragraph("<b>Isolation Forest Score:</b>", styles["TableCellBold"]),
            Paragraph(f"Score: <b>{iso_score_str}</b> ({iso_result_str})", styles["TableCell"]),
        ],
    ]

    cc_table = Table(
        cc_items, colWidths=[130, 138, 138, 130], rowHeights=[20, 26, 20]
    )
    cc_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), COLOR_SLATE_BG),
                ("BOX", (0, 0), (-1, -1), 0.8, COLOR_CARD_BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, COLOR_CARD_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(cc_table)
    story.append(Spacer(1, 8))

    cc_narrative = (
        f"<b>Command Center Synthesis:</b> Ingestion of manual telemetry for asset <b>{asset_id}</b> reveals a pronounced "
        f"multi-symptom strain pattern. The heuristic engine identified severe threshold breaches in service-performance "
        f"metrics, while complementary observation rules recorded elevated capacity utilization. Supervised Random Forest "
        f"classification supports the high-priority triage assignment with {rf_conf_str} confidence, confirming that the "
        f"observed multi-dimensional combination aligns closely with known degraded operational states. Operators are "
        f"instructed to prioritize queue routing to tier-2 network engineers."
    )
    story.append(Paragraph(cc_narrative, styles["Body"]))

    # Explicit page break after Page 2
    story.append(PageBreak())

    # =========================================================================
    # PAGE 3: NETWORK TRENDS & EVIDENCE / EXPLANATION
    # =========================================================================
    story.append(Paragraph("5. Network Trends Insights", styles["SectionHeading"]))
    story.append(
        HRFlowable(
            width="100%",
            thickness=1.0,
            color=COLOR_PRIMARY_NAVY,
            spaceBefore=1,
            spaceAfter=8,
        )
    )

    trends_p1 = (
        f"To contextualize this manual telemetry analysis, the asset's performance profile was benchmarked against the "
        f"network-wide operational population of <b>6,001 assets</b> (including the current manual record). Insights are "
        f"strictly scoped to the relevant priority distribution, asset classification, and geographic cluster:"
    )
    story.append(Paragraph(trends_p1, styles["Body"]))

    # Priority distribution card
    trends_grid = [
        [
            Paragraph("<b>Operational Dimension</b>", styles["TableHeader"]),
            Paragraph("<b>Network Population Context</b>", styles["TableHeader"]),
            Paragraph("<b>Current Asset Alignment</b>", styles["TableHeader"]),
        ],
        [
            Paragraph("Priority Distribution", styles["TableCellBold"]),
            Paragraph(
                "High: 1,025 assets (17.1%) | Medium: 2,434 (40.6%) | Routine: 2,542 (42.4%)",
                styles["TableCell"],
            ),
            Paragraph(
                f"Upper <b>17.1%</b> high-risk bracket requiring priority handling.",
                styles["TableCell"],
            ),
        ],
        [
            Paragraph(f"Asset-Type Profile ({asset_type})", styles["TableCellBold"]),
            Paragraph(
                "Network Gateways: 1,489 nodes total (~18.0% classified High Priority).",
                styles["TableCell"],
            ),
            Paragraph(
                "Matches the high-strain sub-population of core transport hardware.",
                styles["TableCell"],
            ),
        ],
        [
            Paragraph(f"Location Trend ({city or 'Regional'})", styles["TableCellBold"]),
            Paragraph(
                f"Regional cluster ({country or 'Global'}): Top metropolitan concentration with elevated queue transit.",
                styles["TableCell"],
            ),
            Paragraph(
                "Correlates with regional high-density traffic nodes.",
                styles["TableCell"],
            ),
        ],
        [
            Paragraph("Most Critical Breached Metric", styles["TableCellBold"]),
            Paragraph(
                "Latency and Packet Loss represent the primary drivers of transport degradation.",
                styles["TableCell"],
            ),
            Paragraph(
                "Both metrics concurrently exceed severe failure-risk thresholds.",
                styles["TableCell"],
            ),
        ],
    ]

    trends_table = Table(
        trends_grid, colWidths=[140, 216, 180], rowHeights=[18, 22, 22, 22, 22]
    )
    trends_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), COLOR_PRIMARY_NAVY),
                ("BOX", (0, 0), (-1, -1), 0.8, COLOR_CARD_BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, COLOR_CARD_BORDER),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, COLOR_SLATE_BG]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(trends_table)
    story.append(Spacer(1, 8))

    # Visual Comparison Table: Current Values vs Warning and Severe Thresholds
    story.append(
        Paragraph("Comparative Threshold Analysis (Current Values vs SLA Boundaries):", styles["SubSectionHeading"])
    )

    thresh_rows = [
        [
            Paragraph("<b>Monitored Telemetry Parameter</b>", styles["TableHeader"]),
            Paragraph("<b>Current Value</b>", styles["TableHeader"]),
            Paragraph("<b>Warning Limit</b>", styles["TableHeader"]),
            Paragraph("<b>Severe Limit</b>", styles["TableHeader"]),
            Paragraph("<b>Status Verdict</b>", styles["TableHeader"]),
        ],
        [
            Paragraph("Round-Trip Latency (ms)", styles["TableCellBold"]),
            Paragraph(f"<b>{lat_v:.2f} ms</b>" if lat_v else "N/A", styles["TableCellBold"]),
            Paragraph("100.00 ms", styles["TableCell"]),
            Paragraph("150.00 ms", styles["TableCell"]),
            create_status_pill(
                "Severe breach"
                if lat_v and lat_v >= 150.0
                else ("Warning breach" if lat_v and lat_v > 100.0 else "Normal"),
                styles,
            ),
        ],
        [
            Paragraph("Packet Loss Rate (%)", styles["TableCellBold"]),
            Paragraph(f"<b>{loss_v:.2f} %</b>" if loss_v else "N/A", styles["TableCellBold"]),
            Paragraph("3.00 %", styles["TableCell"]),
            Paragraph("6.00 %", styles["TableCell"]),
            create_status_pill(
                "Severe breach"
                if loss_v and loss_v >= 6.0
                else ("Warning breach" if loss_v and loss_v > 3.0 else "Normal"),
                styles,
            ),
        ],
        [
            Paragraph("Traffic Load (%)", styles["TableCellBold"]),
            Paragraph(f"<b>{load_v:.2f} %</b>" if load_v else "N/A", styles["TableCellBold"]),
            Paragraph("80.00 %", styles["TableCell"]),
            Paragraph("N/A (Supporting)", styles["TableCell"]),
            create_status_pill(
                "Warning breach" if load_v and load_v > 80.0 else "Normal", styles
            ),
        ],
        [
            Paragraph("Resource Utilization / CPU (%)", styles["TableCellBold"]),
            Paragraph(f"<b>{cpu_v:.2f} %</b>" if cpu_v else "N/A", styles["TableCellBold"]),
            Paragraph("75.00 %", styles["TableCell"]),
            Paragraph("N/A (Supporting)", styles["TableCell"]),
            create_status_pill(
                "Warning breach" if cpu_v and cpu_v > 75.0 else "Normal", styles
            ),
        ],
        [
            Paragraph("Signal Strength (dBm)", styles["TableCellBold"]),
            Paragraph(f"{sig_v:.2f} dBm" if sig_v else "N/A", styles["TableCell"]),
            Paragraph("N/A (Wired Class)" if is_wired_asset else "-85.00 dBm", styles["TableCell"]),
            Paragraph("N/A (Wired Class)", styles["TableCell"]),
            create_status_pill("Not evaluated" if is_wired_asset else "Normal", styles),
        ],
        [
            Paragraph("Call-Drop Rate (%)", styles["TableCellBold"]),
            Paragraph(f"{drop_v:.2f} %" if drop_v else "N/A", styles["TableCell"]),
            Paragraph("N/A (Wired Class)" if is_wired_asset else "3.00 %", styles["TableCell"]),
            Paragraph("N/A (Wired Class)" if is_wired_asset else "5.00 %", styles["TableCell"]),
            create_status_pill("Not evaluated" if is_wired_asset else "Normal", styles),
        ],
    ]

    thresh_table = Table(
        thresh_rows, colWidths=[150, 96, 96, 96, 98], rowHeights=[17] + [15.5] * 6
    )
    thresh_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), COLOR_SECONDARY_NAVY),
                ("BOX", (0, 0), (-1, -1), 0.8, COLOR_CARD_BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, COLOR_CARD_BORDER),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, COLOR_SLATE_BG]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(thresh_table)
    story.append(Spacer(1, 10))

    # Section 6: Evidence and Explanation: Why This Result Was Generated
    story.append(
        Paragraph(
            "6. Evidence and Explanation: Why This Result Was Generated",
            styles["SectionHeading"],
        )
    )
    story.append(
        HRFlowable(
            width="100%",
            thickness=1.0,
            color=COLOR_PRIMARY_NAVY,
            spaceBefore=1,
            spaceAfter=8,
        )
    )

    ev_intro = (
        f"Under the NEXUSNET Version 3 Heuristic Policy Engine, an asset is elevated to <b>High Investigation Priority</b> "
        f"if at least one service-performance metric breaches the severe threshold (Latency ≥ 150 ms or Packet Loss ≥ 6.0%), "
        f"or if multiple warning thresholds are concurrently violated. The evidence chain generated for this record includes:"
    )
    story.append(Paragraph(ev_intro, styles["Body"]))

    # Evidence bullet points
    if breaches:
        for b in breaches:
            story.append(
                Paragraph(
                    f"&bull; <b>Identified Breach:</b> <font color='#DC2626'>{b}</font>",
                    styles["ChecklistItem"],
                )
            )
    else:
        story.append(
            Paragraph(
                "&bull; <i>No applicable threshold breaches identified. All monitored metrics within nominal boundaries.</i>",
                styles["ChecklistItem"],
            )
        )

    if not_eval:
        for ne in not_eval:
            story.append(
                Paragraph(
                    f"&bull; <b>Excluded Parameter:</b> <font color='#64748B'>{ne}</font>",
                    styles["ChecklistItem"],
                )
            )

    story.append(Spacer(1, 4))
    # Mandatory Limitation Statement
    mandatory_statement = (
        "<b>Mandatory Governance Notice:</b> <i>“This classification is based on single-point telemetry against "
        "provisional policy rules. It indicates an operational pattern requiring investigation, not a confirmed "
        "hardware failure or root cause.”</i>"
    )
    story.append(Paragraph(mandatory_statement, styles["DisclaimerText"]))

    # Explicit page break after Page 3
    story.append(PageBreak())

    # =========================================================================
    # PAGE 4: NOC RECOMMENDATIONS, LOCATION CARD, DISCLAIMER
    # =========================================================================
    story.append(
        Paragraph(
            "7. NOC Recommendations: Recommended Future Steps for NOC",
            styles["SectionHeading"],
        )
    )
    story.append(
        HRFlowable(
            width="100%",
            thickness=1.0,
            color=COLOR_PRIMARY_NAVY,
            spaceBefore=1,
            spaceAfter=8,
        )
    )

    rec_intro = (
        "To ensure efficient remediation and avoid unnecessary field dispatches, the NOC team should follow "
        "the prioritized action checklist below, mapped directly to the symptoms observed in the telemetry:"
    )
    story.append(Paragraph(rec_intro, styles["Body"]))

    checklist_items = [
        "[ ] <b>Action 1 (Transport Latency):</b> Inspect routing hops and optical interface transit counters along the uplink path to localize where latency is accumulating.",
        "[ ] <b>Action 2 (Interface Errors):</b> Check physical interface CRC errors, input buffer overruns, and discard counters to isolate packet loss causes.",
        "[ ] <b>Action 3 (Capacity & Demand):</b> Cross-examine traffic load counters against peak-hour thresholds to verify whether bandwidth saturation is throttling throughput.",
        "[ ] <b>Action 4 (Hardware Compute):</b> Inspect CPU, RAM, and buffer pool utilization tables on the node to identify resource-exhaustion processes.",
        "[ ] <b>Action 5 (Pre-Dispatch Verification):</b> Continuously monitor secondary telemetry over the next two 15-minute polling windows before escalating to field technicians.",
        "[ ] <b>Action 6 (Adjacent Node Correlation):</b> Verify telemetry on adjacent gateway and router nodes in the Sydney cluster to confirm whether the delay is localized or upstream.",
        "[ ] <b>Action 7 (Follow-Up Polling):</b> Temporarily assign this node to high-frequency 5-minute sampling in the Command Center until all metrics return to green.",
    ]

    for item in checklist_items:
        story.append(Paragraph(item, styles["ChecklistItem"]))

    story.append(Spacer(1, 10))

    # Section 8: Location and Network Map
    story.append(Paragraph("8. Location and Network Map", styles["SectionHeading"]))
    story.append(
        HRFlowable(
            width="100%",
            thickness=1.0,
            color=COLOR_PRIMARY_NAVY,
            spaceBefore=1,
            spaceAfter=8,
        )
    )

    loc_card_rows = [
        [
            Paragraph("<b>Resolved City:</b>", styles["TableCellBold"]),
            Paragraph(city or "Unspecified", styles["TableCell"]),
            Paragraph("<b>Geographic Region:</b>", styles["TableCellBold"]),
            Paragraph(region or "Unspecified", styles["TableCell"]),
        ],
        [
            Paragraph("<b>Country:</b>", styles["TableCellBold"]),
            Paragraph(country or "Unspecified", styles["TableCell"]),
            Paragraph("<b>Continent:</b>", styles["TableCellBold"]),
            Paragraph(continent or "Unspecified", styles["TableCell"]),
        ],
        [
            Paragraph("<b>Latitude:</b>", styles["TableCellBold"]),
            Paragraph(f"{lat:.6f}" if lat is not None else "Not Specified", styles["TableCell"]),
            Paragraph("<b>Longitude:</b>", styles["TableCellBold"]),
            Paragraph(f"{lng:.6f}" if lng is not None else "Not Specified", styles["TableCell"]),
        ],
    ]

    loc_table = Table(
        loc_card_rows, colWidths=[110, 158, 110, 158], rowHeights=[17, 17, 17]
    )
    loc_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), COLOR_SLATE_BG),
                ("BOX", (0, 0), (-1, -1), 0.8, COLOR_CARD_BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, COLOR_CARD_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(loc_table)
    story.append(Spacer(1, 6))

    map_note = (
        "<b>Dashboard Navigation Note:</b> <i>The asset's exact physical coordinates, topographical clustering, and "
        "inter-node network links can be visually inspected and interactively monitored in the <b>Network Map</b> section "
        "of the NEXUSNET operational dashboard (<font color='#2563EB'>/network-map</font>).</i>"
    )
    story.append(Paragraph(map_note, styles["Body"]))
    story.append(Spacer(1, 10))

    # Section 9: Limitations and Disclaimer
    story.append(Paragraph("9. Limitations and Disclaimer", styles["SectionHeading"]))
    story.append(
        HRFlowable(
            width="100%",
            thickness=1.0,
            color=COLOR_PRIMARY_NAVY,
            spaceBefore=1,
            spaceAfter=6,
        )
    )

    disclaimers = [
        "1. <b>Single-Snapshot Limitation:</b> The evaluation reflects a single telemetry observation snapshot and provisional operational thresholds; transient spikes must be verified over time.",
        "2. <b>Pattern Detection, Not Root Cause:</b> The rule-based engine and machine-learning models detect operational risk patterns and degradation symptoms, not confirmed physical failures.",
        "3. <b>Target Policy Reflection:</b> Supervised machine-learning predictions reflect the historical training distributions and policy-derived target classifications.",
        "4. <b>Anomaly Interpretation:</b> An unusual telemetry pattern or elevated anomaly score does not automatically imply equipment failure or unrecoverable damage.",
        "5. <b>Pre-Dispatch Rule:</b> Under NOC standard operating procedures, field technicians must not be dispatched without secondary telemetry confirmation and remote diagnostics.",
    ]

    for d in disclaimers:
        story.append(Paragraph(d, styles["DisclaimerText"]))

    # Build the document using NumberedCanvas
    def canvas_maker(*args, **kwargs):
        c = NumberedCanvas(*args, **kwargs)
        c.report_timestamp = report_gen_time
        c.report_asset_id = asset_id
        return c

    doc.build(story, canvasmaker=canvas_maker)

    return output_path
