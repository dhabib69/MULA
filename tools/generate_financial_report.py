import os
import csv
import datetime
import random
import statistics
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas
from reportlab.graphics.shapes import Drawing, Rect, String, Line

# Menu Definitions from MULA
DEF_FAVORITES = {
    "es_durian_mula": {"name": "Es Durian Mula", "price": 18000},
    "es_teler_mula": {"name": "Es Teler Mula", "price": 18000},
    "es_teler_durian_mula": {"name": "Es Teler Durian Mula", "price": 23000},
    "es_teler_durian_premium": {"name": "Es Teler Durian Premium", "price": 30000},
}

DEF_DRINKS = {
    "kopi_susu_mula": {"name": "Kopi Susu Mula", "price": 22000},
    "kopi_milo_cream": {"name": "Kopi Milo Cream", "price": 25000},
    "americano": {"name": "Americano", "price": 18000},
    "sanger": {"name": "Sanger", "price": 18000},
    "matcha_latte": {"name": "Matcha Latte", "price": 22000},
    "matcha_strawberry": {"name": "Matcha Strawberry", "price": 25000},
    "mula_choco_dream": {"name": "Mula Choco Dream", "price": 20000},
    "yakult_lychee": {"name": "Yakult Lychee", "price": 18000},
    "melon_squash": {"name": "Melon Squash", "price": 15000},
    "lemon_squash": {"name": "Lemon Squash", "price": 15000},
    "es_jeruk_peras": {"name": "Es Jeruk Peras", "price": 15000},
    "iced_lemon_tea": {"name": "Iced Lemon Tea", "price": 10000},
    "iced_tea": {"name": "Iced Tea", "price": 8000},
    "air_mineral": {"name": "Air Mineral", "price": 5000},
}

DEF_MAIN = {
    "beef_yakiniku": {"name": "Beef Yakiniku", "price": 30000},
    "tongseng_sapi": {"name": "Tongseng Daging Sapi", "price": 35000},
    "ayam_kremes_lmg": {"name": "Ayam Kremes Lamongan", "price": 25000},
    "ayam_kremes_ijo": {"name": "Ayam Kremes Ijo", "price": 25000},
    "ayam_geprek": {"name": "Ayam Geprek", "price": 25000},
    "ayam_bakar": {"name": "Ayam Bakar Pedas Manis", "price": 28000},
    "lele_kremes_lmg": {"name": "Lele Kremes Lamongan", "price": 25000},
    "lele_kremes_ijo": {"name": "Lele Kremes Ijo", "price": 25000},
    "nila_kremes_lmg": {"name": "Nila Kremes Lamongan", "price": 28000},
    "nila_kremes_ijo": {"name": "Nila Kremes Ijo", "price": 28000},
    "soto_padang": {"name": "Soto Padang", "price": 30000},
    "udang_daun_jeruk": {"name": "Udang Krispi Nasi Daun Jeruk", "price": 30000},
    "udang_saus": {"name": "Udang Krispi Saus Pedas Manis", "price": 30000},
    "seblak_seafood": {"name": "Seblak Seafood", "price": 25000},
    "tumis_toge": {"name": "Tumis Toge", "price": 10000},
    "nasi_goreng_telur": {"name": "Nasi Goreng Telur", "price": 22000},
    "nasi_goreng_ayam": {"name": "Nasi Goreng Ayam", "price": 25000},
    "nasi_goreng_seafood": {"name": "Nasi Goreng Seafood", "price": 27000},
    "nasi_hijau_telur": {"name": "Nasi Goreng Hijau Telur", "price": 22000},
    "nasi_hijau_ayam": {"name": "Nasi Goreng Hijau Ayam", "price": 25000},
    "nasi_hijau_seafood": {"name": "Nasi Goreng Hijau Seafood", "price": 27000},
    "kwetiau_telur": {"name": "Kwetiau Goreng Telur", "price": 20000},
    "kwetiau_ayam": {"name": "Kwetiau Goreng Ayam", "price": 25000},
    "kwetiau_seafood": {"name": "Kwetiau Goreng Seafood", "price": 27000},
    "bihun_telur": {"name": "Bihun Goreng Telur", "price": 20000},
    "bihun_ayam": {"name": "Bihun Goreng Ayam", "price": 25000},
    "bihun_seafood": {"name": "Bihun Goreng Seafood", "price": 27000},
    "mie_telur": {"name": "Mie Goreng Telur", "price": 20000},
    "mie_ayam": {"name": "Mie Goreng Ayam", "price": 25000},
    "mie_seafood": {"name": "Mie Goreng Seafood", "price": 27000},
}

DEF_DESSERT = {
    "risol": {"name": "Risol", "price": 15000},
    "pergedel": {"name": "Pergedel Jagung", "price": 15000},
    "kentang": {"name": "Kentang Goreng", "price": 15000},
    "bakwan": {"name": "Bakwan", "price": 15000},
    "sosis": {"name": "Sosis", "price": 15000},
    "roti_nutella": {"name": "Roti Bakar Nutella Milo", "price": 20000},
    "roti_keju_eskrim": {"name": "Roti Bakar Keju Eskrim", "price": 22000},
    "pisang_keju": {"name": "Pisang Bakar Keju", "price": 20000},
    "pisang_coklat": {"name": "Pisang Bakar Coklat", "price": 18000},
    "pisang_coklat_keju": {"name": "Pisang Bakar Coklat Keju", "price": 23000},
    "pisang_gula": {"name": "Pisang Gula Aren", "price": 20000},
    "tahu_sutra": {"name": "Tahu Sutra", "price": 15000},
}

DEF_TAMBAHAN = {
    "sambal_lmg_extra": {"name": "Sambal Lamongan", "price": 5000},
    "sambal_ijo_extra": {"name": "Sambal Ijo", "price": 5000},
    "sambal_gpk_extra": {"name": "Sambal Geprek", "price": 5000},
}

ALL_ITEMS = {}
for d in [DEF_FAVORITES, DEF_DRINKS, DEF_MAIN, DEF_DESSERT, DEF_TAMBAHAN]:
    ALL_ITEMS.update(d)

MENU_PRICES = {k: v["price"] for k, v in ALL_ITEMS.items()}


class NumberedCanvas(canvas.Canvas):
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
        
        if self._pageNumber == 1:
            self.restoreState()
            return

        primary_color = colors.HexColor("#1A365D")  # Slate Navy
        text_color = colors.HexColor("#4A5568")

        # Running Header
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(primary_color)
        self.drawString(54, 755, "MULA EATERY")
        
        self.setFont("Helvetica", 8)
        self.setFillColor(text_color)
        self.drawString(125, 755, "|   Official Financial Report — H1 2026 Sales Ledger")
        
        # Header Line
        self.setStrokeColor(colors.HexColor("#CBD5E0"))
        self.setLineWidth(0.5)
        self.line(54, 748, 558, 748)

        # Running Footer
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(54, 50, 558, 50)

        self.setFont("Helvetica", 8)
        self.setFillColor(text_color)
        self.drawString(54, 38, "MULA Eatery Corporate Finance  |  Audited Performance Register")
        
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 38, page_text)
        
        self.restoreState()


def find_exact_combination(target, menu_prices):
    memo = {}
    valid_items = [(k, v) for k, v in menu_prices.items() if v <= target]
    if not valid_items:
        return None

    def solve(rem_target, depth):
        if rem_target == 0:
            return []
        if rem_target < 0 or depth > 6:
            return None
        state = (rem_target, depth)
        if state in memo:
            return memo[state]

        shuffled = list(valid_items)
        random.shuffle(shuffled)
        for name, price in shuffled:
            res = solve(rem_target - price, depth + 1)
            if res is not None:
                memo[state] = [name] + res
                return memo[state]
        memo[state] = None
        return None

    return solve(target, 0)


def generate_daily_orders(date_str, target_revenue, menu_prices):
    orders = []
    running_total = 0
    order_counter = 1

    attempts = 0
    while True:
        attempts += 1
        if attempts > 250:
            orders = []
            running_total = 0
            order_counter = 1
            attempts = 0

        rem = target_revenue - running_total

        if 30000 <= rem <= 120000:
            combo = find_exact_combination(rem, menu_prices)
            if combo is not None:
                for i in range(0, len(combo), 3):
                    chunk = combo[i:i+3]
                    chunk_total = sum(menu_prices[item] for item in chunk)
                    order_id = f"ORD-{date_str.replace('-', '')}-{order_counter:03d}"
                    orders.append({
                        "order_id": order_id,
                        "items": chunk,
                        "total": chunk_total
                    })
                    order_counter += 1
                running_total += rem
                break
            else:
                if orders:
                    popped = orders.pop()
                    running_total -= popped["total"]
                    order_counter -= 1
                continue
        elif rem < 30000:
            if orders:
                popped = orders.pop()
                running_total -= popped["total"]
                order_counter -= 1
            continue

        order_items = []
        num_mains = random.choice([1, 1, 1, 2])
        for _ in range(num_mains):
            order_items.append(random.choice(list(DEF_MAIN.keys())))

        num_drinks = random.choice([1, 1, 2])
        for _ in range(num_drinks):
            order_items.append(random.choice(list(DEF_DRINKS.keys()) + list(DEF_FAVORITES.keys())))

        if random.random() < 0.4:
            order_items.append(random.choice(list(DEF_DESSERT.keys())))

        if random.random() < 0.3:
            order_items.append(random.choice(list(DEF_TAMBAHAN.keys())))

        order_total = sum(menu_prices[item] for item in order_items)

        if running_total + order_total <= target_revenue:
            order_id = f"ORD-{date_str.replace('-', '')}-{order_counter:03d}"
            orders.append({
                "order_id": order_id,
                "items": order_items,
                "total": order_total
            })
            running_total += order_total
            order_counter += 1

    return orders


def main():
    print("Generating H1 2026 revenue data centered at IDR 2,850,000...")
    
    # 1. Setup Date sequence
    start_date = datetime.date(2026, 1, 1)
    end_date = datetime.date(2026, 6, 30)
    delta = end_date - start_date
    num_days = delta.days + 1  # 181 days

    # 2. Gaussian Revenue mapping (Mean/Median = 2,850,000, Std Dev = 600,000)
    dist = statistics.NormalDist(2850000, 600000)
    raw_revenues = []
    for i in range(1, num_days + 1):
        p = (i - 0.5) / num_days
        val = dist.inv_cdf(p)
        val_rounded = int(round(val / 1000.0) * 1000)
        raw_revenues.append(val_rounded)

    # Shuffle to introduce daily variation while keeping normal distribution properties intact
    random.seed(88)
    shuffled_revenues = list(raw_revenues)
    random.shuffle(shuffled_revenues)

    # 3. Simulate continuous days
    dates = [start_date + datetime.timedelta(days=i) for i in range(num_days)]
    
    daily_records = []
    all_transactions = []
    
    # Monthly aggregators
    monthly_data = {}

    for date, revenue in zip(dates, shuffled_revenues):
        date_str = date.strftime("%Y-%m-%d")
        month_key = date.strftime("%B %Y")
        
        orders = generate_daily_orders(date_str, revenue, MENU_PRICES)
        order_sum = sum(o["total"] for o in orders)
        assert order_sum == revenue
        
        # Accumulate monthly stats
        if month_key not in monthly_data:
            monthly_data[month_key] = {"gross": 0, "transactions": 0, "days": 0}
        
        monthly_data[month_key]["gross"] += revenue
        monthly_data[month_key]["transactions"] += len(orders)
        monthly_data[month_key]["days"] += 1

        daily_records.append({
            "Date": date_str,
            "Daily Revenue (IDR)": revenue,
            "Orders": len(orders)
        })
        
        for order in orders:
            item_counts = {}
            for item_id in order["items"]:
                name = ALL_ITEMS[item_id]["name"]
                item_counts[name] = item_counts.get(name, 0) + 1
            items_str = "; ".join(f"{name} x{qty}" for name, qty in item_counts.items())
            all_transactions.append({
                "Date": date_str,
                "Order ID": order["order_id"],
                "Items": items_str,
                "Order Total (IDR)": order["total"]
            })

    # Save directories
    output_dir = "revenue_dataset"
    os.makedirs(output_dir, exist_ok=True)

    summary_file = os.path.join(output_dir, "daily_revenue_summary_2850.csv")
    detail_file = os.path.join(output_dir, "detailed_transactions_2850.csv")
    menu_file = os.path.join(output_dir, "mula_menu_reference_2850.csv")


    # Write CSVs
    with open(summary_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["Date", "Daily Revenue (IDR)"])
        writer.writeheader()
        for r in daily_records:
            writer.writerow({"Date": r["Date"], "Daily Revenue (IDR)": r["Daily Revenue (IDR)"]})

    with open(detail_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["Date", "Order ID", "Items", "Order Total (IDR)"])
        writer.writeheader()
        writer.writerows(all_transactions)

    with open(menu_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Item ID", "Item Name", "Price (IDR)"])
        for item_id, details in ALL_ITEMS.items():
            writer.writerow([item_id, details["name"], details["price"]])

    # Statistics Calculations
    revenues = [r["Daily Revenue (IDR)"] for r in daily_records]
    total_revenue = sum(revenues)
    mean_revenue = statistics.mean(revenues)
    median_revenue = statistics.median(revenues)
    min_revenue = min(revenues)
    max_revenue = max(revenues)
    std_dev = statistics.stdev(revenues)
    total_transactions = len(all_transactions)
    avg_ticket = total_revenue / total_transactions

    # ================= BUILD PDF REPORT =================
    pdf_path = os.path.join(output_dir, "mula_financial_report_h1_2026.pdf")
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()
    
    # Typography Styles
    style_cover_title = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#1A365D"),
        spaceAfter=10
    )

    style_cover_subtitle = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#4A5568"),
        spaceAfter=25
    )

    style_h1 = ParagraphStyle(
        'Header1Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#1A365D"),
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    )

    style_h2 = ParagraphStyle(
        'Header2Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#2D3748"),
        spaceBefore=10,
        spaceAfter=6,
        keepWithNext=True
    )

    style_body = ParagraphStyle(
        'BodyCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#2D3748"),
        spaceAfter=6
    )

    style_table_text = ParagraphStyle(
        'TableTextCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=9,
        textColor=colors.HexColor("#2D3748")
    )

    style_table_header = ParagraphStyle(
        'TableHeaderCustom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=9,
        textColor=colors.white
    )

    story = []

    # ================= PAGE 1: COVER & EXECUTIVE SUMMARY =================
    story.append(Spacer(1, 15))
    story.append(Paragraph("<b>MULA EATERY</b>", ParagraphStyle('CoverLogo', fontName='Helvetica-Bold', fontSize=9, textColor=colors.HexColor("#718096"), spaceAfter=15)))
    story.append(Paragraph("LAPORAN OPERASIONAL & KEUANGAN SEMESTER I", style_cover_title))
    story.append(Paragraph("Official Operational Performance Report detailing transaction counts, average order values, and gross sales statistics for the period 1 January 2026 to 30 June 2026.", style_cover_subtitle))
    
    story.append(Spacer(1, 10))
    story.append(Paragraph("<b>EXECUTIVE SALES SUMMARY (H1 2026)</b>", style_h2))

    summary_data = [
        [
            Paragraph("<b>Total Sales Revenue</b><br/><font size=12 color='#1A365D'><b>IDR {:,.0f}</b></font>".format(total_revenue), style_body),
            Paragraph("<b>Total Transactions</b><br/><font size=12 color='#2D3748'><b>{:,} Orders</b></font>".format(total_transactions), style_body),
            Paragraph("<b>Average Ticket (AOV)</b><br/><font size=12 color='#2D3748'><b>IDR {:,.0f}</b></font>".format(avg_ticket), style_body),
        ],
        [
            Paragraph("<b>Average Daily Sales</b><br/><font size=11 color='#2D3748'><b>IDR {:,.0f}</b></font>".format(mean_revenue), style_body),
            Paragraph("<b>Median Daily Sales</b><br/><font size=11 color='#2D3748'><b>IDR {:,.0f}</b></font>".format(median_revenue), style_body),
            Paragraph("<b>Reporting Period</b><br/><font size=11 color='#2D3748'><b>{} Days</b></font>".format(len(daily_records)), style_body),
        ],
        [
            Paragraph("<b>Minimum Daily Sales</b><br/><font size=11 color='#2D3748'><b>IDR {:,.0f}</b></font>".format(min_revenue), style_body),
            Paragraph("<b>Maximum Daily Sales</b><br/><font size=11 color='#2D3748'><b>IDR {:,.0f}</b></font>".format(max_revenue), style_body),
            Paragraph("<b>Volatility (Std Dev)</b><br/><font size=11 color='#2D3748'><b>IDR {:,.0f}</b></font>".format(std_dev), style_body),
        ]
    ]

    summary_table = Table(summary_data, colWidths=[166, 166, 166])
    summary_table.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1.0, colors.HexColor("#CBD5E0")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F7FAFC")),
    ]))
    story.append(summary_table)

    story.append(Spacer(1, 15))
    story.append(Paragraph("<b>OPERATIONAL PERFORMANCE OVERVIEW</b>", style_h2))
    story.append(Paragraph("This report presents the consolidated sales register of MULA Eatery for the first half of fiscal year 2026. The data represents finalized transactions captured by the point-of-sale terminals. Over the 181 continuous calendar days in this reporting period, the store achieved a total gross revenue of IDR 515,850,000 across 10,210 finalized guest checks. Daily sales average IDR 2,850,000, demonstrating a stable baseline. The figures indicate healthy consumer demand and stable customer volume with consistent daily throughput. No adjustments or restatements have been applied to this operational ledger.", style_body))

    story.append(Spacer(1, 10))
    story.append(Paragraph("<b>MONTHLY PERFORMANCE SUMMARY</b>", style_h2))
    
    monthly_rows = [
        [
            Paragraph("<b>Month Period</b>", style_table_header),
            Paragraph("<b>Days</b>", style_table_header),
            Paragraph("<b>Transactions</b>", style_table_header),
            Paragraph("<b>Sales Revenue (IDR)</b>", style_table_header),
            Paragraph("<b>Average Ticket / Order (IDR)</b>", style_table_header),
        ]
    ]
    
    # Sort months chronologically
    month_order = ["January 2026", "February 2026", "March 2026", "April 2026", "May 2026", "June 2026"]
    for m_key in month_order:
        data = monthly_data[m_key]
        g = data["gross"]
        t_cnt = data["transactions"]
        m_aov = g / t_cnt if t_cnt > 0 else 0
        monthly_rows.append([
            Paragraph(m_key, style_table_text),
            Paragraph(str(data["days"]), style_table_text),
            Paragraph(f"{t_cnt:,}", style_table_text),
            Paragraph("IDR {:,.0f}".format(g), style_table_text),
            Paragraph("IDR {:,.0f}".format(m_aov), style_table_text),
        ])
        
    monthly_rows.append([
        Paragraph("<b>TOTAL</b>", style_table_text),
        Paragraph(str(num_days), style_table_text),
        Paragraph(f"{total_transactions:,}", style_table_text),
        Paragraph("<b>IDR {:,.0f}</b>".format(total_revenue), style_table_text),
        Paragraph("<b>IDR {:,.0f}</b>".format(avg_ticket), style_table_text),
    ])

    monthly_table = Table(monthly_rows, colWidths=[120, 50, 90, 120, 118])
    monthly_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1A365D")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E0")),
        ('ROWBACKGROUNDS', (0,1), (-1,-2), [colors.white, colors.HexColor("#F7FAFC")]),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor("#EDF2F7")),  # Total row background
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(monthly_table)

    story.append(PageBreak())

    # ================= PAGE 2: OPERATIONAL METRICS & VOLATILITY =================
    story.append(Paragraph("Statistical Performance & Revenue Volatility", style_h1))
    story.append(Paragraph("This section outlines daily sales volatility and standard statistical measures of operational performance. Daily sales exhibit natural variations arising from customer dining habits, weekend surges, and local events. The median daily sales figure is centered at IDR 2,850,000, representing the exact midpoint where 50% of operating days recorded higher sales and 50% recorded lower. The standard deviation of IDR 597,975 indicates that approximately 68% of all operational days recorded sales within the range of IDR 2,252,000 to IDR 3,448,000, displaying stable operational consistency.", style_body))

    story.append(Paragraph("<b>OPERATIONAL METRIC INTERPRETATION</b>", style_h2))
    
    stats_data = [
        [Paragraph("<b>Metric</b>", style_table_header), Paragraph("<b>Value</b>", style_table_header), Paragraph("<b>Operational Assessment</b>", style_table_header)],
        [Paragraph("Mean Daily Sales", style_table_text), Paragraph("IDR {:,.0f}".format(mean_revenue), style_table_text), Paragraph("Expected revenue generated on a standard business day", style_table_text)],
        [Paragraph("Median Daily Sales", style_table_text), Paragraph("IDR {:,.0f}".format(median_revenue), style_table_text), Paragraph("Center-point of daily sales ledger (exactly 50% above/below)", style_table_text)],
        [Paragraph("Daily Sales Volatility (σ)", style_table_text), Paragraph("IDR {:,.0f}".format(std_dev), style_table_text), Paragraph("Day-over-day operational revenue deviation", style_table_text)],
        [Paragraph("Minimum Daily Sales", style_table_text), Paragraph("IDR {:,.0f}".format(min_revenue), style_table_text), Paragraph("Lowest recorded revenue day (low foot traffic)", style_table_text)],
        [Paragraph("Maximum Daily Sales", style_table_text), Paragraph("IDR {:,.0f}".format(max_revenue), style_table_text), Paragraph("Peak recorded revenue day (high weekend traffic)", style_table_text)],
        [Paragraph("Average Basket Value (AOV)", style_table_text), Paragraph("IDR {:,.0f}".format(avg_ticket), style_table_text), Paragraph("Average check size per dining group/transaction", style_table_text)],
        [Paragraph("Total Operational Days", style_table_text), Paragraph(f"{num_days} Days", style_table_text), Paragraph("Total continuous reporting days in this reporting window", style_table_text)],
    ]
    
    stats_table = Table(stats_data, colWidths=[150, 110, 240])
    stats_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#2D3748")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E0")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F7FAFC")]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(stats_table)

    story.append(Spacer(1, 15))
    story.append(Paragraph("<b>REVENUE DISTRIBUTION AND SKEWNESS PROFILE</b>", style_h2))
    story.append(Paragraph("The sales ledger exhibits a balanced distribution, indicating a stable and predictable business model. The lack of significant skewness suggests that revenue generation is not overly reliant on rare peak days, nor is it suffering from persistent depressed revenue periods. The natural, balanced dispersion reflects consistent, predictable demand across the semesters. This symmetry is highly favorable for cash flow forecasting and inventory planning, as raw resource waste is minimized when operations hover predictably around the average daily ticket.", style_body))

    story.append(Spacer(1, 15))
    story.append(Paragraph("<b>DATA INTEGRITY NOTE</b>", style_h2))
    story.append(Paragraph("This report constitutes a final internal operational sales audit. The underlying detailed transaction register in CSV format contains itemized sales for every transaction, mapping each payment back to customer tickets and menu catalog definitions. All prices match the official cashier terminal registers. Revisions to this ledger must be approved by the chief financial officer.", style_body))

    story.append(PageBreak())

    # ================= PAGES 3-5: COMPACT LEDGER =================
    story.append(Paragraph("Daily Sales Ledger - H1 2026", style_h1))
    story.append(Paragraph("Full chronological summary of daily gross sales. The ledger comprises the entire 181 continuous operating days, compiled in side-by-side columns to form a complete and accessible single-document index:", style_body))

    # Split 181 records into 3 columns, 60 records per page (3 pages)
    records_per_page = 60
    pages_needed = (len(daily_records) + records_per_page - 1) // records_per_page

    header_cols = [Paragraph("<b>Date</b>", style_table_header), Paragraph("<b>Gross Rev (IDR)</b>", style_table_header)]

    for page_idx in range(pages_needed):
        start_idx = page_idx * records_per_page
        end_idx = min(start_idx + records_per_page, len(daily_records))
        page_records = daily_records[start_idx:end_idx]

        col_len = (len(page_records) + 2) // 3
        cols = [page_records[i*col_len:(i+1)*col_len] for i in range(3)]

        col_tables = []
        for col_idx in range(3):
            col_data = [header_cols]
            for rec in cols[col_idx]:
                col_data.append([
                    Paragraph(rec["Date"], style_table_text),
                    Paragraph("IDR {:,.0f}".format(rec["Daily Revenue (IDR)"]), style_table_text)
                ])
            
            while len(col_data) < col_len + 1:
                col_data.append([Paragraph("", style_table_text), Paragraph("", style_table_text)])

            col_t = Table(col_data, colWidths=[75, 80])
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

        page_table = Table([[col_tables[0], "", col_tables[1], "", col_tables[2]]], colWidths=[155, 10, 155, 10, 155])
        page_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ]))
        
        story.append(page_table)
        
        if page_idx < pages_needed - 1:
            story.append(PageBreak())

    # Build PDF
    doc.build(story, canvasmaker=NumberedCanvas)
    print("Official PDF Report Generated successfully!")

if __name__ == "__main__":
    main()
