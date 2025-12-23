import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Try to load from root .env if not in current dir, or just load default
import fs from 'fs';

// Try standard paths
const pathsToCheck = [
    path.resolve(__dirname, '../../.env'), // From dist/ or src/ to root
    path.resolve(__dirname, '../../../.env'), // Deeper nesting?
    path.resolve(process.cwd(), '.env'),      // Current working dir
    path.resolve(process.cwd(), '../.env')    // Parent dir
];

let envLoaded = false;
for (const p of pathsToCheck) {
    if (fs.existsSync(p)) {
        console.log(`Loading .env from: ${p}`);
        const envConfig = dotenv.parse(fs.readFileSync(p));
        for (const k in envConfig) {
            process.env[k] = envConfig[k];
        }
        envLoaded = true;
        break;
    }
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

console.log('DEBUG: SUPABASE_URL present?', !!supabaseUrl);
console.log('DEBUG: SUPABASE_KEY present?', !!supabaseKey);

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_KEY (or SUPABASE_SERVICE_ROLE_KEY) environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface CardToScrape {
    id: number;
    name: string;
    liga_magic_url: string;
    mtgjson_uuid: string | null;
    is_foil: boolean;
    set_code: string;
}

export async function getTrackedCardsWithLmLink(): Promise<CardToScrape[]> {
    // Select distinct cards that are tracked and have a LigaMagic URL
    // We use a raw query or join.
    // simpler: select distinct card_id from user_tracked_cards, then fetch details.

    // First, get distinct card IDs that are tracked
    const { data: trackedData, error: trackedError } = await supabase
        .from('user_tracked_cards')
        .select('card_id');

    if (trackedError) {
        console.error('Error fetching tracked cards:', trackedError);
        return [];
    }

    if (!trackedData || trackedData.length === 0) return [];

    const trackedIds = [...new Set(trackedData.map(t => t.card_id))];

    // Now fetch details for these cards, filtering by liga_magic_url presence
    const { data: cards, error: cardsError } = await supabase
        .from('all_cards')
        .select('id, name, liga_magic_url, mtgjson_uuid, is_foil, set_code')
        .in('id', trackedIds)
        .not('liga_magic_url', 'is', null)
        .neq('liga_magic_url', '');

    if (cardsError) {
        console.error('Error fetching card details:', cardsError);
        return [];
    }

    return cards as CardToScrape[];
}

export async function updateLmPrice(cardId: number, mtgjsonUuid: string | null, priceBrl: number, url: string) {
    const now = new Date().toISOString();

    // 1. Update 'all_cards' table (Legacy/View Support)
    // We update lm_sell_brl and maybe a last_update field if appropriate.
    // existing scraper updates ck_last_update, but that seems specific to CK.
    // We will update lm_sell_brl.
    const { error: cardError } = await supabase
        .from('all_cards')
        .update({
            lm_sell_brl: priceBrl
            // We don't touch ck_last_update here to avoid confusing sources, 
            // unless we want a general 'last_update'
        })
        .eq('id', cardId);

    if (cardError) {
        console.error(`Error updating public.cards for ${cardId}:`, cardError);
    }

    // 2. Update 'card_prices' table (New Standard)
    if (mtgjsonUuid) {
        // We first check if the row exists
        const { data: existingPrice } = await supabase
            .from('card_prices')
            .select('mtgjson_uuid')
            .eq('mtgjson_uuid', mtgjsonUuid)
            .maybeSingle();

        if (existingPrice) {
            const { error: cpError } = await supabase
                .from('card_prices')
                .update({
                    lm_price_brl: priceBrl,
                    lm_last_update: now
                })
                .eq('mtgjson_uuid', mtgjsonUuid);

            if (cpError) console.error(`Error updating public.card_prices for ${mtgjsonUuid}:`, cpError);
        } else {
            // If row doesn't exist in card_prices (maybe it's a new card not yet synced from MTGJSON),
            // we can try to insert it, but card_prices is usually master-data driven from MTGJSON.
            // For now, valid to Insert.
            const { error: cpInsertError } = await supabase
                .from('card_prices')
                .insert({
                    mtgjson_uuid: mtgjsonUuid,
                    lm_price_brl: priceBrl,
                    lm_last_update: now
                });
            if (cpInsertError) console.error(`Error inserting public.card_prices for ${mtgjsonUuid}:`, cpInsertError);
        }
    }

    // 3. Insert into 'price_history'
    // Check if we already have a price for today to avoid dupes?
    // User said "historico desses preços diariamente".
    await insertPriceHistory(cardId, priceBrl, 'LigaMagic');
}

async function insertPriceHistory(card_id: number, price_brl: number, source: string) {
    const today = new Date().toISOString().split('T')[0];

    const { data: existing } = await supabase
        .from('price_history')
        .select('id')
        .eq('card_id', card_id)
        .eq('source', source)
        .gte('created_at', `${today}T00:00:00`)
        .lt('created_at', `${today}T23:59:59`)
        .maybeSingle();

    if (existing) {
        // Update existing record for today? or just skip?
        // Usually daily history means one snapshot per day. We can update it to be the latest.
        const { error } = await supabase
            .from('price_history')
            .update({
                price_brl: price_brl,
                price_raw: price_brl,
                scraped_at: new Date().toISOString()
            })
            .eq('id', existing.id);
        if (error) console.error(`Error updating history for ${card_id}:`, error);
    } else {
        const { error } = await supabase
            .from('price_history')
            .insert({
                card_id: card_id,
                source: source,
                price_type: 'sell', // LM is retail sell price usually
                price_raw: price_brl,
                currency: 'BRL',
                fx_rate_to_brl: 1.0,
                price_brl: price_brl,
                scraped_at: new Date().toISOString(),
                created_at: new Date().toISOString()
            });

        if (error) {
            console.error(`Error inserting history for card ${card_id}:`, error);
        }
    }
}
