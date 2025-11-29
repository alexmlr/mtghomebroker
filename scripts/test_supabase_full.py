import os
from supabase import create_client
from dotenv import load_dotenv
import time

load_dotenv()

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('VITE_SUPABASE_ANON_KEY')

print(f"Connecting to {SUPABASE_URL}")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

try:
    # 1. Select a card
    print("1. Testing SELECT from cards...")
    res = supabase.table('cards').select('id, name').limit(1).execute()
    print(f"SELECT success: {len(res.data)} rows")
    
    if not res.data:
        print("No cards found to test update.")
        exit()
        
    card = res.data[0]
    card_id = card['id']
    print(f"Using card ID: {card_id} ({card['name']})")

    # 2. Upsert price history
    print("\n2. Testing UPSERT into price_history...")
    try:
        price_data = {
            'card_id': card_id,
            'source': 'TEST_DEBUG',
            'price_type': 'buy',
            'price_raw': 1.0,
            'currency': 'USD',
            'fx_rate_to_brl': 5.0,
            'price_brl': 5.0,
            'scraped_at': '2025-01-01'
        }
        res = supabase.table('price_history').upsert(price_data, on_conflict='card_id,source,scraped_at').execute()
        print(f"UPSERT success: {res.data}")
    except Exception as e:
        print(f"UPSERT failed: {e}")

    # 3. Update card
    print("\n3. Testing UPDATE cards...")
    try:
        res = supabase.table('cards').update({
            'ck_last_update': '2025-01-01'
        }).eq('id', card_id).execute()
        print(f"UPDATE success: {res.data}")
    except Exception as e:
        print(f"UPDATE failed: {e}")

except Exception as e:
    print(f"General error: {e}")
