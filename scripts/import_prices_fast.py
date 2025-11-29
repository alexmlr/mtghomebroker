import json
import os
import time
import sys
from datetime import datetime, date
from supabase import create_client
from dotenv import load_dotenv

# Force unbuffered output
sys.stdout.reconfigure(line_buffering=True)

load_dotenv()

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('VITE_SUPABASE_ANON_KEY')
PRICES_FILE = r'e:\Dev\App - Boost Homebroker\data\AllPrices.json'
DRY_RUN = os.getenv('DRY_RUN', 'false').lower() == 'true'
MAX_CARDS = int(os.getenv('MAX_CARDS', 0)) or None
BATCH_SIZE = 1000
FIXED_RATE = 5.50  # Taxa fixa para histórico

# Stats
stats = {
    'cards_processed': 0,
    'prices_inserted': 0,
    'cards_updated': 0,
    'unmatched': 0,
    'no_price': 0
}

price_history_buffer = []
supabase = None

def get_supabase():
    global supabase
    if not supabase:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    return supabase

def normalize_uuid(uuid_str):
    if len(uuid_str) == 36:
        return uuid_str
    if len(uuid_str) == 32:
        return f"{uuid_str[:8]}-{uuid_str[8:12]}-{uuid_str[12:16]}-{uuid_str[16:20]}-{uuid_str[20:]}"
    raise ValueError(f"Invalid UUID: {uuid_str}")

def flush_buffer():
    if not price_history_buffer or DRY_RUN:
        if DRY_RUN:
            stats['prices_inserted'] += len(price_history_buffer)
        price_history_buffer.clear()
        return
    
    try:
        client = get_supabase()
        client.table('price_history').upsert(
            price_history_buffer[:],
            on_conflict='card_id,source,scraped_at,price_type'
        ).execute()
        stats['prices_inserted'] += len(price_history_buffer)
    except Exception as e:
        print(f"Buffer flush error: {e}")
    finally:
        price_history_buffer.clear()

def process_card(uuid, price_data):
    try:
        norm_uuid = normalize_uuid(uuid)
        
        client = get_supabase()
        result = client.table('cards').select('id, is_foil').eq('mtgjson_uuid', norm_uuid).execute()
        
        if not result.data:
            stats['unmatched'] += 1
            return
        
        ck_data = price_data.get('paper', {}).get('cardkingdom', {})
        if not ck_data:
            stats['no_price'] += 1
            return
        
        buylist = ck_data.get('buylist', {})
        retail = ck_data.get('retail', {})
        
        for variant in result.data:
            finish = 'foil' if variant['is_foil'] else 'normal'
            
            # Processar buylist
            for date_str, price_usd in buylist.get(finish, {}).items():
                if not isinstance(price_usd, (int, float)):
                    continue
                price_brl = (price_usd * FIXED_RATE) + 0.30
                price_history_buffer.append({
                    'card_id': variant['id'],
                    'source': 'CardKingdom',
                    'price_type': 'buy',
                    'price_raw': price_usd,
                    'currency': 'USD',
                    'fx_rate_to_brl': FIXED_RATE,
                    'price_brl': price_brl,
                    'scraped_at': date_str
                })
            
            # Processar retail
            for date_str, price_usd in retail.get(finish, {}).items():
                if not isinstance(price_usd, (int, float)):
                    continue
                price_brl = (price_usd * FIXED_RATE) + 0.30
                price_history_buffer.append({
                    'card_id': variant['id'],
                    'source': 'CardKingdom',
                    'price_type': 'sell',
                    'price_raw': price_usd,
                    'currency': 'USD',
                    'fx_rate_to_brl': FIXED_RATE,
                    'price_brl': price_brl,
                    'scraped_at': date_str
                })
            
            if len(price_history_buffer) >= BATCH_SIZE:
                flush_buffer()
        
        stats['cards_updated'] += 1
        
    except Exception as e:
        print(f"Error {uuid}: {e}")

def main():
    print(f"Starting (DRY_RUN={DRY_RUN}, MAX_CARDS={MAX_CARDS or 'ALL'})")
    print(f"Fixed Rate: R$ {FIXED_RATE}")
    
    get_supabase()
    start = datetime.now()
    
    print("Loading JSON...")
    with open(PRICES_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    prices_data = data.get('data', {})
    total = len(prices_data)
    print(f"Loaded {total} UUIDs\n")
    
    for i, (uuid, price_data) in enumerate(prices_data.items(), 1):
        if MAX_CARDS and stats['cards_processed'] >= MAX_CARDS:
            break
        
        process_card(uuid, price_data)
        stats['cards_processed'] += 1
        
        # Log a cada 500 cards
        if i % 500 == 0:
            elapsed = (datetime.now() - start).total_seconds()
            rate = i / elapsed if elapsed > 0 else 0
            pct = (i / total) * 100
            eta_sec = (total - i) / rate if rate > 0 else 0
            eta_min = eta_sec / 60
            
            print(f"[{i:>6}/{total}] {pct:5.1f}% | Rate: {rate:5.1f} c/s | Prices: {stats['prices_inserted']:>7} | ETA: {eta_min:>4.0f}min")
            sys.stdout.flush()
    
    flush_buffer()
    
    total_time = (datetime.now() - start).total_seconds()
    print(f"\n=== DONE ===")
    print(f"Time: {total_time/60:.1f} min")
    print(f"Cards: {stats['cards_processed']}")
    print(f"Prices: {stats['prices_inserted']}")
    print(f"Unmatched: {stats['unmatched']}")

if __name__ == '__main__':
    main()
