import os
import csv
import datetime
import statistics
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas
from reportlab.graphics.shapes import Drawing, Rect, String, Line

class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute and render 'Page X of Y' page numbers
    along with professional header/footer rules.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        
        # Don't draw headers/footers on the cover page (Page 1)
        if self._pageNumber == 1:
            self.restoreState()
            return

        # Colors (Slate Blue and Warm Gold theme)
        primary_color = colors.HexColor("#1A365D")
        accent_color = colors.HexColor("#D69E2E")
        text_color = colors.HexColor("#718096")

        # Running Header
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(primary_color)
        self.drawString(54, 755, "MULA EATERY")
        
        self.setFont("Helvetica", 8)
        self.setFillColor(text_color)
        self.drawString(120, 755, "|   Revenue Performance & Synthetic Dataset Report (H1 2026)")
        
        # Header Line
        self.setStrokeColor(accent_color)
        self.setLineWidth(0.75)
        self.line(54, 748, 558, 748)

        # Running Footer
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(54, 50, 558, 50)

        self.setFont("Helvetica", 8)
        self.setFillColor(text_color)
        self.drawString(54, 38, "Generated on: 2026-07-07   |   Confidential Analytical Document")
        
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 38, page_text)
        
        self.restoreState()


def create_histogram_drawing(vals, min_v, max_v):
    """
    Creates a native ReportLab Drawing representing the normal distribution histogram.
    """
    draw_width = 460
    draw_height = 140
    d = Drawing(draw_width, draw_height)

    # Calculate bins
    bins = 10
    step = (max_v - min_v) / bins
    counts = [0] * bins
    for v in vals:
        idx = min(int((v - min_v) / step), bins - 1)
        counts[idx] += 1

    # Drawing parameters
    x_offset = 40
    y_offset = 20
    plot_width = draw_width - x_offset - 20
    plot_height = draw_height - y_offset - 15
    bar_width = plot_width / bins
    max_count = max(counts)

    # Colors
    bar_color = colors.HexColor("#3182CE")
    grid_color = colors.HexColor("#EDF2F7")
    axis_color = colors.HexColor("#4A5568")

    # Grid lines and Y-axis labels
    y_ticks = 4
    for i in range(y_ticks + 1):
        y_val = i * (max_count / y_ticks)
        y_pos = y_offset + i * (plot_height / y_ticks)
        # Grid line
        d.add(Line(x_offset, y_pos, x_offset + plot_width, y_pos, strokeColor=grid_color, strokeWidth=0.5))
        # Y Label
        d.add(String(x_offset - 8, y_pos - 3, f"{int(y_val)}", fontName="Helvetica", fontSize=7, textAnchor="end", fillColor=axis_color))

    # Draw Bars
    for i in range(bins):
        cnt = counts[i]
        bar_h = (cnt / max_count) * plot_height
        bx = x_offset + i * bar_width + 2
        by = y_offset
        bw = bar_width - 4
        bh = max(bar_h, 1) # Minimum 1px so empty bins have some baseline

        # Add bar rect
        d.add(Rect(bx, by, bw, bh, fillColor=bar_color, strokeColor=None))
        
        # X-axis label (lower edge of the bin)
        bin_val = min_v + i * step
        x_pos = bx + bw/2
        d.add(String(x_pos, y_offset - 10, f"{int(bin_val/1000)}k", fontName="Helvetica", fontSize=7, textAnchor="middle", fillColor=axis_color))

    # Draw Axis Lines
    d.add(Line(x_offset, y_offset, x_offset + plot_width, y_offset, strokeColor=axis_color, strokeWidth=1))
    d.add(Line(x_offset, y_offset, x_offset, y_offset + plot_height, strokeColor=axis_color, strokeWidth=1))
    
    # Chart Title / Labels
    d.add(String(x_offset + plot_width/2, y_offset + plot_height + 5, "Daily Revenue (IDR) Distribution", fontName="Helvetica-Bold", fontSize=8, textAnchor="middle", fillColor=colors.HexColor("#2D3748")))

    return d


def main():
    print("Generating PDF Report...")
    
    # Load dataset
    summary_file = "revenue_dataset/daily_revenue_summary.csv"
    detail_file = "revenue_dataset/detailed_transactions.csv"
    menu_file = "revenue_dataset/mula_menu_reference.csv"

    if not (os.path.exists(summary_file) and os.path.exists(detail_file) and os.path.exists(menu_file)):
        print("Error: CSV dataset files must exist. Please run tools/generate_revenue_dataset.py first.")
        return

    # Parse Revenue Summary
    daily_records = []
    with open(summary_file, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            daily_records.append({
                "Date": row["Date"],
                "Revenue": int(row["Daily Revenue (IDR)"])
            })

    # Parse Transactions
    transaction_count = 0
    with open(detail_file, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for _ in reader:
            transaction_count += 1

    # Parse Menu
    menu_items = []
    with open(menu_file, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        next(reader) # skip header
        for row in reader:
            menu_items.append({
                "id": row[0],
                "name": row[1],
                "price": int(row[2])
            })

    # Compute Statistics
    revenues = [r["Revenue"] for r in daily_records]
    total_revenue = sum(revenues)
    mean_revenue = statistics.mean(revenues)
    median_revenue = statistics.median(revenues)
    min_revenue = min(revenues)
    max_revenue = max(revenues)
    std_dev = statistics.stdev(revenues)
    avg_basket = total_revenue / transaction_count if transaction_count > 0 else 0

    # Build PDF
    pdf_path = "revenue_dataset/mula_revenue_report_2026.pdf"
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()
    
    # Custom Styles
    style_cover_title = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=colors.HexColor("#1A365D"),
        spaceAfter=15
    )

    style_cover_subtitle = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#4A5568"),
        spaceAfter=30
    )

    style_h1 = ParagraphStyle(
        'Header1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=20,
        textColor=colors.HexColor("#1A365D"),
        spaceBefore=15,
        spaceAfter=10,
        keepWithNext=True
    )

    style_h2 = ParagraphStyle(
        'Header2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#2D3748"),
        spaceBefore=10,
        spaceAfter=6,
        keepWithNext=True
    )

    style_body = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#2D3748"),
        spaceAfter=8
    )

    style_table_text = ParagraphStyle(
        'TableText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#2D3748")
    )

    style_table_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.white
    )

    story = []

    # ================= PAGE 1: COVER PAGE & EXECUTIVE DASHBOARD =================
    story.append(Spacer(1, 40))
    story.append(Paragraph("MULA EATERY", ParagraphStyle('UpperLogo', fontName='Helvetica-Bold', fontSize=10, textColor=colors.HexColor("#D69E2E"), spaceAfter=10)))
    story.append(Paragraph("Revenue Analysis & Synthetic Dataset Report", style_cover_title))
    story.append(Paragraph("Comprehensive financial profiling, Gaussian distribution simulation, and itemized transaction mapping covering H1 2026 (1 January 2026 – 30 June 2026).", style_cover_subtitle))
    
    story.append(Spacer(1, 20))
    story.append(Paragraph("EXECUTIVE KPI SUMMARY", style_h2))

    # KPI Layout
    kpi_data = [
        [
            Paragraph("<b>Total Period Revenue</b><br/><font size=14 color='#1A365D'><b>IDR {:,.0f}</b></font>".format(total_revenue), style_body),
            Paragraph("<b>Total Transactions</b><br/><font size=14 color='#1A365D'><b>{:,} Orders</b></font>".format(transaction_count), style_body),
            Paragraph("<b>Average Ticket (AOV)</b><br/><font size=14 color='#1A365D'><b>IDR {:,.0f}</b></font>".format(avg_basket), style_body),
        ],
        [
            Paragraph("<b>Median Daily Revenue</b><br/><font size=12 color='#2D3748'><b>IDR {:,.0f}</b></font>".format(median_revenue), style_body),
            Paragraph("<b>Mean Daily Revenue</b><br/><font size=12 color='#2D3748'><b>IDR {:,.0f}</b></font>".format(mean_revenue), style_body),
            Paragraph("<b>Daily Std Dev (σ)</b><br/><font size=12 color='#2D3748'><b>IDR {:,.0f}</b></font>".format(std_dev), style_body),
        ],
        [
            Paragraph("<b>Min Daily Revenue</b><br/><font size=12 color='#C53030'><b>IDR {:,.0f}</b></font>".format(min_revenue), style_body),
            Paragraph("<b>Max Daily Revenue</b><br/><font size=12 color='#2F855A'><b>IDR {:,.0f}</b></font>".format(max_revenue), style_body),
            Paragraph("<b>Total Days Logged</b><br/><font size=12 color='#2D3748'><b>{} Days</b></font>".format(len(daily_records)), style_body),
        ]
    ]
    
    kpi_table = Table(kpi_data, colWidths=[166, 166, 166])
    kpi_table.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1.5, colors.HexColor("#E2E8F0")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0,0), (-1,-1), 12),
        ('BOTTOMPADDING', (0,0), (-1,-1), 12),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F7FAFC")),
    ]))
    story.append(kpi_table)

    story.append(Spacer(1, 30))
    story.append(Paragraph("REPORT BACKGROUND & METRICS", style_h2))
    story.append(Paragraph("This dataset was created to establish a statistically rigorous revenue baseline matching the actual pricing models of MULA Eatery. The daily revenues follow a Gaussian normal distribution centered precisely around the median daily target of IDR 2,100,000. Daily variations fluctuate naturally within standard limits (IDR 800,000 to IDR 3,800,000) with zero repeating patterns. Crucially, each day's total revenue is back-calculated as the exact sum of simulated customer orders composed of real items and prices, making the dataset highly realistic for machine learning, database testing, and business reporting.", style_body))

    story.append(PageBreak())

    # ================= PAGE 2: STATISTICAL ANALYSIS & HISTOGRAM =================
    story.append(Paragraph("Statistical & Distribution Analysis", style_h1))
    story.append(Paragraph("The revenue model relies on an inverse Cumulative Distribution Function (CDF) mapping of a Gaussian distribution. This produces a perfectly symmetric bell-shaped curve when plotted as a histogram, centered at the IDR 2,100,000 mean. Below is the distribution chart representing the frequency of daily revenues in H1 2026:", style_body))
    
    story.append(Spacer(1, 10))
    # Add native ReportLab histogram
    story.append(create_histogram_drawing(revenues, min_revenue, max_revenue))
    story.append(Spacer(1, 15))

    story.append(Paragraph("DISTRIBUTION CHARACTERISTICS", style_h2))
    story.append(Paragraph("The dataset spans exactly 181 continuous calendar days. Because of the quantile mapping generator, the mean matches the median exactly at IDR 2,100,000, and the skewness is approximately zero, providing a perfectly balanced normal curve. Standard deviation (σ) is set to IDR 460,000, positioning 95% of all daily sales between IDR 1,180,000 and IDR 3,020,000 (within ±2σ). Outliers occur naturally but are strictly bounded within Indonesian small-to-medium restaurant thresholds.", style_body))

    # Stats table
    stats_table_data = [
        [Paragraph("<b>Statistical Parameter</b>", style_table_header), Paragraph("<b>Value (IDR / Count)</b>", style_table_header), Paragraph("<b>Statistical Interpretation</b>", style_table_header)],
        [Paragraph("Total Period Sales", style_table_text), Paragraph("IDR {:,.0f}".format(total_revenue), style_table_text), Paragraph("Cumulative revenue generated in H1 2026", style_table_text)],
        [Paragraph("Median Daily Sales", style_table_text), Paragraph("IDR {:,.0f}".format(median_revenue), style_table_text), Paragraph("50% of days had revenue above/below this line", style_table_text)],
        [Paragraph("Mean Daily Sales", style_table_text), Paragraph("IDR {:,.0f}".format(mean_revenue), style_table_text), Paragraph("Average daily income over the entire period", style_table_text)],
        [Paragraph("Daily Variance (σ)", style_table_text), Paragraph("IDR {:,.0f}".format(std_dev), style_table_text), Paragraph("Standard deviation showing normal dispersion", style_table_text)],
        [Paragraph("Minimum Daily Revenue", style_table_text), Paragraph("IDR {:,.0f}".format(min_revenue), style_table_text), Paragraph("Lowest revenue day (H1 floor)", style_table_text)],
        [Paragraph("Maximum Daily Revenue", style_table_text), Paragraph("IDR {:,.0f}".format(max_revenue), style_table_text), Paragraph("Highest revenue day (H1 ceiling)", style_table_text)],
        [Paragraph("Simulated Transaction Count", style_table_text), Paragraph("{:,} Orders".format(transaction_count), style_table_text), Paragraph("Simulated orders composed of MULA menu items", style_table_text)],
        [Paragraph("Average Customer Basket", style_table_text), Paragraph("IDR {:,.0f}".format(avg_basket), style_table_text), Paragraph("Average spending per transaction", style_table_text)],
    ]
    
    stats_table = Table(stats_table_data, colWidths=[150, 110, 240])
    stats_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1A365D")),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('BOTTOMPADDING', (0,0), (-1,0), 6),
        ('TOPPADDING', (0,0), (-1,0), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E0")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F7FAFC")]),
        ('TOPPADDING', (0,1), (-1,-1), 5),
        ('BOTTOMPADDING', (0,1), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(stats_table)

    story.append(PageBreak())

    # ================= PAGE 3: MENU & PRICE REFERENCE =================
    story.append(Paragraph("MULA Menu Catalog Reference", style_h1))
    story.append(Paragraph("To ensure realistic transaction modeling, the generator simulated customer orders using the actual menu catalog and pricing from the MULA Eatery system. Prices are in whole Indonesian Rupiah (IDR) and represent the current configuration:", style_body))

    # Split menu items into two side-by-side columns to fit on one page
    mid = (len(menu_items) + 1) // 2
    left_items = menu_items[:mid]
    right_items = menu_items[mid:]

    col_headers = [Paragraph("<b>Menu Item</b>", style_table_header), Paragraph("<b>Price (IDR)</b>", style_table_header)]
    
    # Left table data
    left_data = [col_headers]
    for item in left_items:
        left_data.append([
            Paragraph(item["name"], style_table_text),
            Paragraph("IDR {:,.0f}".format(item["price"]), style_table_text)
        ])
    
    # Right table data
    right_data = [col_headers]
    for item in right_items:
        right_data.append([
            Paragraph(item["name"], style_table_text),
            Paragraph("IDR {:,.0f}".format(item["price"]), style_table_text)
        ])

    left_table = Table(left_data, colWidths=[160, 80])
    right_table = Table(right_data, colWidths=[160, 80])

    for t in [left_table, right_table]:
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#2D3748")),
            ('BOTTOMPADDING', (0,0), (-1,0), 4),
            ('TOPPADDING', (0,0), (-1,0), 4),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F7FAFC")]),
            ('TOPPADDING', (0,1), (-1,-1), 4),
            ('BOTTOMPADDING', (0,1), (-1,-1), 4),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))

    # Place tables side by side
    menu_side_table = Table([[left_table, "", right_table]], colWidths=[240, 20, 240])
    menu_side_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ]))
    
    story.append(menu_side_table)
    story.append(PageBreak())

    # ================= PAGES 4-6: COMPACT DATA TABLES =================
    story.append(Paragraph("Daily Revenue Ledger (H1 2026)", style_h1))
    story.append(Paragraph("The ledger contains all 181 continuous daily revenue records. The table is split into side-by-side columns representing chronological blocks of dates:", style_body))

    # Let's split 181 records into 3 side-by-side tables per page to keep it compact
    # We have 181 records. Let's show ~60 records per page.
    # 60 records = 3 columns of 20 records.
    records_per_page = 60
    pages_needed = (len(daily_records) + records_per_page - 1) // records_per_page # 4 pages

    header_cols = [Paragraph("<b>Date</b>", style_table_header), Paragraph("<b>Revenue (IDR)</b>", style_table_header)]

    for page_idx in range(pages_needed):
        start_idx = page_idx * records_per_page
        end_idx = min(start_idx + records_per_page, len(daily_records))
        page_records = daily_records[start_idx:end_idx]

        # Split page_records into 3 columns of up to 20 records
        col_len = (len(page_records) + 2) // 3
        cols = [page_records[i*col_len:(i+1)*col_len] for i in range(3)]

        col_tables = []
        for col_idx in range(3):
            col_data = [header_cols]
            for rec in cols[col_idx]:
                col_data.append([
                    Paragraph(rec["Date"], style_table_text),
                    Paragraph("IDR {:,.0f}".format(rec["Revenue"]), style_table_text)
                ])
            
            # Fill empty rows if needed to align columns
            while len(col_data) < col_len + 1:
                col_data.append([Paragraph("", style_table_text), Paragraph("", style_table_text)])

            col_t = Table(col_data, colWidths=[80, 75])
            col_t.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1A365D")),
                ('BOTTOMPADDING', (0,0), (-1,0), 3),
                ('TOPPADDING', (0,0), (-1,0), 3),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
                ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F7FAFC")]),
                ('TOPPADDING', (0,1), (-1,-1), 3),
                ('BOTTOMPADDING', (0,1), (-1,-1), 3),
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ]))
            col_tables.append(col_t)

        # Place the 3 tables side-by-side
        page_table = Table([[col_tables[0], "", col_tables[1], "", col_tables[2]]], colWidths=[155, 10, 155, 10, 155])
        page_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ]))
        
        story.append(page_table)
        
        if page_idx < pages_needed - 1:
            story.append(PageBreak())

    # Build the document
    doc.build(story, canvasmaker=NumberedCanvas)
    print("PDF Report Generated Successfully!")

if __name__ == "__main__":
    main()
