import os
import time
from supabase import create_client
from dotenv import load_dotenv

# Force unbuffered output
import sys
sys.stdout.reconfigure(encoding='utf-8')

load_dotenv()

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('VITE_SUPABASE_ANON_KEY')

print(f"Connecting to {SUPABASE_URL}...")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def run_test():
    try:
        # 1. Get a real card
        print("\n1. Fetching a real card to test with...")
        res = supabase.table('cards').select('id, mtgjson_uuid, name').limit(1).execute()
        if not res.data:
            print("ERROR: No cards found in DB!")
            return
        
        card = res.data[0]
        print(f"Found card: ID={card['id']}, UUID={card['mtgjson_uuid']}, Name={card['name']}")
        
        # 2. Simulate the Select used in main script
        print(f"\n2. Testing SELECT by UUID ({card['mtgjson_uuid']})...")
        res = supabase.table('cards').select('id, is_foil, name, set_code').eq('mtgjson_uuid', card['mtgjson_uuid']).execute()
        print(f"SELECT result: Found {len(res.data)} variants")

        # 3. Simulate Upsert into price_history
        print("\n3. Testing UPSERT into price_history...")
        price_data = [{
            'card_id': card['id'],
            'source': 'DEBUG_SCRIPT',
            'price_type': 'buy',
            'price_raw': 0.01,
            'currency': 'USD',
            'fx_rate_to_brl': 5.0,
            'price_brl': 0.35,
            'scraped_at': '2025-01-01'
        }]
        res = supabase.table('price_history').upsert(price_data, on_conflict='card_id,source,scraped_at').execute()
        print(f"UPSERT success. Data: {res.data}")

        # 4. Simulate Update cards
        print("\n4. Testing UPDATE cards...")
        res = supabase.table('cards').update({
            'ck_last_update': '2025-01-01'
        }).eq('id', card['id']).execute()
        print(f"UPDATE success. Data: {res.data}")

        print("\n✅ ALL TESTS PASSED")

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        if hasattr(e, 'code'):
            print(f"Error Code: {e.code}")
        if hasattr(e, 'details'):
            print(f"Error Details: {e.details}")
        if hasattr(e, 'message'):
            print(f"Error Message: {e.message}")

if __name__ == "__main__":
    run_test()
