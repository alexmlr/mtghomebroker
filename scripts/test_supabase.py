import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('VITE_SUPABASE_ANON_KEY')

print(f"Connecting to {SUPABASE_URL}")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

try:
    print("Testing SELECT from cards...")
    res = supabase.table('cards').select('count', count='exact').limit(1).execute()
    print(f"SELECT success: {res}")

    print("\nTesting INSERT into price_history...")
    # Try to insert a dummy record (will fail constraint but should find table)
    try:
        res = supabase.table('price_history').insert({
            'card_id': 1, # Assuming ID 1 exists or FK fails
            'source': 'TEST',
            'price_type': 'buy',
            'price_raw': 0,
            'currency': 'USD',
            'fx_rate_to_brl': 1,
            'price_brl': 0,
            'scraped_at': '2025-01-01'
        }).execute()
        print(f"INSERT success: {res}")
    except Exception as e:
        print(f"INSERT failed: {e}")

except Exception as e:
    print(f"General error: {e}")
