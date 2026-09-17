import csv
import datetime
import os
import random
import statistics

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

# Merge all items for lookup
ALL_ITEMS = {}
for d in [DEF_FAVORITES, DEF_DRINKS, DEF_MAIN, DEF_DESSERT, DEF_TAMBAHAN]:
    ALL_ITEMS.update(d)

MENU_PRICES = {k: v["price"] for k, v in ALL_ITEMS.items()}

def find_exact_combination(target, menu_prices):
    # Backtracking search to find an exact combination of menu items summing to target.
    # To keep it extremely fast, we only search for combinations of up to 6 items.
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

        # Shuffle items to introduce variability in exact matching
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
    # Generates standard restaurant orders summing to target_revenue exactly.
    orders = []
    running_total = 0
    order_counter = 1

    attempts = 0
    while True:
        attempts += 1
        if attempts > 200:
            # Reset and try again if we get stuck
            orders = []
            running_total = 0
            order_counter = 1
            attempts = 0

        rem = target_revenue - running_total

        # When the remaining amount is in the matchable window [30,000, 120,000]
        if 30000 <= rem <= 120000:
            combo = find_exact_combination(rem, menu_prices)
            if combo is not None:
                # Group combo into a final order or split into smaller orders
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
                # Backtrack: remove the last order and try again
                if orders:
                    popped = orders.pop()
                    running_total -= popped["total"]
                    order_counter -= 1
                continue
        elif rem < 30000:
            # Backtrack: we got too close without matching
            if orders:
                popped = orders.pop()
                running_total -= popped["total"]
                order_counter -= 1
            continue

        # Generate a standard order (1-2 mains, 1-2 drinks, 0-1 dessert, 0-1 extra)
        order_items = []
        
        # 1. Main Dish (mostly 1, sometimes 2)
        num_mains = random.choice([1, 1, 1, 2])
        for _ in range(num_mains):
            order_items.append(random.choice(list(DEF_MAIN.keys())))

        # 2. Drinks / Favorites (1 or 2)
        num_drinks = random.choice([1, 1, 2])
        for _ in range(num_drinks):
            order_items.append(random.choice(list(DEF_DRINKS.keys()) + list(DEF_FAVORITES.keys())))

        # 3. Optional Dessert (40% chance)
        if random.random() < 0.4:
            order_items.append(random.choice(list(DEF_DESSERT.keys())))

        # 4. Optional Extra (30% chance)
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
    print("Generating revenue dataset...")
    
    # 1. Date Range: 1 January 2026 to 30 June 2026 (inclusive)
    start_date = datetime.date(2026, 1, 1)
    end_date = datetime.date(2026, 6, 30)
    delta = end_date - start_date
    num_days = delta.days + 1  # Should be 181
    print(f"Total days to generate: {num_days}")

    # 2. Generate normally distributed revenues
    # Mean and Median = 2,100,000 IDR. Standard Deviation = 460,000 IDR.
    # This guarantees min/max are within bounds [800,000, 3,800,000] and centered perfectly.
    dist = statistics.NormalDist(2100000, 460000)
    raw_revenues = []
    for i in range(1, num_days + 1):
        p = (i - 0.5) / num_days
        val = dist.inv_cdf(p)
        # Round to the nearest 1,000 IDR
        val_rounded = int(round(val / 1000.0) * 1000)
        raw_revenues.append(val_rounded)

    # Verify initial stats
    print(f"Generated Raw Stats -> Mean: {statistics.mean(raw_revenues):,.2f}, Median: {statistics.median(raw_revenues):,.2f}, Min: {raw_revenues[0]:,}, Max: {raw_revenues[-1]:,}")

    # Shuffle to distribute them over the days without losing the normal distribution properties
    # We will seed the random number generator to ensure reproducibility if needed
    random.seed(42)
    shuffled_revenues = list(raw_revenues)
    random.shuffle(shuffled_revenues)

    # 3. Create Date sequence and pair with revenue, then simulate daily orders
    dates = [start_date + datetime.timedelta(days=i) for i in range(num_days)]
    
    daily_records = []
    all_transactions = []

    for date, revenue in zip(dates, shuffled_revenues):
        date_str = date.strftime("%Y-%m-%d")
        
        # Simulate the transactions that sum to this exact revenue
        orders = generate_daily_orders(date_str, revenue, MENU_PRICES)
        
        # Verify the sum matches perfectly
        order_sum = sum(o["total"] for o in orders)
        assert order_sum == revenue, f"Mismatch on {date_str}: Target {revenue}, Got {order_sum}"
        
        daily_records.append({
            "Date": date_str,
            "Daily Revenue (IDR)": revenue
        })
        
        for order in orders:
            # Format items as a friendly string, e.g., "Ayam Geprek x2; Sanger x1"
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

    summary_file = os.path.join(output_dir, "daily_revenue_summary.csv")
    detail_file = os.path.join(output_dir, "detailed_transactions.csv")
    menu_file = os.path.join(output_dir, "mula_menu_reference.csv")

    # Write Daily Revenue Summary
    with open(summary_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["Date", "Daily Revenue (IDR)"])
        writer.writeheader()
        writer.writerows(daily_records)

    # Write Detailed Transactions
    with open(detail_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["Date", "Order ID", "Items", "Order Total (IDR)"])
        writer.writeheader()
        writer.writerows(all_transactions)

    # Write Menu Reference
    with open(menu_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Item ID", "Item Name", "Price (IDR)"])
        for item_id, details in ALL_ITEMS.items():
            writer.writerow([item_id, details["name"], details["price"]])

    print("\nGeneration Completed Successfully!")
    print(f"1. Daily Revenue Summary saved to: {summary_file}")
    print(f"2. Detailed Transactions saved to: {detail_file}")
    print(f"3. MULA Menu Reference saved to: {menu_file}")
    print(f"Total days generated: {len(daily_records)}")
    print(f"Total transactions generated: {len(all_transactions)}")

if __name__ == "__main__":
    main()
