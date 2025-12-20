import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_KEY (or SUPABASE_SERVICE_ROLE_KEY) environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function getCardId(name: string, set_name: string, collector_number: string, is_foil: boolean): Promise<number | null> {
    // Try to find the card. 
    // Note: set_name and collector_number matching might need fuzzy logic or exact match depending on data quality.
    // For now, we assume exact match or close enough.

    const { data, error } = await supabase
        .from('cards')
        .select('id')
        .eq('name', name)
        .eq('set_name', set_name)
        .eq('collector_number', collector_number)
        .eq('is_foil', is_foil)
        .maybeSingle();

    if (error) {
        console.error(`Error finding card ${name} (${set_name}):`, error);
        return null;
    }

    return data ? data.id : null;
}

export async function upsertCard(cardData: any): Promise<number | null> {
    // Check if card exists
    let cardId = await getCardId(cardData.name, cardData.set, cardData.collector_number, cardData.foil);

    if (cardId) {
        // Update existing
        // We pass link_ck through cardData for update as well
        await updateCardPrices(cardId, cardData.usd, cardData.credit, cardData.brl, cardData.link_ck);
        // Also update metadata if missing (like image from scryfall)
        if (cardData.image_url) {
            await supabase.from('cards').update({
                image_url: cardData.image_url,
                set_code: cardData.set_code
            }).eq('id', cardId);
        }
    } else {
        // Insert new
        const { data, error } = await supabase
            .from('cards')
            .insert({
                name: cardData.name,
                set_name: cardData.set,
                collector_number: cardData.collector_number,
                is_foil: cardData.foil,
                ck_buy_usd: cardData.usd,
                ck_buy_credit: cardData.credit,
                ck_buy_brl: cardData.brl,
                ck_last_update: new Date().toISOString(),
                link_ck: cardData.url, // Save the URL!
                // Metadata
                set_code: cardData.set_code,
                image_url: cardData.image_url,
                collector_number_normalized: cardData.collector_number
            })
            .select('id')
            .single();

        if (error) {
            console.error('Error inserting card:', error);
            return null;
        }
        cardId = data.id;
    }
    return cardId;
}

export async function updateCardPrices(id: number, usd: number, credit: number, brl: number, link_ck?: string) {
    const updateData: any = {
        ck_buy_usd: usd,
        ck_buy_credit: credit,
        ck_buy_brl: brl,
        ck_last_update: new Date().toISOString()
    };

    if (link_ck) {
        updateData.link_ck = link_ck;
    }

    const { error } = await supabase
        .from('cards')
        .update(updateData)
        .eq('id', id);

    if (error) {
        console.error(`Error updating card ${id}:`, error);
    }
}

export async function insertPriceHistory(card_id: number, price_raw: number, currency: 'USD' | 'CREDITS', fx_rate: number, price_brl: number) {
    // Check if we already have a record for this card, currency, and today
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const { data: existing } = await supabase
        .from('price_history')
        .select('id')
        .eq('card_id', card_id)
        .eq('currency', currency)
        .gte('created_at', `${today}T00:00:00`)
        .lt('created_at', `${today}T23:59:59`)
        .maybeSingle();

    if (existing) {
        // Already exists for today, skip insert
        return;
    }

    const { error } = await supabase
        .from('price_history')
        .insert({
            card_id: card_id,
            source: 'CardKingdom',
            price_type: 'buy',
            price_raw: price_raw,
            currency: currency,
            fx_rate_to_brl: fx_rate,
            price_brl: price_brl,
            scraped_at: new Date().toISOString(),
            created_at: new Date().toISOString()
        });

    if (error) {
        console.error(`Error inserting history for card ${card_id} (${currency}):`, error);
    }
}

export async function updateLigaMagicPrice(cardId: number, priceBrl: number, url?: string) {
    // 1. Update Card Table
    // We update both price AND ck_last_update (treating it as general last_update)
    const updateData: any = {
        lm_sell_brl: priceBrl,
        ck_last_update: new Date().toISOString()
    };

    if (url) {
        updateData.link_lm = url;
    }

    const { error } = await supabase
        .from('cards')
        .update(updateData)
        .eq('id', cardId);

    if (error) {
        console.error(`Error updating LM price for card ${cardId}:`, error);
    }

    // 2. Insert into History (Source = 'LigaMagic')
    await insertPriceHistoryV2(cardId, priceBrl, 'LigaMagic');
}

// Helper for generic history insertion (V2 to support Source)
// We need to check if 'price_history' supports 'source' column.
// Looking at previous valid code (lines 116), it hardcoded source: 'CardKingdom'.
// So yes, 'source' column exists.

async function insertPriceHistoryV2(card_id: number, price_brl: number, source: string) {
    const today = new Date().toISOString().split('T')[0];

    // Check existing for today & source
    const { data: existing } = await supabase
        .from('price_history')
        .select('id')
        .eq('card_id', card_id)
        .eq('source', source)
        .gte('created_at', `${today}T00:00:00`)
        .lt('created_at', `${today}T23:59:59`)
        .maybeSingle();

    if (existing) return;

    // Insert
    const { error } = await supabase
        .from('price_history')
        .insert({
            card_id: card_id,
            source: source,
            price_type: 'sell', // LigaMagic is usually "Venda" (Market Price or Min Price)
            price_raw: price_brl, // LM is already in BRL
            currency: 'BRL',
            fx_rate_to_brl: 1.0,
            price_brl: price_brl,
            scraped_at: new Date().toISOString(),
            created_at: new Date().toISOString()
        });

    if (error) {
        console.error(`Error inserting history for card ${card_id} (${source}):`, error);
    }
}
