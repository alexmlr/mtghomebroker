import json
import os
import sys
from datetime import datetime
from supabase import create_client
from dotenv import load_dotenv

sys.stdout.reconfigure(line_buffering=True)

load_dotenv()

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('VITE_SUPABASE_ANON_KEY')
PRICES_FILE = r'e:\Dev\App - Boost Homebroker\data\AllPrices.json'
BATCH_SIZE = 2000
FIXED_RATE = 5.50

stats = {'cards': 0, 'prices': 0, 'unmatched': 0}
price_buffer = []
uuid_map = {}  # {uuid: [(id, is_foil), ...]}

def normalize_uuid(s):
    if len(s) == 36: return s
    if len(s) == 32: return f"{s[:8]}-{s[8:12]}-{s[12:16]}-{s[16:20]}-{s[20:]}"
    return None

def flush():
    if not price_buffer: return
    try:
        supabase.table('price_history').upsert(price_buffer[:], on_conflict='card_id,source,scraped_at,price_type').execute()
        stats['prices'] += len(price_buffer)
    except: pass
    price_buffer.clear()

print("Init Supabase...")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print("Loading ALL cards from DB...")
start = datetime.now()
result = supabase.table('cards').select('id, mtgjson_uuid, is_foil').execute()
for card in result.data:
    uuid = str(card['mtgjson_uuid'])
    if uuid not in uuid_map:
        uuid_map[uuid] = []
    uuid_map[uuid].append((card['id'], card['is_foil']))
print(f"Loaded {len(uuid_map)} unique UUIDs in {(datetime.now()-start).total_seconds():.1f}s\n")

print("Loading AllPrices.json...")
with open(PRICES_FILE, 'r', encoding='utf-8') as f:
    data = json.load(f)

prices_data = data.get('data', {})
total = len(prices_data)
print(f"Loaded {total} price entries\n")

start = datetime.now()
for i, (uuid, price_data) in enumerate(prices_data.items(), 1):
    norm_uuid = normalize_uuid(uuid)
    if not norm_uuid or norm_uuid not in uuid_map:
        stats['unmatched'] += 1
        continue
    
    ck = price_data.get('paper', {}).get('cardkingdom', {})
    if not ck: continue
    
    buylist = ck.get('buylist', {})
    retail = ck.get('retail', {})
    
    for card_id, is_foil in uuid_map[norm_uuid]:
        finish = 'foil' if is_foil else 'normal'
        
        for date_str, price_usd in buylist.get(finish, {}).items():
            if not isinstance(price_usd, (int, float)): continue
            price_buffer.append({
                'card_id': card_id,
                'source': 'CardKingdom',
                'price_type': 'buy',
                'price_raw': price_usd,
                'currency': 'USD',
                'fx_rate_to_brl': FIXED_RATE,
                'price_brl': (price_usd * FIXED_RATE) + 0.30,
                'scraped_at': date_str
            })
        
        for date_str, price_usd in retail.get(finish, {}).items():
            if not isinstance(price_usd, (int, float)): continue
            price_buffer.append({
                'card_id': card_id,
                'source': 'CardKingdom',
                'price_type': 'sell',
                'price_raw': price_usd,
                'currency': 'USD',
                'fx_rate_to_brl': FIXED_RATE,
                'price_brl': (price_usd * FIXED_RATE) + 0.30,
                'scraped_at': date_str
            })
        
        if len(price_buffer) >= BATCH_SIZE:
            flush()
    
    stats['cards'] += 1
    
    if i % 200 == 0:
        elapsed = (datetime.now() - start).total_seconds()
        rate = i / elapsed
        pct = (i / total) * 100
        eta = (total - i) / rate / 60 if rate > 0 else 0
        print(f"[{i:>6}/{total}] {pct:>5.1f}% | {rate:>6.1f} c/s | Prices: {stats['prices']:>8} | ETA: {eta:>4.0f}min")
        sys.stdout.flush()

flush()

total_time = (datetime.now() - start).total_seconds()
print(f"\n=== DONE in {total_time/60:.1f} min ===")
print(f"Cards: {stats['cards']} | Prices: {stats['prices']} | Unmatched: {stats['unmatched']}")
