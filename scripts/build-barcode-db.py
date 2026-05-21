#!/usr/bin/env python3
"""
Build a compact barcode -> {name, category} lookup from USDA FoodData Central branded foods.
Uses streaming one-object-at-a-time parsing -- never loads the full 3.1GB into memory.
Output: public/barcodeDB.json
"""

import json, os, time

CATEGORY_MAP = {
    'Fresh Vegetables': 'Produce', 'Fresh Fruits': 'Produce',
    'Pre-Packaged Fruit & Vegetables': 'Produce', 'Salad': 'Produce',
    'Vegetable and Lentil Mixes': 'Produce',
    'Cheese': 'Dairy', 'Milk': 'Dairy', 'Yogurt': 'Dairy',
    'Butter and Margarine': 'Dairy', 'Ice Cream & Frozen Yogurt': 'Dairy',
    'Cream': 'Dairy', 'Dairy': 'Dairy',
    'Poultry': 'Meat', 'Beef Products': 'Meat', 'Pork Products': 'Meat',
    'Sausages': 'Meat', 'Luncheon Meats/Cold Cuts': 'Meat', 'Meat': 'Meat',
    'Lamb, Veal, and Game Products': 'Meat', 'Hot Dogs': 'Meat',
    'Finfish and Shellfish Products': 'Seafood', 'Seafood': 'Seafood',
    'Canned Seafood': 'Seafood', 'Fish': 'Seafood',
    'Pasta by Shape & Type': 'Grains', 'Rice': 'Grains',
    'Cereal': 'Grains', 'Oatmeal': 'Grains', 'Flour': 'Grains',
    'Quinoa & Grains': 'Grains',
    'Bread': 'Bakery', 'Crackers': 'Snacks',
    'Frozen Meals': 'Frozen', 'Frozen Vegetables': 'Frozen',
    'Frozen Fruits': 'Frozen', 'Frozen Meat, Poultry & Seafood': 'Frozen',
    'Frozen Breakfast Foods': 'Frozen', 'Frozen Pizza': 'Frozen',
    'Frozen Pancakes, Waffles, French Toast & Crepes': 'Frozen',
    'Frozen Burritos & Enchiladas': 'Frozen',
    'Canned Tomatoes': 'Canned', 'Canned Fruit': 'Canned',
    'Canned Beans': 'Canned', 'Canned Meals': 'Canned',
    'Canned Vegetables': 'Canned', 'Soups & Broths': 'Canned',
    'Soft Drinks': 'Beverages', 'Juices': 'Beverages', 'Water': 'Beverages',
    'Coffee': 'Beverages', 'Tea': 'Beverages', 'Energy Drinks': 'Beverages',
    'Sports Drinks': 'Beverages', 'Beer': 'Beverages', 'Wine': 'Beverages',
    'Juice': 'Beverages',
    'Ketchup, Mustard, BBQ & Cheese Sauce': 'Condiments',
    'Salad Dressings & Toppings': 'Condiments', 'Pickles': 'Condiments',
    'Dips, Salsas & Spreads': 'Condiments', 'Soy Sauce': 'Condiments',
    'Hot Sauce': 'Condiments', 'Mayonnaise': 'Condiments',
    'Cakes, Cupcakes, Snack Cakes': 'Bakery', 'Cookies': 'Bakery',
    'Muffins & Scones': 'Bakery', 'Tortillas & Wraps': 'Bakery',
    'Bread Rolls & Buns': 'Bakery', 'Bagels': 'Bakery',
    'Pies & Pastries': 'Bakery', 'Donuts & Pastries': 'Bakery',
    'Chips, Pretzels & Snacks': 'Snacks', 'Popcorn': 'Snacks',
    'Candy': 'Snacks', 'Granola Bars': 'Snacks', 'Nuts': 'Snacks',
    'Protein Bars': 'Snacks', 'Trail Mix': 'Snacks', 'Jerky': 'Snacks',
    'Deli': 'Deli',
}

def clean_name(desc):
    parts = [p.strip() for p in desc.split(',')]
    seen = []
    for p in parts:
        if p not in seen:
            seen.append(p)
    return ', '.join(seen).title()

def map_category(branded_cat):
    if not branded_cat:
        return 'Other'
    for key, val in CATEGORY_MAP.items():
        if key.lower() in branded_cat.lower():
            return val
    return 'Other'

INPUT = '/Users/ryan/shelf-life/scripts/FoodData_Central_branded_food_json_2025-12-18.json'
OUTPUT = '/Users/ryan/shelf-life/public/barcodeDB.json'

print(f'Streaming {INPUT} ...')
start = time.time()

decoder = json.JSONDecoder()
barcode_db = {}
count = 0

CHUNK = 512 * 1024  # 512KB chunks

with open(INPUT, 'rb') as f:
    # Skip past {"BrandedFoods": [
    header = b''
    while b'[' not in header:
        header += f.read(64)
    bracket_pos = header.index(b'[')
    f.seek(bracket_pos + 1 - len(header), 1)

    buf = ''
    done = False

    while not done:
        raw = f.read(CHUNK)
        if raw:
            buf += raw.decode('utf-8', errors='replace')
        else:
            done = True

        while True:
            buf = buf.lstrip(' \t\r\n,')
            if not buf:
                break
            if buf[0] == ']':
                done = True
                break
            if buf[0] != '{':
                # Unexpected char, skip
                buf = buf[1:]
                continue
            try:
                obj, end_idx = decoder.raw_decode(buf)
                buf = buf[end_idx:]
                gtin = obj.get('gtinUpc', '').strip()
                if gtin:
                    name = clean_name(obj.get('description', ''))
                    cat = map_category(obj.get('brandedFoodCategory', ''))
                    if name:
                        barcode_db[gtin] = {'n': name, 'c': cat}
                count += 1
                if count % 50000 == 0:
                    elapsed = time.time() - start
                    print(f'  {count:,} records, {len(barcode_db):,} barcodes ({elapsed:.0f}s elapsed)', flush=True)
            except json.JSONDecodeError:
                if done:
                    break
                break  # need more data from file

elapsed = time.time() - start
print(f'\nDone! {count:,} total records, {len(barcode_db):,} with barcodes ({elapsed:.0f}s)')

with open(OUTPUT, 'w') as f:
    json.dump(barcode_db, f, separators=(',', ':'))

size_mb = os.path.getsize(OUTPUT) / 1024 / 1024
print(f'Written: {OUTPUT} ({size_mb:.1f} MB)')
