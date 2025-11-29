import json
import os
import time
from datetime import datetime
from supabase import create_client
from dotenv import load_dotenv
import requests

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('VITE_SUPABASE_ANON_KEY')
PRICES_FILE = r'e:\Dev\App - Boost Homebroker\data\AllPrices.json'
DRY_RUN = os.getenv('DRY_RUN', 'false').lower() == 'true'
MAX_CARDS = int(os.getenv('MAX_CARDS', 0)) or None
BATCH_SIZE = 500  # Reduced batch size for stability

# Global client
supabase = None

def get_supabase():
    global supabase
    if not supabase:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    return supabase

def refresh_supabase():
    global supabase
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    return supabase

# Stats
stats = {
    'cards_processed': 0,
    'prices_queued': 0,
    'prices_inserted': 0,
    'cards_updated': 0,
    'unmatched': 0,
    'no_price': 0,
    'fx_fetched': 0,
    'retries': 0
}

fx_cache = {}
price_history_buffer = []

def normalize_uuid(uuid_str):
    """Convert UUID to standard format with dashes if needed"""
    if len(uuid_str) == 36:
        return uuid_str
    if len(uuid_str) == 32:
        return f"{uuid_str[:8]}-{uuid_str[8:12]}-{uuid_str[12:16]}-{uuid_str[16:20]}-{uuid_str[20:]}"
    raise ValueError(f"Invalid UUID length: {len(uuid_str)} ({uuid_str})")

def get_fx_rate(date):
    """Get USD->BRL exchange rate - using fixed rate for performance"""
    FIXED_RATE = 5.50  # Average USD/BRL rate
    
    if date in fx_cache:
        return fx_cache[date]
    
    fx_cache[date] = FIXED_RATE
    return FIXED_RATE

def execute_with_retry(operation_name, func, max_retries=3):
    """Execute a function with retry logic"""
    for attempt in range(max_retries):
        try:
            return func()
        except Exception as e:
            stats['retries'] += 1
            if attempt == max_retries - 1:
                print(f"Error in {operation_name} after {max_retries} attempts: {e}")
                raise e
            
            # If it's a schema cache error, refresh client
            if 'PGRST204' in str(e) or 'schema cache' in str(e):
                print(f"Schema cache error detected. Refreshing client...")
                refresh_supabase()
            
            time.sleep(1 * (attempt + 1)) # Exponential backoff

def flush_price_buffer():
    """Insert buffered prices into database"""
    if not price_history_buffer:
        return

    if DRY_RUN:
        stats['prices_inserted'] += len(price_history_buffer)
        price_history_buffer.clear()
        return

    def do_insert():
        client = get_supabase()
        data = price_history_buffer[:]
        client.table('price_history').upsert(data, on_conflict='card_id,source,scraped_at,price_type').execute()
        stats['prices_inserted'] += len(data)

    try:
        execute_with_retry("flush_price_buffer", do_insert)
    except Exception as e:
        print(f"Failed to flush buffer: {e}")
    finally:
        price_history_buffer.clear()

def process_card_prices(compact_uuid, price_data):
    """Process prices for a single card UUID"""
    try:
        normalized_uuid = normalize_uuid(compact_uuid)
        
        def find_card():
            client = get_supabase()
            return client.table('cards').select('id, is_foil, name, set_code').eq('mtgjson_uuid', normalized_uuid).execute()

        # Find card variants in database
        try:
            result = execute_with_retry("find_card", find_card)
        except:
            return # Skip if can't find card after retries
        
        if not result.data:
            stats['unmatched'] += 1
            return
        
        card_variants = result.data
        
        # Check for Card Kingdom data
        ck_data = price_data.get('paper', {}).get('cardkingdom', {})
        if not ck_data:
            stats['no_price'] += 1
            return
        
        buylist = ck_data.get('buylist', {})
        retail = ck_data.get('retail', {})
        
        has_updates = False
        
        for variant in card_variants:
            finish = 'foil' if variant['is_foil'] else 'normal'
            
            latest_buy = {'date': '', 'usd': 0, 'brl': 0}
            latest_retail = {'date': '', 'usd': 0, 'brl': 0}

            # Process buylist prices
            buy_prices = buylist.get(finish, {})
            for date, price_usd in buy_prices.items():
                if not isinstance(price_usd, (int, float)):
                    continue
                
                fx_rate = get_fx_rate(date)
                price_brl = (price_usd * fx_rate) + 0.30
                
                price_history_buffer.append({
                    'card_id': variant['id'],
                    'source': 'CardKingdom',
                    'price_type': 'buy',
                    'price_raw': price_usd,
                    'currency': 'USD',
                    'fx_rate_to_brl': fx_rate,
                    'price_brl': price_brl,
                    'scraped_at': date
                })
                
                if date > latest_buy['date']:
                    latest_buy = {'date': date, 'usd': price_usd, 'brl': price_brl}

            # Process retail prices
            retail_prices = retail.get(finish, {})
            for date, price_usd in retail_prices.items():
                if not isinstance(price_usd, (int, float)):
                    continue
                
                fx_rate = get_fx_rate(date)
                price_brl = (price_usd * fx_rate) + 0.30
                
                price_history_buffer.append({
                    'card_id': variant['id'],
                    'source': 'CardKingdom',
                    'price_type': 'sell',
                    'price_raw': price_usd,
                    'currency': 'USD',
                    'fx_rate_to_brl': fx_rate,
                    'price_brl': price_brl,
                    'scraped_at': date
                })

                if date > latest_retail['date']:
                    latest_retail = {'date': date, 'usd': price_usd, 'brl': price_brl}
            
            # Flush buffer if full
            if len(price_history_buffer) >= BATCH_SIZE:
                flush_price_buffer()

            # Update card with latest prices (only if we have new data)
            if latest_buy['date'] or latest_retail['date']:
                has_updates = True
                if not DRY_RUN:
                    def update_card():
                        client = get_supabase()
                        update_data = {}
                        if latest_buy['date']:
                            update_data.update({
                                'ck_buy_usd': latest_buy['usd'],
                                'ck_buy_brl': latest_buy['brl'],
                                'ck_last_update': latest_buy['date']
                            })
                        if latest_retail['date']:
                            update_data.update({
                                'ck_retail_usd': latest_retail['usd'],
                                'ck_retail_brl': latest_retail['brl'],
                                'ck_last_update': latest_retail['date']
                            })
                        
                        if update_data:
                            client.table('cards').update(update_data).eq('id', variant['id']).execute()

                    try:
                        execute_with_retry("update_card", update_card)
                    except:
                        pass # Ignore update error, price history is more important

        if has_updates:
            stats['cards_updated'] += 1
    
    except Exception as e:
        print(f"Error processing {compact_uuid}: {e}")

def main():
    print(f"Starting price import from file... (Dry Run: {DRY_RUN})")
    print(f"File: {PRICES_FILE}")
    if MAX_CARDS:
        print(f"TEST MODE: Limited to {MAX_CARDS} cards")
    
    # Initialize client
    get_supabase()
    
    start_time = datetime.now()
    
    # Load JSON file
    print("Loading JSON file...")
    with open(PRICES_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    prices_data = data.get('data', {})
    total_uuids = len(prices_data)
    print(f"Loaded {total_uuids} card UUIDs")
    
    # Process each UUID
    for i, (uuid, price_data) in enumerate(prices_data.items(), 1):
        if MAX_CARDS and stats['cards_processed'] >= MAX_CARDS:
            print(f"Reached max cards limit: {MAX_CARDS}")
            break
        
        process_card_prices(uuid, price_data)
        stats['cards_processed'] += 1
        
        # Progress update every 1000 cards
        if i % 1000 == 0:
            elapsed = (datetime.now() - start_time).total_seconds()
            rate = i / elapsed if elapsed > 0 else 0
            print(f"\n--- Progress ---")
            print(f"Cards: {i}/{total_uuids} ({i/total_uuids*100:.1f}%)")
            print(f"Prices Inserted: {stats['prices_inserted']} | Rate: {rate:.1f} cards/s")
            print(f"Unmatched: {stats['unmatched']} | No Price: {stats['no_price']} | Retries: {stats['retries']}\n")
            
            # Refresh client periodically to avoid stale connections
            if i % 5000 == 0:
                refresh_supabase()
    
    # Flush remaining prices
    flush_price_buffer()
    
    total_time = (datetime.now() - start_time).total_seconds()
    
    print("\n=== Import Complete ===")
    print(f"Time: {total_time:.1f}s ({total_time/60:.1f} min)")
    print(f"Cards processed: {stats['cards_processed']}")
    print(f"Prices inserted: {stats['prices_inserted']}")
    print(f"Cards updated: {stats['cards_updated']}")
    print(f"Unmatched cards: {stats['unmatched']}")
    print(f"Skipped (no price): {stats['no_price']}")
    print(f"FX rates fetched: {stats['fx_fetched']}")
    print(f"Total retries: {stats['retries']}")

if __name__ == '__main__':
    main()
