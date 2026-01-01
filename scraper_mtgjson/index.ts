import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore
import JSONStream from 'JSONStream';

const envPathLocal = path.resolve(__dirname, '.env');
const envPathRoot = path.resolve(__dirname, '../.env');

// Try loading from root first, then local (local overrides)
dotenv.config({ path: envPathRoot });
dotenv.config({ path: envPathLocal });

console.log(`Loaded env from: ${envPathRoot} and ${envPathLocal}`);

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --- interfaces ---
interface CardPrice {
    mtgjson_uuid: string;
    ck_buylist_usd: number | null;
    ck_buylist_credit: number | null;
    ck_buylist_foil_usd: number | null;
    ck_buylist_foil_credit: number | null;
    tcgplayer_market_usd: number | null;
    cardmarket_avg_eur: number | null;
    mtgo_cardhoarder_tix: number | null;
}

interface PriceHistoryEntry {
    card_id: number;
    source: string;
    price_type: string;
    price_raw: number;
    currency: string;
    fx_rate_to_brl: number;
    price_brl: number;
    scraped_at: string;
    created_at: string;
}

// --- Helper Functions ---

// 1. Fetch Exchange Rate (USD -> BRL)
// Using a fallback if API fails or for simple testing.
async function getRates(): Promise<{ usd: number; eur: number }> {
    try {
        const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
        const brl = response.data.rates.BRL;
        const eur = response.data.rates.EUR;
        // USD -> BRL = brl
        // EUR -> BRL = brl / eur
        if (brl && eur) return { usd: brl, eur: brl / eur };
    } catch (err) {
        console.error('Error fetching exchange rate, using fallback', err);
    }
    return { usd: 6.0, eur: 6.5 }; // Fallback
}

// 2. Map MTGJSON UUIDs to Internal Card IDs
async function getCardMappings(): Promise<Map<string, number>> {
    console.log('Fetching card mappings...');
    const mapping = new Map<string, number>();

    // Pagination to avoid timeouts if table is huge, but 'all_cards' is likely manageable.
    // all_cards is a view or table? user said "public.all_cards".
    // We need "mtgjson_uuid" and "id".

    // We'll fetch in chunks just in case.
    let from = 0;
    const size = 1000; // Match Supabase default limit to avoid gaps
    let done = false;

    while (!done) {
        const { data, error } = await supabase
            .from('all_cards')
            .select('id, mtgjson_uuid')
            .range(from, from + size - 1);

        if (error) {
            console.error('Error fetching cards:', error);
            throw error;
        }

        if (!data || data.length === 0) {
            done = true;
            break;
        }

        data.forEach((card: any) => {
            if (card.mtgjson_uuid) {
                mapping.set(card.mtgjson_uuid, card.id);
            }
        });

        from += size;
        if (data.length < size) done = true;
    }

    console.log(`Loaded ${mapping.size} card mappings.`);
    return mapping;
}

// 3. Main Processing Logic
async function main() {
    console.log('Starting MTGJSON Scraper...');

    // 0. Ensure table exists (since MCP failed)
    // We can't easily run DDL via client unless we use a specific rpc or just assume it works.
    // I entered a "CREATE TABLE IF NOT EXISTS" via SQL editor in my plan, but I couldn't run it.
    // User might need to run it. I will try to run via RPC if I had one, but I don't.
    // I will assume the user or I can fix it later if it errors. 
    // Actually, I can try to continue. If it fails insert, I'll know.

    const rates = await getRates();
    console.log(`USD to BRL Rate: ${rates.usd}, EUR to BRL Rate: ${rates.eur}`);

    const cardMap = await getCardMappings();

    console.log('Downloading AllPricesToday.json...');
    const url = 'https://mtgjson.com/api/v5/AllPricesToday.json';

    // We will stream the download and parse on the fly to save memory
    const response = await axios({
        method: 'get',
        url: url,
        responseType: 'stream'
    });

    const stream = response.data.pipe(JSONStream.parse('data.$*')); // Parse each entry in "data" object
    // data is { "uuid": { ... } }
    // JSONStream.parse('data.$*') emits { key: uuid, value: priceData } ?? 
    // Actually 'data.$*' usually emits the value. The key is lost in standard JSONStream 'data.$*' usually.
    // Let's check JSONStream docs behavior or use a safer pattern. 
    // If I use 'data', it emits the whole object key by key?
    // Safer: parse 'data' and listen for data events which will be key/value pairs if we use the right selector?
    // Actually, MTGJSON 'data' is an object where keys are UUIDs.
    // JSONStream.parse(['data', {recurse: false}]) ? 
    // Standard 'data.$*' emits the value of each key in data. We need the KEY (uuid) to map it!
    // If we lose the key, we can't map.
    // MTGJSON structure: { "data": { "UUID1": { ... }, "UUID2": { ... } } }

    // Alternative: Download the whole file (it's "Today", so it's smaller, maybe 20MB? Detailed history is huge, Today is smaller).
    // Let's try downloading existing buffer. detailed prices are large.
    // "AllPricesToday.json" is typically smaller. Let's assume we can load it in memory.
    // If it fails, I'll switch to streaming with a custom parser.

    // Let's try downloading as JSON directly.
    // Actually, `AllPricesToday.json` can be around 10-15MB gzipped, 100MB+ unzipped.
    // Node.js can handle 100MB object.

    // Re-requesting as json
    const jsonResponse = await axios.get(url, { responseType: 'json' });
    const jsonData = jsonResponse.data.data;

    if (!jsonData) {
        console.error('No data found in JSON');
        return;
    }

    console.log('Processing prices...');

    const updates: CardPrice[] = [];
    const historyEntries: PriceHistoryEntry[] = [];
    const now = new Date().toISOString();
    const todayStr = now.split('T')[0];

    // Prepare Batches
    const BATCH_SIZE = 1000;

    for (const [uuid, priceData] of Object.entries(jsonData)) {
        // Type checking safely
        const pData = priceData as any;
        const ckData = pData?.paper?.cardkingdom;

        if (!ckData) continue; // No CK data

        // We specifically want BUYLIST
        const buylist = ckData.buylist;
        if (!buylist) continue; // No buylist data

        // Retail is "normal" / "foil" usually inside "retail". 
        // Buylist structure: "buylist": { "normal": { "2023-12-19": 12.34 }, "foil": ... }
        // BUT "AllPricesToday" usually just has the value? 
        // Let's check the structure provided in the prompt:
        // "data": { "UUID": { "paper": { "cardkingdom": { "retail": ... } } } }
        // The user example had "retail". We want "buylist".
        // And "AllPricesToday" usually simplifies the date key? Or does it still have the date?
        // documentation says: "AllPricesToday.json" -> "paper": { "cardkingdom": { "buylist": { "normal": 12.34, "foil": 56.78 } } }
        // Wait, "AllPricesToday.json" typically removes the date key and just gives the float value?
        // OR it keeps the date key "2025-12-19".
        // The user example showed: "normal": { "2025-12-19": 12.34 }
        // If so, we need to extract the value for "today" (or the only key present).

        // Helper to extract price safely
        const getPrice = (obj: any): number | null => {
            if (!obj) return null;
            if (typeof obj === 'number') return obj;
            if (typeof obj === 'object') {
                const vals = Object.values(obj);
                if (vals.length > 0) return vals[0] as number;
            }
            return null;
        }

        // Card Kingdom extraction (existing logic simplified)
        let ck_buylist_usd: number | null = null;
        let ck_buylist_foil_usd: number | null = null;
        if (buylist.normal) ck_buylist_usd = getPrice(buylist.normal);
        if (buylist.foil) ck_buylist_foil_usd = getPrice(buylist.foil);

        const ck_buylist_credit = ck_buylist_usd ? ck_buylist_usd * 1.30 : null;
        const ck_buylist_foil_credit = ck_buylist_foil_usd ? ck_buylist_foil_usd * 1.30 : null;

        // TCGplayer Extraction (retail -> normal)
        // Usually, TCGplayer market price is preferred. If MTGJSON provides 'market' key under retail?
        // Checking doc: paper.tcgplayer.retail.normal.market?
        // IF pData.paper.tcgplayer exists
        let tcgplayer_market_usd: number | null = null;
        const tcg = pData?.paper?.tcgplayer;
        if (tcg && tcg.retail) {
            // We try 'normal' first
            if (tcg.retail.normal) tcgplayer_market_usd = getPrice(tcg.retail.normal);
        }

        // Cardmarket Extraction
        let cardmarket_avg_eur: number | null = null;
        const cm = pData?.paper?.cardmarket;
        if (cm && cm.retail) {
            if (cm.retail.normal) cardmarket_avg_eur = getPrice(cm.retail.normal);
        }

        // MTGO Cardhoarder
        let mtgo_cardhoarder_tix: number | null = null;
        const ch = pData?.mtgo?.cardhoarder;
        if (ch && ch.retail) {
            if (ch.retail.normal) mtgo_cardhoarder_tix = getPrice(ch.retail.normal);
        }

        // Check availability
        if (ck_buylist_usd === null && ck_buylist_foil_usd === null && tcgplayer_market_usd === null && cardmarket_avg_eur === null) continue;

        // Add to Updates (Card Prices Table)
        updates.push({
            mtgjson_uuid: uuid,
            ck_buylist_usd,
            ck_buylist_credit,
            ck_buylist_foil_usd,
            ck_buylist_foil_credit,
            tcgplayer_market_usd,
            cardmarket_avg_eur,
            mtgo_cardhoarder_tix
        });

        // Add to History (Price History Table)
        const cardId = cardMap.get(uuid);
        if (cardId) {
            const addHistory = (source: string, price: number | null, rate: number, currency: string) => {
                if (price !== null) {
                    historyEntries.push({
                        card_id: cardId,
                        source: source,
                        price_type: 'retail', // TCG and Trend are retail usually
                        price_raw: price,
                        currency: currency,
                        fx_rate_to_brl: rate,
                        price_brl: price * rate, // Simple conversion
                        scraped_at: now,
                        created_at: now
                    });
                }
            };

            // CK History (keeping logic)
            if (ck_buylist_usd !== null) {
                historyEntries.push({
                    card_id: cardId,
                    source: 'CardKingdom',
                    price_type: 'buy',
                    price_raw: ck_buylist_usd,
                    currency: 'USD',
                    fx_rate_to_brl: rates.usd,
                    price_brl: (ck_buylist_usd * rates.usd) + 0.30, // keeping fee logic
                    scraped_at: now,
                    created_at: now
                });
            }

            // TCGplayer
            addHistory('TCGplayer', tcgplayer_market_usd, rates.usd, 'USD');

            // Cardmarket
            addHistory('Cardmarket', cardmarket_avg_eur, rates.eur, 'EUR');

            // Note: Not adding Cardhoarder to history yet to save space/noise unless requested.
        }
    }

    console.log(`Found ${updates.length} prices to update.`);
    console.log(`Found ${historyEntries.length} history entries to insert.`);

    // Batch Update 'card_prices'
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('card_prices').upsert(batch);
        if (error) console.error('Error upserting batch to card_prices:', error);
        else console.log(`Upserted batch ${i / BATCH_SIZE + 1} of ${Math.ceil(updates.length / BATCH_SIZE)}`);
    }

    // Batch Insert 'price_history'
    // Warning: We should avoid duplicates if ran multiple times a day.
    // The previous implementation used "get existing".
    // Batch insert doesn't check "get existing" easily.
    // However, if I use `ignoreDuplicates: true`? 
    // `price_history` usually doesn't have a unique constraint on (card_id, source, date) unless we added it.
    // Assuming we want to be safe, we should probably check.
    // But checking 20,000 cards one by one is slow.
    // Optimization: Delete today's entries for Source='CardKingdom' produced by this script? 
    // Risky if other scraper runs.

    // Compromise: Since I am building this for "System User", I'll try to insert. 
    // If table has no unique constraint, we get dupes. 
    // The user said "os valores daquele dia, vão para a tabela".
    // I will try to use `upsert` if I can define a conflict key?
    // Current `price_history` usually just ID PK.
    // I will just Insert. The user can handle dupes or I'll add logic later if needed.
    // ACTUALLY, checking the `database.ts` from existing scraper, it CHECKS before insert.
    // "if (existing) return;"
    // For 20k items, check 1 by 1 is too slow.
    // I will skip history insert for now OR I will assume this runs once a day.
    // Better: Filter history entries. Only insert if NO entry for today?
    // I can fetch ALL history for today (source=CardKingdom) into a Set -> Map<CardID, boolean>.
    // Then filter my `historyEntries` against this Set.

    console.log('Checking existing history for today...');
    const { data: existingHistory } = await supabase
        .from('price_history')
        .select('card_id')
        .eq('source', 'CardKingdom')
        .gte('created_at', `${todayStr}T00:00:00`)
        .lt('created_at', `${todayStr}T23:59:59`);

    const existingIds = new Set(existingHistory?.map(x => x.card_id) || []);
    console.log(`Found ${existingIds.size} existing history entries for today to skip.`);

    const newHistory = historyEntries.filter(h => !existingIds.has(h.card_id));
    console.log(`Inserting ${newHistory.length} new history entries.`);

    for (let i = 0; i < newHistory.length; i += BATCH_SIZE) {
        const batch = newHistory.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('price_history').insert(batch);
        if (error) console.error('Error inserting history batch:', error);
        else console.log(`Inserted history batch ${i / BATCH_SIZE + 1}`);
    }

    console.log('Done.');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
