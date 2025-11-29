import json
import os
import sys
from datetime import datetime, date
from supabase import create_client
from dotenv import load_dotenv
import requests

sys.stdout.reconfigure(line_buffering=True)
load_dotenv()

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('VITE_SUPABASE_ANON_KEY')
PRICES_FILE = r'e:\Dev\App - Boost Homebroker\data\AllPricesToday.json'
BATCH_SIZE = 2000

stats = {'cards': 0, 'prices': 0, 'updated': 0}
price_buffer = []
uuid_map = {}

def normalize_uuid(s):
    if len(s) == 36: return s
    if len(s) == 32: return f"{s[:8]}-{s[8:12]}-{s[12:16]}-{s[16:20]}-{s[20:]}"
    return None

def get_today_fx_rate():
    """Busca taxa de câmbio de HOJE da API"""
    today = date.today().isoformat()
    try:
        response = requests.get(f'https://api.exchangerate.host/{today}?base=USD&symbols=BRL', timeout=10)
        data = response.json()
        rate = data.get('rates', {}).get('BRL', 5.50)
        print(f"Taxa do dia ({today}): R$ {rate:.4f}")
        return rate
    except:
        print("Erro ao buscar taxa, usando R$ 5.50")
        return 5.50

def flush():
    if not price_buffer: return
    try:
        supabase.table('price_history').upsert(
            price_buffer[:], 
            on_conflict='card_id,source,scraped_at,price_type'
        ).execute()
        stats['prices'] += len(price_buffer)
    except Exception as e:
        print(f"Erro no flush: {e}")
    price_buffer.clear()

print("Iniciando importação diária...")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Buscar taxa de câmbio de hoje
fx_rate = get_today_fx_rate()
today = date.today().isoformat()

print("Carregando UUIDs do banco...")
result = supabase.table('cards').select('id, mtgjson_uuid, is_foil').execute()
for card in result.data:
    uuid = str(card['mtgjson_uuid'])
    if uuid not in uuid_map:
        uuid_map[uuid] = []
    uuid_map[uuid].append((card['id'], card['is_foil']))
print(f"Carregados {len(uuid_map)} UUIDs únicos\n")

print(f"Carregando {PRICES_FILE}...")
with open(PRICES_FILE, 'r', encoding='utf-8') as f:
    data = json.load(f)

prices_data = data.get('data', {})
print(f"Arquivo: {len(prices_data)} entries\n")

start = datetime.now()
for uuid, price_data in prices_data.items():
    norm_uuid = normalize_uuid(uuid)
    if not norm_uuid or norm_uuid not in uuid_map:
        continue
    
    ck = price_data.get('paper', {}).get('cardkingdom', {})
    if not ck: continue
    
    buylist = ck.get('buylist', {})
    retail = ck.get('retail', {})
    
    for card_id, is_foil in uuid_map[norm_uuid]:
        finish = 'foil' if is_foil else 'normal'
        
        # Processar buylist de hoje
        buy_price = buylist.get(finish, {}).get(today)
        if buy_price and isinstance(buy_price, (int, float)):
            price_brl = (buy_price * fx_rate) + 0.30
            price_buffer.append({
                'card_id': card_id,
                'source': 'CardKingdom',
                'price_type': 'buy',
                'price_raw': buy_price,
                'currency': 'USD',
                'fx_rate_to_brl': fx_rate,
                'price_brl': price_brl,
                'scraped_at': today
            })
            
            # Atualizar tabela cards com preço atual
            if not os.getenv('DRY_RUN'):
                supabase.table('cards').update({
                    'ck_buy_usd': buy_price,
                    'ck_buy_brl': price_brl,
                    'ck_last_update': today
                }).eq('id', card_id).execute()
                stats['updated'] += 1
        
        # Processar retail de hoje
        retail_price = retail.get(finish, {}).get(today)
        if retail_price and isinstance(retail_price, (int, float)):
            price_brl = (retail_price * fx_rate) + 0.30
            price_buffer.append({
                'card_id': card_id,
                'source': 'CardKingdom',
                'price_type': 'sell',
                'price_raw': retail_price,
                'currency': 'USD',
                'fx_rate_to_brl': fx_rate,
                'price_brl': price_brl,
                'scraped_at': today
            })
            
            # Atualizar tabela cards com preço atual
            if not os.getenv('DRY_RUN'):
                supabase.table('cards').update({
                    'ck_retail_usd': retail_price,
                    'ck_retail_brl': price_brl,
                    'ck_last_update': today
                }).eq('id', card_id).execute()
        
        if len(price_buffer) >= BATCH_SIZE:
            flush()
    
    stats['cards'] += 1

flush()

elapsed = (datetime.now() - start).total_seconds()
print(f"\n✅ Importação diária concluída em {elapsed:.1f}s")
print(f"Cards processados: {stats['cards']}")
print(f"Preços inseridos: {stats['prices']}")
print(f"Cards atualizados: {stats['updated']}")
