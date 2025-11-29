import os
import sys
from datetime import datetime
from supabase import create_client
from dotenv import load_dotenv

sys.stdout.reconfigure(line_buffering=True)
load_dotenv()

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('VITE_SUPABASE_ANON_KEY')

print("Conectando ao Supabase...")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print("Buscando preços mais recentes de cada carta...\n")

# Query SQL para pegar o preço mais recente de cada carta (buy e sell)
sql = """
WITH latest_prices AS (
  SELECT DISTINCT ON (card_id, price_type)
    card_id,
    price_type,
    price_raw,
    price_brl,
    scraped_at
  FROM price_history
  WHERE source = 'CardKingdom'
  ORDER BY card_id, price_type, scraped_at DESC
)
SELECT 
  card_id,
  MAX(CASE WHEN price_type = 'buy' THEN price_raw END) as buy_usd,
  MAX(CASE WHEN price_type = 'buy' THEN price_brl END) as buy_brl,
  MAX(CASE WHEN price_type = 'sell' THEN price_raw END) as retail_usd,
  MAX(CASE WHEN price_type = 'sell' THEN price_brl END) as retail_brl,
  MAX(scraped_at) as last_update
FROM latest_prices
GROUP BY card_id;
"""

result = supabase.rpc('exec_sql', {'query': sql}).execute()

if not result.data:
    print("Executando query diretamente...")
    # Alternativa: buscar todos os preços e processar em Python
    result = supabase.table('price_history').select('card_id, price_type, price_raw, price_brl, scraped_at').eq('source', 'CardKingdom').execute()
    
    # Agrupar por card_id e pegar mais recentes
    card_prices = {}
    for row in result.data:
        card_id = row['card_id']
        if card_id not in card_prices:
            card_prices[card_id] = {'buy': None, 'sell': None, 'date': None}
        
        price_type = row['price_type']
        scraped_at = row['scraped_at']
        
        if not card_prices[card_id][price_type] or scraped_at > card_prices[card_id][price_type]['date']:
            card_prices[card_id][price_type] = {
                'usd': row['price_raw'],
                'brl': row['price_brl'],
                'date': scraped_at
            }
        
        if not card_prices[card_id]['date'] or scraped_at > card_prices[card_id]['date']:
            card_prices[card_id]['date'] = scraped_at
    
    print(f"Processados {len(card_prices)} cards com preços")
    
    # Atualizar cards em lotes
    updated = 0
    for card_id, prices in card_prices.items():
        update_data = {}
        
        if prices['buy']:
            update_data['ck_buy_usd'] = prices['buy']['usd']
            update_data['ck_buy_brl'] = prices['buy']['brl']
        
        if prices['sell']:
            update_data['ck_retail_usd'] = prices['sell']['usd']
            update_data['ck_retail_brl'] = prices['sell']['brl']
        
        if prices['date']:
            update_data['ck_last_update'] = prices['date']
        
        if update_data:
            try:
                supabase.table('cards').update(update_data).eq('id', card_id).execute()
                updated += 1
                
                if updated % 100 == 0:
                    print(f"Atualizados {updated} cards...")
                    sys.stdout.flush()
            except Exception as e:
                print(f"Erro ao atualizar card {card_id}: {e}")
    
    print(f"\n✅ Atualização concluída!")
    print(f"Total de cards atualizados: {updated}")

else:
    # Processar resultado da query SQL
    print(f"Atualizando {len(result.data)} cards...")
    updated = 0
    
    for row in result.data:
        update_data = {}
        
        if row.get('buy_usd'):
            update_data['ck_buy_usd'] = row['buy_usd']
            update_data['ck_buy_brl'] = row['buy_brl']
        
        if row.get('retail_usd'):
            update_data['ck_retail_usd'] = row['retail_usd']
            update_data['ck_retail_brl'] = row['retail_brl']
        
        if row.get('last_update'):
            update_data['ck_last_update'] = row['last_update']
        
        if update_data:
            supabase.table('cards').update(update_data).eq('id', row['card_id']).execute()
            updated += 1
    
    print(f"✅ {updated} cards atualizados com preços mais recentes!")
